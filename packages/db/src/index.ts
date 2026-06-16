type PrismaClientLike = {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
};

type PrismaClientConstructor = new () => PrismaClientLike;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClientLike;
};

export async function getPrismaClient() {
  if (!globalForPrisma.prisma) {
    const clientModuleName = "@prisma/client";
    const { PrismaClient } = (await import(clientModuleName)) as {
      PrismaClient: PrismaClientConstructor;
    };

    globalForPrisma.prisma = new PrismaClient();
  }

  return globalForPrisma.prisma;
}
