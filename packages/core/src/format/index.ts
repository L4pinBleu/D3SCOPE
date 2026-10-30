/**
 * Locale-aware formatting (PLAN.md §8 `format/`): numbers, percentages,
 * currency and dates. Built on d3-format and d3-time-format.
 *
 * The default locale is `fr-FR`. Change it for the whole library with
 * `configure({ locale: 'en-US' })`, or per call with the `locale` option.
 * Locale data is copied from the d3 locale files (ISC).
 */
import { formatLocale, type FormatLocaleDefinition } from 'd3-format';
import { timeFormatLocale, type TimeLocaleDefinition } from 'd3-time-format';

export type LocaleName = 'fr-FR' | 'en-US';

export interface CurrencyDefinition {
  symbol: string;
  /** `prefix`: `$1,00`. `suffix`: `1,00 €`. */
  position: 'prefix' | 'suffix';
}

export interface LocaleDefinition {
  number: FormatLocaleDefinition;
  time: TimeLocaleDefinition;
  currency: CurrencyDefinition;
  /** Default date pattern (d3 format string). */
  datePattern: string;
}

const LOCALES: Record<LocaleName, LocaleDefinition> = {
  'fr-FR': {
    number: {
      decimal: ',',
      thousands: '\u00a0',
      grouping: [3],
      currency: ['', '\u00a0€'],
      percent: '\u202f%',
    },
    time: {
      dateTime: '%A %e %B %Y à %X',
      date: '%d/%m/%Y',
      time: '%H:%M:%S',
      periods: ['AM', 'PM'],
      days: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
      shortDays: ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'],
      months: [
        'janvier',
        'février',
        'mars',
        'avril',
        'mai',
        'juin',
        'juillet',
        'août',
        'septembre',
        'octobre',
        'novembre',
        'décembre',
      ],
      shortMonths: [
        'janv.',
        'févr.',
        'mars',
        'avr.',
        'mai',
        'juin',
        'juil.',
        'août',
        'sept.',
        'oct.',
        'nov.',
        'déc.',
      ],
    },
    currency: { symbol: '€', position: 'suffix' },
    datePattern: '%d/%m/%Y',
  },
  'en-US': {
    number: {
      decimal: '.',
      thousands: ',',
      grouping: [3],
      currency: ['$', ''],
      percent: '%',
    },
    time: {
      dateTime: '%x, %X',
      date: '%-m/%-d/%Y',
      time: '%-I:%M:%S %p',
      periods: ['AM', 'PM'],
      days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      shortDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      months: [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ],
      shortMonths: [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ],
    },
    currency: { symbol: '$', position: 'prefix' },
    datePattern: '%-m/%-d/%Y',
  },
};

export interface FormatConfig {
  /** Locale used when a call does not pass one. Default: `'fr-FR'`. */
  locale?: LocaleName | undefined;
}

let current: LocaleName = 'fr-FR';

/** Set the default locale for the whole library. */
export function configure(config: FormatConfig): void {
  if (config.locale !== undefined) {
    if (!(config.locale in LOCALES)) {
      throw new RangeError(`configure: unknown locale "${config.locale}"`);
    }
    current = config.locale;
  }
}

/** The current default locale. */
export function getLocale(): LocaleName {
  return current;
}

const numberCache = new Map<LocaleName, ReturnType<typeof formatLocale>>();
const timeCache = new Map<LocaleName, ReturnType<typeof timeFormatLocale>>();

function numbers(locale: LocaleName): ReturnType<typeof formatLocale> {
  let f = numberCache.get(locale);
  if (!f) {
    f = formatLocale(LOCALES[locale].number);
    numberCache.set(locale, f);
  }
  return f;
}

function times(locale: LocaleName): ReturnType<typeof timeFormatLocale> {
  let f = timeCache.get(locale);
  if (!f) {
    f = timeFormatLocale(LOCALES[locale].time);
    timeCache.set(locale, f);
  }
  return f;
}

export interface NumberFormatOptions {
  /** Digits after the decimal separator. Default: as many as needed. */
  decimals?: number;
  locale?: LocaleName | undefined;
}

export interface CurrencyFormatOptions extends NumberFormatOptions {
  /** Currency symbol. Default: the locale's symbol. */
  symbol?: string;
}

export interface DateFormatOptions {
  /** d3 time format pattern, for example `'%B %Y'`. Default: the locale's date pattern. */
  pattern?: string;
  locale?: LocaleName | undefined;
}

/** `1234.5` → `1 234,5` (fr-FR) or `1,234.5` (en-US). */
export function formatNumber(value: number, options: NumberFormatOptions = {}): string {
  const locale = options.locale ?? current;
  const spec = options.decimals === undefined ? ',' : `,.${String(options.decimals)}f`;
  return numbers(locale).format(spec)(value);
}

/** `0.1234` → `12,3 %`. Input is a ratio (1 = 100 %). */
export function formatPercent(ratio: number, options: NumberFormatOptions = {}): string {
  const locale = options.locale ?? current;
  const decimals = options.decimals ?? 1;
  return numbers(locale).format(`,.${String(decimals)}%`)(ratio);
}

/** `1234.5` → `1 234,50 €` (fr-FR) or `$1,234.50` (en-US). */
export function formatCurrency(value: number, options: CurrencyFormatOptions = {}): string {
  const locale = options.locale ?? current;
  const def = LOCALES[locale].currency;
  const symbol = options.symbol ?? def.symbol;
  const amount = numbers(locale).format(`,.${String(options.decimals ?? 2)}f`)(value);
  return def.position === 'prefix' ? `${symbol}${amount}` : `${amount}\u00a0${symbol}`;
}

/** `new Date(2026, 0, 3)` → `03/01/2026` (fr-FR) or `1/3/2026` (en-US). */
export function formatDate(date: Date, options: DateFormatOptions = {}): string {
  const locale = options.locale ?? current;
  return times(locale).format(options.pattern ?? LOCALES[locale].datePattern)(date);
}
