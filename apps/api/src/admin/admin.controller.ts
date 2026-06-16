import { Controller, Get, Module, UseGuards } from "@nestjs/common";
import { AdminGuard } from "../auth/admin.guard.js";
import { AuthGuard } from "../auth/auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";

@Controller("admin")
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  @Get("me")
  me(@CurrentUser() user: AuthenticatedUser) {
    return { user };
  }
}

@Module({
  controllers: [AdminController]
})
export class AdminModule {}
