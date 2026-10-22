import { describe, expect, it } from 'vitest';
import { summarizeCosts } from './azure-cost';

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
});
