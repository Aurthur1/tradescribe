import { BadRequestException, Body, Controller, Delete, Get, Module, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { adapterCatalog, capabilitiesFor, MetaApiAdapter, previewCsvImport, parseDelimited, normalizeCsvRecords, type CsvColumnMapping } from "@tradescribe/brokers";
import { MetaApiConnectionError } from "@tradescribe/metaapi";
import { computeMetrics } from "@tradescribe/metrics";
import { z, ZodError, type ZodTypeAny } from "zod";
import { AuthGuard } from "../auth/auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { AuditLogService } from "../common/audit-log.service.js";
import { MetricsQuerySchema, type MetricsQuery } from "../metrics/metrics.dto.js";
import { resolvePeriod } from "../metrics/period.util.js";
import { toMetricsTrade, type TradeRow } from "../metrics/trade.mapper.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { RedisService } from "../redis/redis.service.js";
import { SignalsService } from "../signals/signals.service.js";

const DashboardFilterSchema = z.object({
  day: z.string().optional(),
  emotionTag: z.string().optional(),
  playbookId: z.string().optional(),
  session: z.enum(["Sydney", "Tokyo", "London", "New York"]).optional(),
  side: z.enum(["BUY", "SELL"]).optional(),
  symbol: z.string().optional()
});

const DashboardLayoutItemSchema = z.object({
  order: z.number().int(),
  size: z.enum(["sm", "md", "lg"]),
  visible: z.boolean(),
  widgetId: z.string()
});

const SavedDashboardViewSchema = z.object({
  anchor: z.string(),
  filters: DashboardFilterSchema,
  granularity: z.enum(["day", "week", "month", "year"]),
  id: z.string(),
  layout: z.array(DashboardLayoutItemSchema).max(24),
  name: z.string().trim().min(1).max(48)
});

const PreferencesSchema = z.object({
  activeAccountId: z.string().nullable().optional(),
  dashboardViews: z.array(SavedDashboardViewSchema).max(12).optional(),
  tradeExplorerPrefs: z
    .object({
      columnOrder: z.array(z.string()).max(32),
      hiddenColumns: z.array(z.string()).max(32),
      viewMode: z.enum(["table", "cards"])
    })
    .optional()
});

const ProfileSchema = z.object({
  avatarUrl: z.string().url().max(500).optional().nullable(),
  firstName: z.string().trim().max(80).optional().nullable(),
  lastName: z.string().trim().max(80).optional().nullable()
});

const NotificationPreferencesSchema = z.record(
  z.object({
    email: z.boolean(),
    inApp: z.boolean()
  })
);

const DisplayPreferencesSchema = z.object({
  displayCurrencyAccountId: z.string().nullable(),
  timeZone: z.string().trim().min(1).max(80)
});

const DeleteAccountSchema = z.object({
  confirmation: z.literal("DELETE MY ACCOUNT")
});

const LabelSchema = z.object({
  label: z.string().trim().max(80).nullable()
});

const DisconnectSchema = z.object({
  deleteTradeHistory: z.boolean().default(false)
});

const OnboardingSchema = z.object({
  action: z.enum(["complete", "dismiss", "start_sample"])
});

const ConnectAccountSchema = z.object({
  broker: z.string().trim().min(1).max(80),
  currency: z.string().trim().min(3).max(8).default("USD"),
  investorPassword: z.string().min(1).max(200),
  label: z.string().trim().max(80).optional().nullable(),
  login: z.string().trim().min(1).max(80),
  platform: z.enum(["MT4", "MT5"]),
  server: z.string().trim().min(1).max(120),
  startingBalance: z.coerce.number().min(0).default(0)
});

const CsvMappingSchema = z.record(z.string(), z.string());

const CsvPreviewSchema = z.object({
  content: z.string().min(1),
  currency: z.string().trim().min(3).max(8).default("USD"),
  mapping: CsvMappingSchema.optional()
});

const CsvCommitSchema = CsvPreviewSchema.extend({
  broker: z.string().trim().min(1).max(80).default("CSV Import"),
  label: z.string().trim().min(1).max(80).default("CSV Import"),
  startingBalance: z.coerce.number().min(0).default(0)
});

function parseInput<T>(schema: ZodTypeAny, value: unknown): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new BadRequestException({
        message: "Validation failed",
        issues: error.issues.map((issue) => ({ message: issue.message, path: issue.path.join(".") }))
      });
    }
    throw error;
  }
}

interface AccountRow {
  brokerConnection?: { broker: string | null; id: string; lastError?: string | null; lastSyncAt: Date | null; provider: string; status: string };
  brokerConnectionId: string;
  id: string;
  name: string | null;
  label: string | null;
  login: string;
  platform: string;
  currency: string;
  isPrimary: boolean;
  startingBalance: number;
}

interface BrokerConnectionRow {
  broker: string | null;
  id: string;
  lastError?: string | null;
  platform?: string | null;
  provider: string;
  server?: string | null;
  status: string;
  lastSyncAt: Date | null;
  tradingAccounts: AccountRow[];
}

interface SubscriptionRow {
  amountCents: number;
  currency: string;
  currentPeriodEnd: Date | null;
  plan: string;
  status: string;
  provider: string;
}

interface UserWithAccounts {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  role: "ADMIN" | "USER";
  plan: "FREE" | "CORE" | "PRO";
  preferences: {
    activeAccountId: string | null;
    displayCurrencyAccountId: string | null;
    notificationPreferences: unknown;
    onboardingCompletedAt: Date | null;
    onboardingSampleModeAt: Date | null;
    timeZone: string | null;
    dashboardViews: unknown;
    tradeExplorerPrefs: unknown;
  } | null;
  brokerConnections: BrokerConnectionRow[];
  subscriptions: SubscriptionRow[];
}

const defaultNotificationPreferences = {
  guardrail_breach: { email: false, inApp: true },
  guardrail_warning: { email: false, inApp: true },
  leak_critical: { email: false, inApp: true },
  leak_warning: { email: false, inApp: true },
  weekly_review_ready: { email: false, inApp: true }
};

function maskLogin(login: string) {
  if (login.length <= 4) return `••${login}`;
  return `${"•".repeat(Math.max(3, login.length - 4))}${login.slice(-4)}`;
}

function accountDisplayName(account: AccountRow) {
  if (account.label?.trim()) return account.label;
  const broker = account.brokerConnection?.broker ?? account.brokerConnection?.provider ?? "Broker";
  return `${broker} #${maskLogin(account.login)}`;
}

function statusLabel(status: string) {
  if (status === "ERROR") return "DEGRADED";
  return status.toUpperCase();
}

function humanConnectionError(error: unknown) {
  if (error instanceof MetaApiConnectionError) return error.message;
  const message = error instanceof Error ? error.message : String(error);
  if (/invalid|auth|credential|password|login/i.test(message)) return "Invalid login or investor password";
  if (/server|broker/i.test(message)) return "Broker server unreachable";
  return "Broker connection is temporarily unavailable";
}

function errorStatus(error: unknown): "DEGRADED" | "DISCONNECTED" {
  if (error instanceof MetaApiConnectionError) return error.status === "disconnected" ? "DISCONNECTED" : "DEGRADED";
  return "DEGRADED";
}

@Controller()
@UseGuards(AuthGuard)
export class AccountsController {
  private readonly metaApiAdapter = new MetaApiAdapter();

  constructor(
    private readonly prismaService: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly signals: SignalsService
  ) {}

  private async prisma() {
    return this.prismaService.client();
  }

  private async userRow(currentUser: AuthenticatedUser) {
    const prisma = await this.prisma();
    return (await prisma.user.findUnique({
      where: { id: currentUser.id },
      include: {
        preferences: true,
        brokerConnections: {
          include: {
            tradingAccounts: {
              include: {
                brokerConnection: {
                  select: { broker: true, id: true, lastError: true, lastSyncAt: true, provider: true, status: true }
                }
              },
              orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }]
            }
          },
          orderBy: [{ createdAt: "asc" }]
        },
        subscriptions: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    })) as UserWithAccounts | null;
  }

  private async assertAccountOwnership(userId: string, accountId: string) {
    const prisma = await this.prisma();
    const account = (await prisma.tradingAccount.findFirst({
      where: { id: accountId, brokerConnection: { userId } },
      include: { brokerConnection: true }
    })) as (AccountRow & { brokerConnection: { broker: string | null; id: string; lastError?: string | null; lastSyncAt: Date | null; provider: string; status: string } }) | null;
    if (!account) throw new BadRequestException("Account not found or not yours");
    return account;
  }

  private async assertConnectionOwnership(userId: string, connectionId: string) {
    const prisma = await this.prisma();
    const connection = await prisma.brokerConnection.findFirst({ where: { id: connectionId, userId } });
    if (!connection) throw new BadRequestException("Connection not found or not yours");
    return connection as { id: string; metaApiAccountId?: string | null; status: string; updatedAt?: Date };
  }

  private planLimit(plan: "FREE" | "CORE" | "PRO") {
    return plan === "FREE" ? 1 : plan === "CORE" ? 3 : Number.POSITIVE_INFINITY;
  }

  private async accountCount(userId: string) {
    const prisma = await this.prisma();
    return prisma.tradingAccount.count({ where: { brokerConnection: { userId } } }) as Promise<number>;
  }

  @Get("broker-adapters")
  brokerAdapters() {
    return { adapters: adapterCatalog() };
  }

  @Get("me")
  async me(@CurrentUser() currentUser: AuthenticatedUser) {
    const user = await this.userRow(currentUser);
    const accounts =
      user?.brokerConnections.flatMap((connection) =>
        connection.tradingAccounts.map((account) => ({
          id: account.id,
          broker: connection.broker ?? connection.provider,
          brokerConnectionId: connection.id,
          name: accountDisplayName(account),
          label: account.label,
          login: account.login,
          maskedLogin: maskLogin(account.login),
          platform: account.platform,
          currency: account.currency,
          equity: account.startingBalance,
          isPrimary: account.isPrimary,
          balance: account.startingBalance,
          connectionStatus: statusLabel(account.brokerConnection?.status ?? connection.status),
          lastError: account.brokerConnection?.lastError ?? connection.lastError ?? null,
          lastSyncAt: account.brokerConnection?.lastSyncAt?.toISOString() ?? connection.lastSyncAt?.toISOString() ?? null
        }))
      ) ?? [];

    const latestSubscription = user?.subscriptions[0];
    const activeAccountId = user?.preferences?.activeAccountId ?? accounts.find((account) => account.isPrimary)?.id ?? accounts[0]?.id ?? null;

    return {
      user: {
        id: user?.id ?? currentUser.id,
        email: user?.email ?? currentUser.email,
        firstName: user?.firstName ?? currentUser.firstName ?? "Trader",
        lastName: user?.lastName ?? null,
        avatarUrl: user?.avatarUrl ?? null,
        role: user?.role ?? currentUser.role,
        plan: user?.plan ?? currentUser.plan
      },
      preferences: {
        activeAccountId,
        displayCurrencyAccountId: user?.preferences?.displayCurrencyAccountId ?? activeAccountId,
        notificationPreferences: user?.preferences?.notificationPreferences ?? defaultNotificationPreferences,
        onboardingCompletedAt: user?.preferences?.onboardingCompletedAt?.toISOString() ?? null,
        onboardingSampleModeAt: user?.preferences?.onboardingSampleModeAt?.toISOString() ?? null,
        dashboardViews: user?.preferences?.dashboardViews ?? [],
        tradeExplorerPrefs: user?.preferences?.tradeExplorerPrefs ?? null,
        timeZone: user?.preferences?.timeZone ?? null
      },
      subscription: latestSubscription
        ? {
            plan: latestSubscription.plan,
            status: latestSubscription.status,
            provider: latestSubscription.provider
          }
        : null,
      accounts
    };
  }

  @Get("me/onboarding-status")
  async onboardingStatus(@CurrentUser() currentUser: AuthenticatedUser) {
    const user = await this.userRow(currentUser);
    const connectionCount = user?.brokerConnections.length ?? 0;
    const completedAt = user?.preferences?.onboardingCompletedAt ?? null;
    const sampleModeAt = user?.preferences?.onboardingSampleModeAt ?? null;
    return {
      completedAt: completedAt?.toISOString() ?? null,
      connectionCount,
      hasConnections: connectionCount > 0,
      sampleModeAt: sampleModeAt?.toISOString() ?? null,
      shouldShowFinishSetupPrompt: connectionCount === 0 && !completedAt && Boolean(sampleModeAt),
      shouldShowOnboarding: connectionCount === 0 && !completedAt && !sampleModeAt
    };
  }

  @Patch("me/onboarding")
  async updateOnboarding(@CurrentUser() currentUser: AuthenticatedUser, @Body() body: unknown) {
    const input = parseInput<{ action: "complete" | "dismiss" | "start_sample" }>(OnboardingSchema, body);
    const prisma = await this.prisma();
    const now = new Date();
    const data =
      input.action === "start_sample"
        ? { onboardingSampleModeAt: now }
        : {
            onboardingCompletedAt: now,
            ...(input.action === "complete" ? { onboardingSampleModeAt: null } : {})
          };
    return prisma.userPreference.upsert({
      create: { userId: currentUser.id, ...data },
      update: data,
      where: { userId: currentUser.id }
    });
  }

  @Patch("me/preferences")
  async updatePreferences(@CurrentUser() currentUser: AuthenticatedUser, @Body() body: unknown) {
    const input = parseInput<{ activeAccountId?: string | null; dashboardViews?: unknown[]; tradeExplorerPrefs?: unknown }>(PreferencesSchema, body);
    const user = await this.userRow(currentUser);
    const plan = user?.plan ?? currentUser.plan;
    const role = user?.role ?? currentUser.role;

    if ("activeAccountId" in input) {
      if (input.activeAccountId) {
        await this.assertAccountOwnership(currentUser.id, input.activeAccountId);
      } else if (plan !== "PRO" && role !== "ADMIN") {
        throw new BadRequestException("All accounts view requires Pro");
      }
    }

    const data: { activeAccountId?: string | null; dashboardViews?: unknown[]; tradeExplorerPrefs?: unknown } = {};
    if ("activeAccountId" in input) data.activeAccountId = input.activeAccountId ?? null;
    if (input.dashboardViews) data.dashboardViews = input.dashboardViews;
    if (input.tradeExplorerPrefs) data.tradeExplorerPrefs = input.tradeExplorerPrefs;

    const prisma = await this.prisma();
    return prisma.userPreference.upsert({
      create: { userId: currentUser.id, ...data },
      update: data,
      where: { userId: currentUser.id }
    });
  }

  @Get("me/settings")
  async settings(@CurrentUser() currentUser: AuthenticatedUser) {
    const user = await this.userRow(currentUser);
    const accounts =
      user?.brokerConnections.flatMap((connection) =>
        connection.tradingAccounts.map((account) => ({
          id: account.id,
          broker: connection.broker ?? connection.provider,
          currency: account.currency,
          label: account.label,
          login: account.login,
          maskedLogin: maskLogin(account.login),
          name: accountDisplayName(account),
          platform: account.platform
        }))
      ) ?? [];
    const latestSubscription = user?.subscriptions[0] ?? null;
    const limit = this.planLimit((user?.plan ?? currentUser.plan) as "FREE" | "CORE" | "PRO");
    return {
      accounts,
      billing: {
        amountCents: latestSubscription?.amountCents ?? 0,
        currency: latestSubscription?.currency ?? "USD",
        plan: latestSubscription?.plan ?? user?.plan ?? currentUser.plan,
        provider: latestSubscription?.provider ?? null,
        renewalDate: latestSubscription?.currentPeriodEnd?.toISOString() ?? null,
        status: latestSubscription?.status ?? "ACTIVE",
        usage: {
          accountsConnected: accounts.length,
          accountsLimit: Number.isFinite(limit) ? limit : null,
          storageMb: null
        }
      },
      emailEnabled: Boolean(process.env.EMAIL_PROVIDER),
      preferences: {
        displayCurrencyAccountId: user?.preferences?.displayCurrencyAccountId ?? accounts[0]?.id ?? null,
        notificationPreferences: user?.preferences?.notificationPreferences ?? defaultNotificationPreferences,
        timeZone: user?.preferences?.timeZone ?? null
      },
      user: {
        avatarUrl: user?.avatarUrl ?? null,
        email: user?.email ?? currentUser.email,
        firstName: user?.firstName ?? currentUser.firstName ?? "",
        lastName: user?.lastName ?? ""
      }
    };
  }

  @Patch("me/profile")
  async updateProfile(@CurrentUser("id") userId: string, @Body() body: unknown) {
    const input = parseInput<z.infer<typeof ProfileSchema>>(ProfileSchema, body);
    const prisma = await this.prisma();
    return prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl || null } : {}),
        ...(input.firstName !== undefined ? { firstName: input.firstName || null } : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName || null } : {})
      }
    });
  }

  @Patch("me/notification-preferences")
  async updateNotificationPreferences(@CurrentUser("id") userId: string, @Body() body: unknown) {
    const input = parseInput<Record<string, { email: boolean; inApp: boolean }>>(NotificationPreferencesSchema, body);
    const prisma = await this.prisma();
    return prisma.userPreference.upsert({
      create: { notificationPreferences: input, userId },
      update: { notificationPreferences: input },
      where: { userId }
    });
  }

  @Patch("me/display-preferences")
  async updateDisplayPreferences(@CurrentUser("id") userId: string, @Body() body: unknown) {
    const input = parseInput<z.infer<typeof DisplayPreferencesSchema>>(DisplayPreferencesSchema, body);
    if (input.displayCurrencyAccountId) await this.assertAccountOwnership(userId, input.displayCurrencyAccountId);
    const prisma = await this.prisma();
    return prisma.userPreference.upsert({
      create: { displayCurrencyAccountId: input.displayCurrencyAccountId, timeZone: input.timeZone, userId },
      update: { displayCurrencyAccountId: input.displayCurrencyAccountId, timeZone: input.timeZone },
      where: { userId }
    });
  }

  @Get("me/export")
  async exportData(@CurrentUser("id") userId: string) {
    const prisma = await this.prisma();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        coachProfile: true,
        playbooks: true,
        weeklyReviews: true,
        brokerConnections: {
          include: {
            tradingAccounts: {
              include: {
                propFirmRuleSet: true,
                trades: {
                  include: {
                    journalEntry: true,
                    notes: true,
                    screenshots: true
                  },
                  orderBy: { closeTime: "desc" }
                }
              }
            }
          }
        }
      }
    });
    if (!user) throw new BadRequestException("User not found");
    return {
      exportedAt: new Date().toISOString(),
      format: "tradescribe.settings-export.v1",
      user
    };
  }

  @Post("me/billing-portal")
  async billingPortal(@CurrentUser() currentUser: AuthenticatedUser) {
    const user = await this.userRow(currentUser);
    const provider = user?.subscriptions[0]?.provider ?? "STRIPE";
    return {
      provider,
      url: provider === "PAYSTACK" ? "/settings/billing?provider=paystack" : "/settings/billing?provider=stripe"
    };
  }

  @Delete("me")
  async deleteAccount(@CurrentUser("id") userId: string, @Body() body: unknown) {
    parseInput(DeleteAccountSchema, body);
    const prisma = await this.prisma();
    await prisma.user.delete({ where: { id: userId } });
    return { deleted: true };
  }

  @Get("portfolio")
  async portfolio(@CurrentUser() currentUser: AuthenticatedUser, @Query() query: unknown) {
    const user = await this.userRow(currentUser);
    const plan = user?.plan ?? currentUser.plan;
    const role = user?.role ?? currentUser.role;
    if (plan !== "PRO" && role !== "ADMIN") {
      return { locked: true, reason: "Portfolio view is a Pro feature", accounts: [] };
    }

    const parsed = parseInput<MetricsQuery>(MetricsQuerySchema, query);
    const { current, previous } = resolvePeriod(parsed.granularity, parsed.anchor, parsed.tz);
    const prisma = await this.prisma();
    const accountIds = user?.brokerConnections.flatMap((connection) => connection.tradingAccounts.map((account) => account.id)) ?? [];
    const rows = (await prisma.trade.findMany({
      where: { tradingAccountId: { in: accountIds }, closeTime: { gte: previous.start, lt: current.end } },
      orderBy: { closeTime: "asc" }
    })) as TradeRow[];

    const accounts = await Promise.all(
      (user?.brokerConnections ?? []).flatMap((connection) =>
        connection.tradingAccounts.map(async (account) => {
          const currentRows = rows.filter((row) => row.tradingAccountId === account.id && row.closeTime >= current.start && row.closeTime < current.end);
          const previousRows = rows.filter((row) => row.tradingAccountId === account.id && row.closeTime >= previous.start && row.closeTime < current.start);
          const metrics = computeMetrics({
            trades: currentRows.map(toMetricsTrade),
            previousTrades: previousRows.map(toMetricsTrade),
            equitySnapshots: [],
            startingBalance: account.startingBalance,
            timeZone: parsed.tz
          });
          let riskRoom: Awaited<ReturnType<SignalsService["getGuardrails"]>> = null;
          try {
            riskRoom = await this.signals.getGuardrails(currentUser.id, account.id, { tz: parsed.tz });
          } catch {
            riskRoom = null;
          }
          return {
            id: account.id,
            broker: connection.broker ?? connection.provider,
            name: accountDisplayName(account),
            label: account.label,
            login: account.login,
            maskedLogin: maskLogin(account.login),
            platform: account.platform,
            balance: account.startingBalance,
            equity: account.startingBalance + metrics.netPnl,
            currency: account.currency,
            connectionStatus: statusLabel(connection.status),
            lastError: connection.lastError ?? null,
            lastSyncAt: connection.lastSyncAt?.toISOString() ?? null,
            metrics,
            riskRoom
          };
        })
      )
    );

    return { locked: false, accounts, period: { label: current.label, granularity: parsed.granularity } };
  }

  @Get("me/connections")
  async connections(@CurrentUser() currentUser: AuthenticatedUser) {
    const user = await this.userRow(currentUser);
    const plan = user?.plan ?? currentUser.plan;
    const limit = this.planLimit(plan);
    const connectionRows =
      user?.brokerConnections.map((connection) => ({
        broker: connection.broker ?? connection.provider,
        capabilities: capabilitiesFor(connection.provider, connection.platform),
        id: connection.id,
        lastError: connection.lastError ?? null,
        provider: connection.provider,
        server: connection.server ?? null,
        status: statusLabel(connection.status),
        lastSyncAt: connection.lastSyncAt?.toISOString() ?? null,
        accounts: connection.tradingAccounts.map((account) => ({
          id: account.id,
          brokerConnectionId: connection.id,
          broker: connection.broker ?? connection.provider,
          name: accountDisplayName(account),
          label: account.label,
          login: account.login,
          maskedLogin: maskLogin(account.login),
          platform: account.platform,
          capabilities: capabilitiesFor(connection.provider, account.platform),
          currency: account.currency,
          isPrimary: account.isPrimary,
          balance: account.startingBalance,
          equity: account.startingBalance,
          status: statusLabel(connection.status),
          lastSyncAt: connection.lastSyncAt?.toISOString() ?? null
        }))
      })) ?? [];
    const accountCount = connectionRows.reduce((sum, connection) => sum + connection.accounts.length, 0);
    return {
      connections: connectionRows,
      limits: {
        accountCount,
        canConnectMore: accountCount < limit,
        maxAccounts: Number.isFinite(limit) ? limit : null,
        plan
      }
    };
  }

  @Post("connections")
  async createConnection(@CurrentUser() currentUser: AuthenticatedUser, @Body() body: unknown) {
    const input = parseInput<z.infer<typeof ConnectAccountSchema>>(ConnectAccountSchema, body);
    const user = await this.userRow(currentUser);
    const plan = user?.plan ?? currentUser.plan;
    const limit = this.planLimit(plan);
    const currentCount = await this.accountCount(currentUser.id);
    if (currentCount >= limit) throw new BadRequestException("Account limit reached for your plan");

    const prisma = await this.prisma();
    const connection = (await prisma.brokerConnection.create({
      data: {
        broker: input.broker,
        lastError: null,
        login: input.login,
        platform: input.platform,
        provider: "metaapi",
        server: input.server,
        status: "PENDING",
        userId: currentUser.id
      },
      include: { tradingAccounts: true }
    })) as { id: string; status: string; tradingAccounts: Array<{ id: string }> };

    await this.auditLog.record({
      action: "connection.create",
      actorUserId: currentUser.id,
      metadata: {
        broker: input.broker,
        connectionId: connection.id,
        platform: input.platform,
        server: input.server
      },
      targetId: connection.id,
      targetType: "BrokerConnection",
      targetUserId: currentUser.id
    });

    try {
      await prisma.brokerConnection.update({ where: { id: connection.id }, data: { status: "PROVISIONING" } });
      const provisioned = await this.metaApiAdapter.connect(input);
      if (!provisioned.externalAccountId) throw new MetaApiConnectionError("MetaApi did not return an account id", "degraded");
      const accountInfo = await this.metaApiAdapter.getAccountInfo(provisioned.externalAccountId);
      const account = (await prisma.tradingAccount.create({
        data: {
          brokerConnectionId: connection.id,
          currency: (accountInfo.currency ?? input.currency).toUpperCase(),
          isPrimary: currentCount === 0,
          label: input.label?.trim() || null,
          login: input.login,
          name: accountInfo.name ?? `${input.broker} ${input.server}`,
          platform: input.platform,
          startingBalance: accountInfo.balance || input.startingBalance
        }
      })) as { id: string };

      await prisma.brokerConnection.update({
        where: { id: connection.id },
        data: {
          lastError: null,
          metaApiAccountId: provisioned.externalAccountId,
          status: "SYNCING"
        }
      });

      await prisma.userPreference.upsert({
        create: { activeAccountId: account.id, userId: currentUser.id },
        update: { activeAccountId: account.id },
        where: { userId: currentUser.id }
      });

      await prisma.equitySnapshot.create({
        data: {
          balance: accountInfo.balance || input.startingBalance,
          equity: accountInfo.equity || accountInfo.balance || input.startingBalance,
          tradingAccountId: account.id,
          ts: new Date()
        }
      });

      return { accountId: account.id, id: connection.id, status: "SYNCING" };
    } catch (error) {
      const lastError = humanConnectionError(error);
      const status = errorStatus(error);
      await prisma.brokerConnection.update({
        where: { id: connection.id },
        data: { lastError, status }
      });
      return { accountId: null, id: connection.id, lastError, status };
    }
  }

  @Post("imports/csv/preview")
  async previewCsv(@Body() body: unknown) {
    const input = parseInput<z.infer<typeof CsvPreviewSchema>>(CsvPreviewSchema, body);
    return previewCsvImport(input.content, input.mapping as CsvColumnMapping | undefined, { accountCurrency: input.currency });
  }

  @Post("imports/csv/commit")
  async commitCsv(@CurrentUser() currentUser: AuthenticatedUser, @Body() body: unknown) {
    const input = parseInput<z.infer<typeof CsvCommitSchema>>(CsvCommitSchema, body);
    const parsed = parseDelimited(input.content);
    const preview = previewCsvImport(input.content, input.mapping as CsvColumnMapping | undefined, { accountCurrency: input.currency });
    const normalized = normalizeCsvRecords(parsed.records, preview.mapping, { accountCurrency: input.currency });
    if (normalized.trades.length === 0) throw new BadRequestException("No valid trades found in CSV");

    const prisma = await this.prisma();
    const existingAccount = (await prisma.tradingAccount.findFirst({
      where: {
        label: input.label,
        brokerConnection: { broker: input.broker, provider: "csv", userId: currentUser.id }
      },
      include: { brokerConnection: true }
    })) as { brokerConnectionId: string; id: string } | null;

    let tradingAccountId = existingAccount?.id;
    let connectionId = existingAccount?.brokerConnectionId;

    if (!tradingAccountId) {
      const user = await this.userRow(currentUser);
      const limit = this.planLimit(user?.plan ?? currentUser.plan);
      const currentCount = await this.accountCount(currentUser.id);
      if (currentCount >= limit) throw new BadRequestException("Account limit reached for your plan");

      const connection = (await prisma.brokerConnection.create({
        data: {
          broker: input.broker,
          lastError: null,
          login: input.label,
          platform: "CSV",
          provider: "csv",
          server: "csv-import",
          status: "CONNECTED",
          userId: currentUser.id,
          tradingAccounts: {
            create: {
              currency: input.currency.toUpperCase(),
              isPrimary: currentCount === 0,
              label: input.label,
              login: `csv:${input.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
              name: input.label,
              platform: "CSV",
              startingBalance: input.startingBalance
            }
          }
        },
        include: { tradingAccounts: true }
      })) as { id: string; tradingAccounts: Array<{ id: string }> };
      tradingAccountId = connection.tradingAccounts[0]?.id;
      connectionId = connection.id;
      if (!tradingAccountId) throw new BadRequestException("Could not create CSV import account");
      await prisma.equitySnapshot.create({
        data: {
          balance: input.startingBalance,
          equity: input.startingBalance,
          tradingAccountId,
          ts: new Date()
        }
      });
    }

    const externalIds = normalized.trades.map((trade) => trade.externalId);
    const existingTrades = (await prisma.trade.findMany({
      where: { externalId: { in: externalIds }, tradingAccountId },
      select: { externalId: true }
    })) as Array<{ externalId: string }>;
    const existingIds = new Set(existingTrades.map((trade) => trade.externalId));

    let created = 0;
    let updated = 0;
    for (const trade of normalized.trades) {
      const existed = existingIds.has(trade.externalId);
      await prisma.trade.upsert({
        where: { tradingAccountId_externalId: { externalId: trade.externalId, tradingAccountId } },
        create: {
          brokerTimeZone: trade.brokerTimeZone,
          closePrice: trade.closePrice,
          closeTime: trade.closeTime,
          commission: trade.commission,
          durationSec: trade.durationSec,
          externalId: trade.externalId,
          grossProfit: trade.grossProfit,
          openPrice: trade.openPrice,
          openTime: trade.openTime,
          rMultiple: trade.rMultiple,
          riskAmount: trade.riskAmount,
          session: trade.session,
          side: trade.side,
          stopLoss: trade.stopLoss,
          swap: trade.swap,
          symbol: trade.symbol,
          takeProfit: trade.takeProfit,
          tradingAccountId,
          volume: trade.volume
        },
        update: {
          brokerTimeZone: trade.brokerTimeZone,
          closePrice: trade.closePrice,
          closeTime: trade.closeTime,
          commission: trade.commission,
          durationSec: trade.durationSec,
          grossProfit: trade.grossProfit,
          openPrice: trade.openPrice,
          openTime: trade.openTime,
          rMultiple: trade.rMultiple,
          riskAmount: trade.riskAmount,
          session: trade.session,
          side: trade.side,
          stopLoss: trade.stopLoss,
          swap: trade.swap,
          symbol: trade.symbol,
          takeProfit: trade.takeProfit,
          volume: trade.volume
        }
      });
      if (existed) updated += 1;
      else created += 1;
    }

    if (connectionId) {
      await prisma.brokerConnection.update({ where: { id: connectionId }, data: { lastError: null, lastSyncAt: new Date(), status: "CONNECTED" } });
    }

    await prisma.userPreference.upsert({
      create: { activeAccountId: tradingAccountId, userId: currentUser.id },
      update: { activeAccountId: tradingAccountId },
      where: { userId: currentUser.id }
    });

    await this.auditLog.record({
      action: "connection.csv_import",
      actorUserId: currentUser.id,
      metadata: { broker: input.broker, created, label: input.label, rows: normalized.trades.length, updated },
      targetId: connectionId,
      targetType: "BrokerConnection",
      targetUserId: currentUser.id
    });

    return {
      accountId: tradingAccountId,
      connectionId,
      created,
      errors: normalized.errors.slice(0, 25),
      skipped: normalized.skipped,
      totalRows: parsed.records.length,
      updated
    };
  }

  @Get("connections/:id")
  async connectionStatus(@CurrentUser("id") userId: string, @Param("id") connectionId: string) {
    const prisma = await this.prisma();
    await this.assertConnectionOwnership(userId, connectionId);
    return prisma.brokerConnection.findUnique({
      where: { id: connectionId },
      include: { tradingAccounts: true }
    });
  }

  @Patch("accounts/:id/label")
  async updateAccountLabel(@CurrentUser("id") userId: string, @Param("id") accountId: string, @Body() body: unknown) {
    await this.assertAccountOwnership(userId, accountId);
    const input = parseInput<{ label: string | null }>(LabelSchema, body);
    const prisma = await this.prisma();
    return prisma.tradingAccount.update({
      where: { id: accountId },
      data: { label: input.label?.trim() || null }
    });
  }

  @Post("connections/:id/sync")
  async syncConnection(@CurrentUser("id") userId: string, @Param("id") connectionId: string) {
    await this.assertConnectionOwnership(userId, connectionId);
    const prisma = await this.prisma();
    return prisma.brokerConnection.update({
      where: { id: connectionId },
      data: { lastError: null, status: "SYNCING" }
    });
  }

  @Delete("connections/:id")
  async disconnect(@CurrentUser("id") userId: string, @Param("id") connectionId: string, @Body() body: unknown) {
    const connection = await this.assertConnectionOwnership(userId, connectionId);
    const input = parseInput<{ deleteTradeHistory: boolean }>(DisconnectSchema, body ?? {});
    const prisma = await this.prisma();
    await this.auditLog.record({
      action: "connection.delete",
      actorUserId: userId,
      metadata: { deleteTradeHistory: input.deleteTradeHistory },
      targetId: connectionId,
      targetType: "BrokerConnection",
      targetUserId: userId
    });
    if (connection.metaApiAccountId) {
      await this.metaApiAdapter.disconnect(connection.metaApiAccountId).catch(() => undefined);
    }
    if (input.deleteTradeHistory) {
      return prisma.brokerConnection.delete({ where: { id: connectionId } });
    }
    return prisma.brokerConnection.update({
      where: { id: connectionId },
      data: { lastError: "Disconnected by user", status: "DISCONNECTED" }
    });
  }
}

@Module({
  controllers: [AccountsController],
  providers: [AuditLogService, PrismaService, RedisService, SignalsService]
})
export class AccountsModule {}
