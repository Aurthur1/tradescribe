import type { CoreMetrics, MetricsTrade, ProfitFactorReason } from './types.js';
import { netProfit, isWin, isLoss, isBreakeven, resolveRMultiple, durationSeconds, mean, sum } from './util.js';

/**
 * Compute the core performance statistics for a set of closed trades.
 * Pure and deterministic. Handles every edge case explicitly:
 *  - empty set            -> zeros, profitFactor null (no_trades), R stats null
 *  - all winners          -> profitFactor null (no_losses, effectively infinite)
 *  - all losers           -> profitFactor 0
 *  - no stop losses        -> R stats null
 */
export function computeCoreMetrics(trades: MetricsTrade[]): CoreMetrics {
  const total = trades.length;

  const winners = trades.filter(isWin);
  const losers = trades.filter(isLoss);
  const breakeven = trades.filter(isBreakeven);

  const nets = trades.map(netProfit);
  const winnerNets = winners.map(netProfit);
  const loserNets = losers.map(netProfit); // negative values

  const netPnl = sum(nets);
  const grossWin = sum(winnerNets); // >= 0
  const grossLoss = sum(loserNets); // <= 0

  const winRate = total === 0 ? 0 : winners.length / total;
  const avgWin = winners.length === 0 ? 0 : grossWin / winners.length;
  const avgLoss = losers.length === 0 ? 0 : grossLoss / losers.length; // <= 0

  // Profit factor, guarded against divide-by-zero.
  let profitFactor: number | null;
  let profitFactorReason: ProfitFactorReason;
  if (total === 0) {
    profitFactor = null;
    profitFactorReason = 'no_trades';
  } else if (grossLoss === 0) {
    // Wins but no losses: mathematically infinite. Represent as null + reason.
    profitFactor = grossWin === 0 ? 0 : null;
    profitFactorReason = grossWin === 0 ? null : 'no_losses';
  } else {
    profitFactor = grossWin / Math.abs(grossLoss);
    profitFactorReason = null;
  }

  // Expectancy in account currency. avgLoss is already negative.
  const expectancyCurrency = total === 0 ? 0 : winRate * avgWin + (1 - winRate) * avgLoss;

  // R-multiple based stats. Only over trades that actually have an R value.
  const rOf = (t: MetricsTrade) => resolveRMultiple(t);
  const winnerRs = winners.map(rOf).filter((r): r is number => r !== null);
  const loserRs = losers.map(rOf).filter((r): r is number => r !== null);
  const allRs = trades.map(rOf).filter((r): r is number => r !== null);

  const avgWinR = winnerRs.length ? mean(winnerRs) : null;
  const avgLossR = loserRs.length ? mean(loserRs) : null;
  const expectancyR = allRs.length ? mean(allRs) : null;

  const holds = trades.map(durationSeconds);
  const avgHoldSeconds = total === 0 ? null : mean(holds);

  return {
    netPnl,
    grossWin,
    grossLoss,
    totalTrades: total,
    winningTrades: winners.length,
    losingTrades: losers.length,
    breakevenTrades: breakeven.length,
    winRate,
    avgWin,
    avgLoss,
    profitFactor,
    profitFactorReason,
    expectancyCurrency,
    avgWinR,
    avgLossR,
    expectancyR,
    avgHoldSeconds,
  };
}
