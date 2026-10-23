import { Injectable, Logger } from '@nestjs/common';
import { loadConfig } from '../config';

interface CostResult {
  properties: { columns: Array<{ name: string }>; rows: unknown[][] };
}

/** Cost Management query rows → total, per service and per day (pure, unit-tested). */
export function summarizeCosts(result: CostResult) {
  const col = (name: string) =>
    result.properties.columns.findIndex((c) => c.name.toLowerCase() === name.toLowerCase());
  const [cost, date, service, currency] = [
    col('Cost'),
    col('UsageDate'),
    col('ServiceName'),
    col('Currency'),
  ];
  const byService = new Map<string, number>();
  const daily = new Map<string, number>();
  let total = 0;
  let cur = 'CHF';
  for (const row of result.properties.rows) {
    const amount = Number(row[cost] ?? 0);
    total += amount;
    if (currency >= 0 && row[currency]) cur = String(row[currency]);
    if (service >= 0) {
      const name = String(row[service] || 'Other');
      byService.set(name, (byService.get(name) ?? 0) + amount);
    }
    if (date >= 0) {
      const d = String(row[date]); // 20261022
      const day = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
      daily.set(day, (daily.get(day) ?? 0) + amount);
    }
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    currency: cur,
    total: round(total),
    byService: [...byService]
      .map(([name, amount]) => ({ name, amount: round(amount) }))
      .sort((a, b) => b.amount - a.amount),
    daily: [...daily]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, amount]) => ({ day, amount: round(amount) })),
  };
}

/**
 * Last calendar month (UTC) as an explicit period: not every subscription type accepts the
 * "TheLastMonth" shortcut (Azure answered "timeframe TheLastMonth is currently not supported").
 */
export function lastMonthPeriod(now: Date) {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59));
  return { from: from.toISOString(), to: to.toISOString() };
}

/** This month's total at today's pace: cost so far ÷ days gone × days in the month. */
export function monthForecast(soFar: number, now: Date) {
  const days = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const gone = now.getUTCDate() - 1 + now.getUTCHours() / 24 + now.getUTCMinutes() / 1440;
  return Math.round((soFar / Math.max(gone, 1)) * days * 100) / 100;
}

/** Azure's error code and message from a failed answer (short, for the owner dashboard). */
async function reason(res: Response): Promise<string> {
  const text = await res.text().catch(() => '');
  try {
    const body = JSON.parse(text) as {
      error?: { code?: string; message?: string } | string;
      error_description?: string;
    };
    const e = body.error;
    const out =
      typeof e === 'object'
        ? `${e.code ?? ''} ${e.message ?? ''}`
        : `${e ?? ''} ${body.error_description ?? ''}`;
    return out.trim().slice(0, 300) || text.slice(0, 300);
  } catch {
    return text.slice(0, 300);
  }
}

/**
 * Azure costs of Seatline's resource group for the owner dashboard, read with the apps'
 * managed identity (role "Cost Management Reader", see infra/azure/owner-setup.sh). Azure
 * updates cost data a few times a day; results are kept 15 minutes.
 */
@Injectable()
export class AzureCostService {
  private readonly logger = new Logger(AzureCostService.name);
  private readonly config = loadConfig();
  private cache: { at: number; value: Awaited<ReturnType<AzureCostService['load']>> } | null = null;

  get configured() {
    return !!(
      this.config.COST_SCOPE &&
      this.config.COST_IDENTITY_CLIENT_ID &&
      process.env.IDENTITY_ENDPOINT &&
      process.env.IDENTITY_HEADER
    );
  }

  async summary() {
    if (!this.configured) return null;
    if (this.cache && Date.now() - this.cache.at < 15 * 60_000) return this.cache.value;
    try {
      const value = await this.load();
      this.cache = { at: Date.now(), value };
      return value;
    } catch (error) {
      const detail = (error as Error).message;
      this.logger.warn(`Azure costs could not be read: ${detail}`);
      // the owner sees Azure's own reason (e.g. a missing role), so setup problems are visible
      return { error: 'unavailable' as const, detail };
    }
  }

  private async load() {
    const token = await this.token();
    const query = (
      timeframe: 'MonthToDate' | 'Custom',
      grouping: boolean,
      timePeriod?: { from: string; to: string },
    ) =>
      fetch(
        `https://management.azure.com${this.config.COST_SCOPE}/providers/Microsoft.CostManagement/query?api-version=2023-11-01`,
        {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            type: 'ActualCost',
            timeframe,
            ...(timePeriod && { timePeriod }),
            dataset: {
              granularity: grouping ? 'Daily' : 'None',
              aggregation: { totalCost: { name: 'Cost', function: 'Sum' } },
              ...(grouping && { grouping: [{ type: 'Dimension', name: 'ServiceName' }] }),
            },
          }),
          signal: AbortSignal.timeout(20_000),
        },
      ).then(async (res) => {
        if (!res.ok)
          throw new Error(`Cost Management answered ${res.status}: ${await reason(res)}`);
        return summarizeCosts((await res.json()) as CostResult);
      });
    const now = new Date();
    const [month, lastMonth] = await Promise.all([
      query('MonthToDate', true),
      // a nice-to-have: if only last month fails, this month still shows
      query('Custom', false, lastMonthPeriod(now)).catch((error: Error) => {
        this.logger.warn(`Azure costs of last month could not be read: ${error.message}`);
        return null;
      }),
    ]);
    return {
      ...month,
      forecast: monthForecast(month.total, now),
      lastMonth: lastMonth?.total ?? null,
      at: now.toISOString(),
    };
  }

  private async token(): Promise<string> {
    const url = new URL(process.env.IDENTITY_ENDPOINT!);
    url.searchParams.set('resource', 'https://management.azure.com/');
    url.searchParams.set('api-version', '2019-08-01');
    url.searchParams.set('client_id', this.config.COST_IDENTITY_CLIENT_ID!);
    const res = await fetch(url, {
      headers: { 'X-IDENTITY-HEADER': process.env.IDENTITY_HEADER! },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Managed identity answered ${res.status}: ${await reason(res)}`);
    return ((await res.json()) as { access_token: string }).access_token;
  }
}
