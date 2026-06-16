import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthenticatedUser, RequestWithUser } from "./auth.types.js";

export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    return field && user ? user[field] : user;
  }
);
