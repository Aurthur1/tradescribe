import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { getPrismaClient } from "@tradescribe/db";

interface PrismaDelegate {
  count(input: unknown): Promise<unknown>;
  create(input: unknown): Promise<unknown>;
  delete(input: unknown): Promise<unknown>;
  findFirst(input: unknown): Promise<unknown>;
  findMany(input: unknown): Promise<unknown>;
  findUnique(input: unknown): Promise<unknown>;
  update(input: unknown): Promise<unknown>;
  upsert(input: unknown): Promise<unknown>;
}

type PrismaClientRuntime = Awaited<ReturnType<typeof getPrismaClient>> & {
  $transaction<T>(operations: Promise<T>[]): Promise<T[]>;
  alert: PrismaDelegate;
  adviceLog: PrismaDelegate;
  auditLog: PrismaDelegate;
  brokerConnection: PrismaDelegate;
  coachProfile: PrismaDelegate;
  equitySnapshot: PrismaDelegate;
  dashboardLayout: PrismaDelegate;
  leakFlag: PrismaDelegate;
  playbook: PrismaDelegate;
  propFirmRuleSet: PrismaDelegate;
  trade: PrismaDelegate;
  tradeNote: PrismaDelegate;
  tradeScreenshot: PrismaDelegate;
  tradingAccount: PrismaDelegate;
  user: PrismaDelegate;
  userPreference: PrismaDelegate;
  weeklyReview: PrismaDelegate;
};

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private prisma?: PrismaClientRuntime;

  async onModuleInit() {
    await this.client();
  }

  async onModuleDestroy() {
    if (this.prisma) {
      await this.prisma.$disconnect();
    }
  }

  async client(): Promise<PrismaClientRuntime> {
    if (!this.prisma) {
      this.prisma = (await getPrismaClient()) as PrismaClientRuntime;
      await this.prisma.$connect();
    }

    return this.prisma;
  }
}
