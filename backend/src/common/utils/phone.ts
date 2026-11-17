import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

/** Normalises user input to E.164 (`+919848012345`). Returns null when invalid. */
export function toE164(input: string, defaultCountry = 'IN'): string | null {
  const cleaned = input.replace(/[^\d+]/g, '');
  if (!cleaned) return null;
  const parsed = parsePhoneNumberFromString(cleaned, defaultCountry as CountryCode);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number;
}

export function maskPhone(e164: string): string {
  if (e164.length < 6) return e164;
  return `${e164.slice(0, 3)}${'•'.repeat(Math.max(0, e164.length - 7))}${e164.slice(-4)}`;
}
