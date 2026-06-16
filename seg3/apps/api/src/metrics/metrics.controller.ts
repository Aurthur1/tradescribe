import { Controller, Get, Param, Query, UseGuards, UsePipes, Module } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe'; // wrap zod parsing
import { AuthGuard } from '../auth/auth.guard'; // your Segment 1 guard
import { CurrentUser } from '../auth/current-user.decorator';
import { MetricsService } from './metrics.service';
import { MetricsQuerySchema, TradesQuerySchema, type MetricsQuery, type TradesQuery } from './metrics.dto';

@Controller()
@UseGuards(AuthGuard)
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('accounts/:id/metrics')
  @UsePipes(new ZodValidationPipe(MetricsQuerySchema, 'query'))
  getMetrics(@CurrentUser('id') userId: string, @Param('id') accountId: string, @Query() q: MetricsQuery) {
    return this.metrics.getMetrics(userId, accountId, q);
  }

  @Get('accounts/:id/trades')
  @UsePipes(new ZodValidationPipe(TradesQuerySchema, 'query'))
  getTrades(@CurrentUser('id') userId: string, @Param('id') accountId: string, @Query() q: TradesQuery) {
    return this.metrics.getTrades(userId, accountId, q);
  }

  @Get('trades/:id')
  getTrade(@CurrentUser('id') userId: string, @Param('id') tradeId: string) {
    return this.metrics.getTrade(userId, tradeId);
  }
}

@Module({
  controllers: [MetricsController],
  providers: [MetricsService],
})
export class MetricsModule {}
