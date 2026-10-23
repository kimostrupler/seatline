import { describe, expect, it } from 'vitest';
import { lastMonthPeriod, monthForecast, summarizeCosts } from './azure-cost';

describe('Azure costs for the owner dashboard', () => {
  it('adds up per service and per day', () => {
    const s = summarizeCosts({
      properties: {
        columns: [
          { name: 'Cost' },
          { name: 'UsageDate' },
          { name: 'ServiceName' },
          { name: 'Currency' },
        ],
        rows: [
          [0.5, 20261021, 'Azure Database for PostgreSQL', 'CHF'],
          [0.25, 20261021, 'Azure Container Apps', 'CHF'],
          [0.5, 20261022, 'Azure Database for PostgreSQL', 'CHF'],
        ],
      },
    });
    expect(s).toEqual({
      currency: 'CHF',
      total: 1.25,
      byService: [
        { name: 'Azure Database for PostgreSQL', amount: 1 },
        { name: 'Azure Container Apps', amount: 0.25 },
      ],
      daily: [
        { day: '2026-10-21', amount: 0.75 },
        { day: '2026-10-22', amount: 0.5 },
      ],
    });
  });

  it('asks for last month with explicit dates (also across new year)', () => {
    expect(lastMonthPeriod(new Date('2026-10-23T22:00:00Z'))).toEqual({
      from: '2026-09-01T00:00:00.000Z',
      to: '2026-09-30T23:59:59.000Z',
    });
    expect(lastMonthPeriod(new Date('2027-01-05T08:00:00Z'))).toEqual({
      from: '2026-12-01T00:00:00.000Z',
      to: '2026-12-31T23:59:59.000Z',
    });
  });

  it('forecasts the month at today’s pace', () => {
    // 10 CHF after 10 full days of a 31-day month → 31 CHF
    expect(monthForecast(10, new Date('2026-10-11T00:00:00Z'))).toBe(31);
    // the first day: no wild guess from a few hours
    expect(monthForecast(1, new Date('2026-10-01T06:00:00Z'))).toBe(31);
  });
});
