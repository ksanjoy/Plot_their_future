import { toCsv } from './csv.js';
import { hmacSha256, randomCode, randomOtp, safeEqual } from './utils/crypto.js';
import { formatInr, initialsOf, slugify, SLUG_REGEX } from './utils/format.js';
import { maskPhone, toE164 } from './utils/phone.js';

describe('phone', () => {
  it('normalises Indian numbers to E.164', () => {
    expect(toE164('98480 12345')).toBe('+919848012345');
    expect(toE164('+91-98480-12345')).toBe('+919848012345');
    expect(toE164('09848012345')).toBe('+919848012345');
  });

  it('rejects invalid numbers', () => {
    expect(toE164('123')).toBeNull();
    expect(toE164('')).toBeNull();
    expect(toE164('abc')).toBeNull();
  });

  it('masks all but the country code and last four digits', () => {
    expect(maskPhone('+919848012345')).toBe('+91••••••2345');
  });
});

describe('csv', () => {
  it('quotes delimiters and neutralises formulas', () => {
    const out = toCsv(['a', 'b'], [['x,y', '=SUM(A1)'], ['say "hi"', null]]);
    expect(out).toBe('a,b\r\n"x,y",\'=SUM(A1)\r\n"say ""hi""",\r\n');
  });

  it('keeps phone numbers and negative amounts intact', () => {
    expect(toCsv(['p', 'n'], [['+919848012345', '-500']])).toBe('p,n\r\n+919848012345,-500\r\n');
    expect(toCsv(['p'], [['+cmd|calc']])).toBe("p\r\n'+cmd|calc\r\n");
  });
});

describe('format', () => {
  it('formats paise as Indian rupees', () => {
    expect(formatInr(540000000)).toBe('₹54,00,000');
  });

  it('derives initials and slugs', () => {
    expect(initialsOf('Sanvi Rao')).toBe('SR');
    expect(initialsOf('Sanvi & Santosh')).toBe('SS');
    const slug = slugify('Sanvi & Santosh — Bengaluru 2026!');
    expect(slug).toBe('sanvi-santosh-bengaluru-2026');
    expect(SLUG_REGEX.test(slug)).toBe(true);
  });
});

describe('crypto', () => {
  it('generates 6-digit OTPs and unambiguous codes', () => {
    for (let i = 0; i < 50; i++) {
      expect(randomOtp()).toMatch(/^\d{6}$/);
      expect(randomCode(12)).toMatch(/^[a-km-np-z2-9]{12}$/);
    }
  });

  it('compares in constant time and handles length mismatch', () => {
    const h = hmacSha256('secret', 'value');
    expect(safeEqual(h, hmacSha256('secret', 'value'))).toBe(true);
    expect(safeEqual(h, hmacSha256('other', 'value'))).toBe(false);
    expect(safeEqual(h, 'short')).toBe(false);
  });
});
