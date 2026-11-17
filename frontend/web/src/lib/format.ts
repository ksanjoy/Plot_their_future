const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const compactInr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 1 });

export const formatInr = (paise: number) => inr.format(Math.round(paise / 100));
export const formatInrCompact = (paise: number) => compactInr.format(Math.round(paise / 100));

export const formatDateTime = (iso: string | null | undefined, tz = "Asia/Kolkata") =>
  iso ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: tz }).format(new Date(iso)) : "";

export const formatDate = (iso: string | null | undefined, tz = "Asia/Kolkata") =>
  iso ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: tz }).format(new Date(iso)) : "";

export const formatTime = (iso: string, tz = "Asia/Kolkata") =>
  new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date(iso));

export const formatDayShort = (iso: string, tz = "Asia/Kolkata") =>
  new Intl.DateTimeFormat("en-IN", { month: "short", day: "numeric", timeZone: tz }).format(new Date(iso));

export const percent = (ratio: number) => `${Math.round(ratio * 100)}%`;

export const coupleName = (w: { brideName: string; groomName: string }) => `${w.brideName} & ${w.groomName}`;

export const firstNames = (w: { brideName: string; groomName: string }) =>
  `${w.brideName.split(" ")[0]} & ${w.groomName.split(" ")[0]}`;

/** `datetime-local` input value in the wedding's timezone (IST by default). */
export function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 5.5 * 3600_000);
  return d.toISOString().slice(0, 16);
}

export const fromLocalInput = (value: string) => (value ? new Date(`${value}:00+05:30`).toISOString() : null);

export const COHORT_LABELS: Record<string, string> = {
  CLOSE_FAMILY: "Close Family",
  FAMILY: "Family",
  FRIENDS: "Friends",
  COLLEAGUES: "Colleagues",
  VIP: "VIP",
  OTHER: "Other",
};

export const ROLE_LABELS: Record<string, string> = {
  HOST: "Host",
  CO_HOST: "Co-host",
  LEAD: "Family lead",
  VENUE: "Venue",
  GUEST: "Guest",
  PLATFORM: "Platform admin",
};

export const DIETARY_LABELS: Record<string, string> = {
  VEG: "Vegetarian",
  NON_VEG: "Non-vegetarian",
  JAIN: "Jain",
  VEGAN: "Vegan",
  SATVIK: "Satvik",
  GLUTEN_FREE: "Gluten-free",
};
