import { afterEach, describe, expect, it } from 'vitest';
import {
  configure,
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
  getLocale,
} from '../src/format/index.js';

afterEach(() => {
  configure({ locale: 'fr-FR' });
});

describe('configure / getLocale', () => {
  it('defaults to fr-FR', () => {
    expect(getLocale()).toBe('fr-FR');
  });

  it('changes the default locale and rejects unknown ones', () => {
    configure({ locale: 'en-US' });
    expect(getLocale()).toBe('en-US');
    expect(() => {
      configure({ locale: 'de-DE' as 'fr-FR' });
    }).toThrow(RangeError);
  });

  it('ignores an empty config', () => {
    configure({ locale: 'en-US' });
    configure({});
    expect(getLocale()).toBe('en-US');
  });
});

describe('formatNumber', () => {
  it('uses a comma decimal and narrow no-break space grouping in fr-FR', () => {
    expect(formatNumber(1234.5, { decimals: 1 })).toBe('1\u00a0234,5');
  });

  it('uses a dot and comma in en-US', () => {
    expect(formatNumber(1234.5, { decimals: 1, locale: 'en-US' })).toBe('1,234.5');
  });

  it('keeps integers short when no decimals are given', () => {
    expect(formatNumber(10)).toBe('10');
    expect(formatNumber(3.5)).toBe('3,5');
  });

  it('follows the configured default locale', () => {
    configure({ locale: 'en-US' });
    expect(formatNumber(1000)).toBe('1,000');
  });
});

describe('formatPercent', () => {
  it('formats a ratio as a percentage with one decimal by default', () => {
    expect(formatPercent(0.1234)).toBe('12,3\u202f%');
  });

  it('accepts a decimals option and the en-US locale', () => {
    expect(formatPercent(0.024, { decimals: 1, locale: 'en-US' })).toBe('2.4%');
  });
});

describe('formatCurrency', () => {
  it('puts the euro sign after the amount in fr-FR', () => {
    expect(formatCurrency(1234.5)).toBe('1\u00a0234,50\u00a0€');
  });

  it('puts the dollar sign before the amount in en-US', () => {
    expect(formatCurrency(1234.5, { locale: 'en-US' })).toBe('$1,234.50');
  });

  it('accepts a custom symbol and decimals', () => {
    expect(formatCurrency(12, { symbol: 'CHF', decimals: 0 })).toBe('12\u00a0CHF');
  });
});

describe('formatDate', () => {
  const date = new Date(2026, 0, 3, 14, 5, 9);

  it('uses day/month/year in fr-FR', () => {
    expect(formatDate(date)).toBe('03/01/2026');
  });

  it('uses month/day/year in en-US', () => {
    expect(formatDate(date, { locale: 'en-US' })).toBe('1/3/2026');
  });

  it('accepts a custom pattern in French month names', () => {
    expect(formatDate(date, { pattern: '%d %B %Y' })).toBe('03 janvier 2026');
  });

  it('formats times with a custom pattern', () => {
    expect(formatDate(date, { pattern: '%H:%M' })).toBe('14:05');
  });
});
