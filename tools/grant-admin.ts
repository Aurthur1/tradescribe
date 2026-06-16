import { getPrismaClient } from "../packages/db/src/index.js";

function redactMetadata<T>(value: T): T {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => redactMetadata(item)) as T;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      /password|token|secret|key/i.test(key) ? "[REDACTED]" : redactMetadata(entry)
    ])
  ) as T;
}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: pnpm grant-admin <email>");
    process.exitCode = 1;
    return;
  }

  const prisma = await getPrismaClient();
  await prisma.$connect();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user found for ${email}`);
    process.exitCode = 1;
    await prisma.$disconnect();
    return;
  }

  const updated = await prisma.user.update({
    data: { role: "ADMIN" },
    where: { id: user.id }
  });

  await prisma.auditLog.create({
    data: {
      action: "role.grant",
      actorUserId: "system",
      metadata: redactMetadata({ email, source: "cli" }),
      targetUserId: updated.id
    }
  });

  await prisma.$disconnect();
  console.log(`Granted ADMIN role to ${updated.email}`);
}

void main();
