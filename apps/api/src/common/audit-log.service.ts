import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { redactMetadata } from "./redact.js";

export interface AuditLogInput {
  actorUserId: string;
  action: string;
  targetUserId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: unknown;
  ip?: string | null;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prismaService: PrismaService) {}

  async record(input: AuditLogInput) {
    const prisma = await this.prismaService.client();
    return prisma.auditLog.create({
      data: {
        action: input.action,
        actorUserId: input.actorUserId,
        ip: input.ip ?? null,
        metadata: input.metadata === undefined ? undefined : redactMetadata(input.metadata),
        targetId: input.targetId ?? null,
        targetType: input.targetType ?? null,
        targetUserId: input.targetUserId ?? null
      }
    });
  }
}
