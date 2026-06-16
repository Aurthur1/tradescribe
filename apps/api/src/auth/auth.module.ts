import { Global, Module } from "@nestjs/common";
import { AuditLogService } from "../common/audit-log.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { AdminGuard } from "./admin.guard.js";
import { AuthGuard } from "./auth.guard.js";

@Global()
@Module({
  exports: [AdminGuard, AuditLogService, AuthGuard],
  providers: [AdminGuard, AuditLogService, AuthGuard, PrismaService]
})
export class AuthModule {}
