import { Module } from "@nestjs/common";
import { AdminModule } from "./admin/admin.controller.js";
import { AppController } from "./app.controller.js";
import { AccountsModule } from "./accounts/accounts.controller.js";
import { AuthModule } from "./auth/auth.module.js";
import { DashboardLayoutModule } from "./dashboard-layout/dashboard-layout.controller.js";
import { MetricsModule } from "./metrics/metrics.controller.js";
import { PlaybooksModule } from "./playbooks/playbooks.controller.js";
import { ReviewsModule } from "./reviews/reviews.controller.js";
import { SearchModule } from "./search/search.controller.js";
import { SignalsModule } from "./signals/signals.controller.js";

@Module({
  imports: [AdminModule, AccountsModule, AuthModule, DashboardLayoutModule, MetricsModule, PlaybooksModule, ReviewsModule, SearchModule, SignalsModule],
  controllers: [AppController]
})
export class AppModule {}
