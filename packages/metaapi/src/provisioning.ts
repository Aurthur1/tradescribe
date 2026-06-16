import { metaApiGateway } from "./client.js";
import type { BrokerConnectionInput, MetaApiGateway, ProvisionedMetaApiAccount } from "./types.js";

export async function provisionReadOnlyAccount(input: BrokerConnectionInput, gateway: MetaApiGateway = metaApiGateway): Promise<ProvisionedMetaApiAccount> {
  const version = input.platform === "MT5" ? 5 : 4;
  const profileName = `tradescribe:${input.platform}:${input.broker}:${input.server}`.toLowerCase();
  const profile = await gateway.createProvisioningProfile({
    name: profileName,
    server: input.server,
    version
  });
  const account = await gateway.createAccount({
    login: input.login,
    name: input.label?.trim() || `${input.broker} ${input.login}`,
    password: input.investorPassword,
    platform: input.platform.toLowerCase() as "mt4" | "mt5",
    provisioningProfileId: profile.id,
    server: input.server,
    type: "cloud"
  });
  await gateway.deployAccount(account.id);
  await gateway.waitDeployed(account.id);

  return {
    metaApiAccountId: account.id,
    provisioningProfileId: profile.id
  };
}
