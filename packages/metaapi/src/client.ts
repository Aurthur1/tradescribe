import { MetaApiConnectionError, type CreateAccountInput, type HistoryRange, type MetaApiGateway, type ProvisioningProfileInput } from "./types.js";

type AnyRecord = Record<string, unknown>;

const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<unknown>;

function redactError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/invalid|auth|credential|password|login/i.test(message)) {
    return new MetaApiConnectionError("Invalid login or investor password", "disconnected");
  }
  return new MetaApiConnectionError("Broker connection is temporarily unavailable", "degraded");
}

async function retry<T>(operation: () => Promise<T>, attempts = 3) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw redactError(lastError);
}

function getString(record: AnyRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value) return String(value);
  }
  return null;
}

async function sdkRoot() {
  const token = process.env.METAAPI_TOKEN;
  if (!token) throw new MetaApiConnectionError("MetaApi is not configured", "disconnected");
  const module = (await dynamicImport("metaapi.cloud-sdk")) as AnyRecord;
  const Constructor = (module.MetaApi ?? module.default) as new (token: string, options?: AnyRecord) => AnyRecord;
  return new Constructor(token, { region: process.env.METAAPI_REGION || undefined });
}

async function provisioningApi(root: AnyRecord) {
  return (root.metatraderAccountApi ?? root.metaTraderAccountApi ?? root.provisioningProfileApi ?? root) as AnyRecord;
}

export class MetaApiCloudGateway implements MetaApiGateway {
  async createProvisioningProfile(input: ProvisioningProfileInput) {
    return retry(async () => {
      const root = await sdkRoot();
      const api = await provisioningApi(root);
      const profilesApi = (root.provisioningProfileApi ?? api.provisioningProfileApi ?? api) as AnyRecord;
      const existing = typeof profilesApi.getProvisioningProfiles === "function" ? ((await profilesApi.getProvisioningProfiles()) as AnyRecord[]) : [];
      const match = existing.find((profile) => getString(profile, ["name"]) === input.name);
      if (match) return { id: String(match.id) };
      const created = (await (profilesApi.createProvisioningProfile as (...args: unknown[]) => Promise<AnyRecord>)({
        brokerTimezone: input.brokerTimezone ?? undefined,
        name: input.name,
        version: input.version
      })) as AnyRecord;
      return { id: String(created.id ?? created._id) };
    });
  }

  async createAccount(input: CreateAccountInput) {
    return retry(async () => {
      const root = await sdkRoot();
      const api = await provisioningApi(root);

      // Last line of defense: callers must pass the investor/read-only password
      // field only. Never log this payload and never persist `input.password`.
      const created = (await (api.createAccount as (...args: unknown[]) => Promise<AnyRecord>)({
        login: input.login,
        name: input.name,
        password: input.password,
        platform: input.platform,
        provisioningProfileId: input.provisioningProfileId,
        server: input.server,
        type: input.type ?? "cloud"
      })) as AnyRecord;
      return { id: String(created.id ?? created._id) };
    });
  }

  async deployAccount(accountId: string) {
    await retry(async () => {
      const account = await this.account(accountId);
      if (typeof account.deploy === "function") await account.deploy();
    });
  }

  async waitDeployed(accountId: string, timeoutMs = 180_000) {
    await retry(async () => {
      const account = await this.account(accountId);
      if (typeof account.waitDeployed === "function") {
        await account.waitDeployed(timeoutMs);
      }
      if (typeof account.waitConnected === "function") {
        await account.waitConnected(timeoutMs);
      }
    }, 1);
  }

  async getAccountInformation(accountId: string) {
    return retry(async () => {
      const account = await this.account(accountId);
      const rpc = typeof account.getRPCConnection === "function" ? account.getRPCConnection() : account;
      if (typeof rpc.connect === "function") await rpc.connect();
      if (typeof rpc.waitSynchronized === "function") await rpc.waitSynchronized();
      const info = (await (rpc.getAccountInformation as () => Promise<AnyRecord>)()) as AnyRecord;
      return {
        balance: Number(info.balance ?? 0),
        currency: info.currency ? String(info.currency) : null,
        equity: Number(info.equity ?? info.balance ?? 0),
        leverage: info.leverage ? Number(info.leverage) : null,
        name: info.name ? String(info.name) : null,
        platform: info.platform ? String(info.platform) : null
      };
    });
  }

  async getHistoryOrders(accountId: string, range: HistoryRange) {
    return retry(async () => {
      const account = await this.account(accountId);
      const rpc = typeof account.getRPCConnection === "function" ? account.getRPCConnection() : account;
      if (typeof rpc.connect === "function") await rpc.connect();
      if (typeof rpc.waitSynchronized === "function") await rpc.waitSynchronized();
      const method = (rpc.getHistoryOrdersByTimeRange ?? rpc.getHistoryOrdersByTicket) as (...args: unknown[]) => Promise<unknown[]>;
      return method.call(rpc, range.startTime, range.endTime);
    });
  }

  async getDealsByTimeRange(accountId: string, range: HistoryRange) {
    return retry(async () => {
      const account = await this.account(accountId);
      const rpc = typeof account.getRPCConnection === "function" ? account.getRPCConnection() : account;
      if (typeof rpc.connect === "function") await rpc.connect();
      if (typeof rpc.waitSynchronized === "function") await rpc.waitSynchronized();
      const method = rpc.getDealsByTimeRange as (...args: unknown[]) => Promise<unknown[]>;
      return method.call(rpc, range.startTime, range.endTime);
    });
  }

  async removeAccount(accountId: string) {
    await retry(async () => {
      const account = await this.account(accountId);
      if (typeof account.remove === "function") await account.remove();
      else if (typeof account.undeploy === "function") await account.undeploy();
    });
  }

  private async account(accountId: string) {
    const root = await sdkRoot();
    const api = await provisioningApi(root);
    if (typeof api.getAccount !== "function") throw new MetaApiConnectionError("MetaApi account API is unavailable", "degraded");
    return (await (api.getAccount as (id: string) => Promise<AnyRecord>)(accountId)) as AnyRecord;
  }
}

export const metaApiGateway = new MetaApiCloudGateway();
