import { ForbiddenException } from "@nestjs/common";

type PrismaModelDelegate = {
  count?(input: unknown): Promise<unknown>;
  deleteMany?(input: unknown): Promise<unknown>;
  findFirst(input: unknown): Promise<unknown>;
  findMany(input: unknown): Promise<unknown>;
  updateMany?(input: unknown): Promise<unknown>;
};

type PrismaWithAccounts = {
  tradingAccount: {
    findFirst(input: unknown): Promise<unknown>;
  };
};

export class TenantScopedRepository<T> {
  constructor(
    private readonly delegate: PrismaModelDelegate,
    private readonly userField = "userId"
  ) {}

  findMany(userId: string, where: Record<string, unknown> = {}) {
    return this.delegate.findMany({ where: { ...where, [this.userField]: userId } }) as Promise<T[]>;
  }

  findById(userId: string, id: string) {
    return this.delegate.findFirst({ where: { id, [this.userField]: userId } }) as Promise<T | null>;
  }

  updateById(userId: string, id: string, data: Record<string, unknown>) {
    if (!this.delegate.updateMany) throw new Error("Model delegate does not support updateMany");
    return this.delegate.updateMany({ data, where: { id, [this.userField]: userId } });
  }

  deleteById(userId: string, id: string) {
    if (!this.delegate.deleteMany) throw new Error("Model delegate does not support deleteMany");
    return this.delegate.deleteMany({ where: { id, [this.userField]: userId } });
  }
}

export async function assertAccountOwnership<TSelect extends Record<string, boolean>>(
  prisma: PrismaWithAccounts,
  userId: string,
  accountId: string,
  select?: TSelect
) {
  const account = await prisma.tradingAccount.findFirst({
    where: { id: accountId, brokerConnection: { userId } },
    select: select ?? { id: true }
  });

  if (!account) {
    throw new ForbiddenException("Account not found or not yours");
  }

  return account;
}
