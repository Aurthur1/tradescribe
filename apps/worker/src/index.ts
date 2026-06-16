import "./instrument.js";
import { Queue, Worker, type ConnectionOptions } from "bullmq";
import { QUEUES } from "@tradescribe/shared";
import { getPrismaClient } from "@tradescribe/db";
import { runJournalGenerateJob, runWeeklyReviewJob } from "./ai-jobs.js";
import { runConnectionBackfillJob, runConnectionSyncJob } from "./connection-jobs.js";
import { runGuardrailCheckJob, runLeaksDetectJob } from "./signals-jobs.js";

const redisUrl = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
const connection: ConnectionOptions = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  username: redisUrl.username || undefined,
  password: redisUrl.password || undefined,
  db: Number(redisUrl.pathname.replace("/", "") || 0),
  maxRetriesPerRequest: null,
  tls: redisUrl.protocol === "rediss:" ? {} : undefined
};

const maintenanceQueue = new Queue(QUEUES.maintenance, { connection });

const worker = new Worker(
  QUEUES.maintenance,
  async (job) => {
    if (job.name === "noop") {
      return {
        ok: true,
        processedAt: new Date().toISOString()
      };
    }

    if (job.name === "leaks.detect") {
      return runLeaksDetectJob(job.data as { tradingAccountId: string; periodStart?: string; periodEnd?: string; timeZone?: string });
    }

    if (job.name === "guardrail.check") {
      return runGuardrailCheckJob(job.data as { tradingAccountId: string; timeZone?: string });
    }

    if (job.name === "journal.generate") {
      return runJournalGenerateJob(job.data as { tradingAccountId: string; limit?: number; tradeIds?: string[] });
    }

    if (job.name === "review.weekly") {
      return runWeeklyReviewJob(job.data as { tradingAccountId: string; periodStart?: string; periodEnd?: string; scheduled?: boolean });
    }

    if (job.name === "connection.backfill") {
      return runConnectionBackfillJob(job.data as { connectionId: string });
    }

    if (job.name === "connection.sync") {
      return runConnectionSyncJob(job.data as { connectionId: string });
    }

    if (job.name === "connection.sync.all") {
      const prisma = (await getPrismaClient()) as unknown as {
        brokerConnection: { findMany(input: unknown): Promise<Array<{ id: string }>> };
      };
      const connections = await prisma.brokerConnection.findMany({
        where: { status: { in: ["SYNCING", "CONNECTED", "DEGRADED"] }, metaApiAccountId: { not: null } },
        select: { id: true, lastSyncAt: true, status: true }
      }) as Array<{ id: string; lastSyncAt: Date | null; status: string }>;
      for (const connection of connections) {
        const name = connection.status === "SYNCING" && !connection.lastSyncAt ? "connection.backfill" : "connection.sync";
        await maintenanceQueue.add(name, { connectionId: connection.id }, { attempts: 3, backoff: { delay: 60_000, type: "exponential" } });
      }
      return { queued: connections.length };
    }

    throw new Error(`Unknown job: ${job.name}`);
  },
  { connection }
);

worker.on("completed", (job) => {
  console.info({ jobId: job.id, jobName: job.name }, "job completed");
});

worker.on("failed", (job, error) => {
  console.error({ jobId: job?.id, jobName: job?.name, error }, "job failed");
});

await maintenanceQueue.upsertJobScheduler("noop-every-minute", {
  every: 60_000
});

await maintenanceQueue.upsertJobScheduler("connection-sync-every-15-minutes", {
  every: 15 * 60_000
}, {
  name: "connection.sync.all"
});

console.info({ queue: QUEUES.maintenance }, "TradeScribe worker started");
