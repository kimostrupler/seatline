import { describe, expect, it } from 'vitest';
import { withPoolSize } from './prisma.service';

describe('database pool size', () => {
  it('is added to the URL unless it already sets one', () => {
    expect(withPoolSize('postgresql://u:p@h:5432/db', 5)).toBe(
      'postgresql://u:p@h:5432/db?connection_limit=5',
    );
    expect(withPoolSize('postgresql://u:p@h:5432/db?sslmode=require', 5)).toBe(
      'postgresql://u:p@h:5432/db?sslmode=require&connection_limit=5',
    );
    // an explicit setting in the URL wins
    expect(withPoolSize('postgresql://u:p@h/db?connection_limit=12&sslmode=require', 5)).toBe(
      'postgresql://u:p@h/db?connection_limit=12&sslmode=require',
    );
  });
});
