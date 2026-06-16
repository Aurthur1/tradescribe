import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { RequestWithUser } from "./auth.types.js";

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (request.user?.role !== "ADMIN") {
      throw new ForbiddenException("Admin access required");
    }

    return true;
  }
}
