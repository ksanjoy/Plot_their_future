import type * as T from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000").replace(/\/$/, "");
const BASE = `${API_URL}/api/v1`;

const ACCESS_KEY = "ptf.access";
const REFRESH_KEY = "ptf.refresh";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public body?: unknown,
  ) {
    super(message);
  }
}

export const tokens = {
  get access() {
    return typeof window === "undefined" ? null : localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return typeof window === "undefined" ? null : localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
    window.dispatchEvent(new Event("ptf-auth"));
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    window.dispatchEvent(new Event("ptf-auth"));
  },
};

let refreshing: Promise<boolean> | null = null;

/** Single-flight refresh so parallel 401s rotate the refresh token only once. */
async function refreshTokens(): Promise<boolean> {
  const refreshToken = tokens.refresh;
  if (!refreshToken) return false;
  refreshing ??= fetch(`${BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  })
    .then(async (res) => {
      if (!res.ok) {
        tokens.clear();
        return false;
      }
      const body = (await res.json()) as T.AuthSession;
      tokens.set(body.accessToken, body.refreshToken);
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  form?: FormData;
  auth?: boolean;
  raw?: boolean;
}

export async function api<R>(path: string, opts: RequestOptions = {}, retried = false): Promise<R> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  const access = opts.auth === false ? null : tokens.access;
  if (access) headers.Authorization = `Bearer ${access}`;

  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? (opts.body !== undefined || opts.form ? "POST" : "GET"),
    headers,
    body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
  });

  if (res.status === 401 && access && !retried && (await refreshTokens())) {
    return api<R>(path, opts, true);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[]; code?: string };
    const message = Array.isArray(body.message) ? body.message[0] : body.message;
    throw new ApiError(res.status, message ?? res.statusText ?? "Request failed", body.code, body);
  }
  if (opts.raw) return res as unknown as R;
  if (res.status === 204) return undefined as R;
  return (await res.json()) as R;
}

/** Fetches an authenticated file (CSV, ICS, PDF) and triggers a browser download. */
export async function download(path: string, fallbackName: string) {
  const res = await api<Response>(path, { raw: true });
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const name = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const receiptPdfUrl = (id: string, token: string) => `${BASE}/receipts/${id}/pdf?t=${encodeURIComponent(token)}`;
export const stageQrUrl = (slug: string, table?: string) =>
  `${BASE}/weddings/${slug}/stage/qr.png${table ? `?table=${encodeURIComponent(table)}` : ""}`;

const enc = encodeURIComponent;

export const endpoints = {
  config: () => api<T.PublicConfig>("/public/config", { auth: false }),
  feed: () => api<T.FeedEntry[]>("/public/weddings"),
  invitationPreview: (refToken: string) => api<T.InvitationPreview>(`/public/invitations/${enc(refToken)}`, { auth: false }),

  requestOtp: (phone: string, slug?: string) => api<T.OtpRequest>("/auth/request-otp", { body: { phone, slug }, auth: false }),
  verifyOtp: (phone: string, otp: string, name?: string) =>
    api<T.AuthSession>("/auth/verify-otp", { body: { phone, otp, name: name || undefined }, auth: false }),
  logout: (refreshToken: string) => api<void>("/auth/logout", { body: { refreshToken } }),
  me: () => api<T.Me>("/auth/me"),
  updateMe: (body: { name?: string; email?: string | null }) => api<T.User>("/auth/me", { method: "PATCH", body }),

  myWeddings: () => api<T.WeddingWithRole[]>("/weddings/mine"),
  createWedding: (body: Record<string, unknown>) => api<T.Wedding>("/weddings", { body }),
  microsite: (slug: string) => api<T.Microsite>(`/weddings/${enc(slug)}`),
  updateWedding: (slug: string, body: Record<string, unknown>) => api<T.Wedding>(`/weddings/${enc(slug)}`, { method: "PATCH", body }),
  replaceRooms: (slug: string, rooms: T.RoomInput[]) => api<T.RegistryState>(`/weddings/${enc(slug)}/rooms`, { method: "PUT", body: { rooms } }),
  uploadMedia: (slug: string, kind: "cover" | "video", file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api<T.Wedding>(`/weddings/${enc(slug)}/media/${kind}`, { form });
  },
  dashboard: (slug: string) => api<T.Dashboard>(`/weddings/${enc(slug)}/dashboard`),
  members: (slug: string) => api<T.Member[]>(`/weddings/${enc(slug)}/members`),
  addMember: (slug: string, body: { phone: string; name?: string; role: string; label?: string }) =>
    api<T.Member>(`/weddings/${enc(slug)}/members`, { body }),
  removeMember: (slug: string, id: string) => api<void>(`/weddings/${enc(slug)}/members/${id}`, { method: "DELETE" }),

  ceremonies: (slug: string) => api<T.Ceremony[]>(`/weddings/${enc(slug)}/ceremonies`),
  createCeremony: (slug: string, body: Partial<T.Ceremony>) => api<T.Ceremony>(`/weddings/${enc(slug)}/ceremonies`, { body }),
  updateCeremony: (slug: string, id: string, body: Partial<T.Ceremony>) =>
    api<T.Ceremony>(`/weddings/${enc(slug)}/ceremonies/${id}`, { method: "PATCH", body }),
  deleteCeremony: (slug: string, id: string) => api<void>(`/weddings/${enc(slug)}/ceremonies/${id}`, { method: "DELETE" }),
  ceremonyIcs: (slug: string, id: string) => download(`/weddings/${enc(slug)}/ceremonies/${id}/calendar.ics`, "ceremony.ics"),

  guests: (slug: string, q: Record<string, string | undefined> = {}) => {
    const qs = new URLSearchParams(Object.entries(q).filter((e): e is [string, string] => Boolean(e[1]))).toString();
    return api<T.Guest[]>(`/weddings/${enc(slug)}/guests${qs ? `?${qs}` : ""}`);
  },
  createGuest: (slug: string, body: Partial<T.GuestInput>) => api<T.Guest>(`/weddings/${enc(slug)}/guests`, { body }),
  updateGuest: (slug: string, id: string, body: Partial<T.GuestInput>) =>
    api<T.Guest>(`/weddings/${enc(slug)}/guests/${id}`, { method: "PATCH", body }),
  deleteGuest: (slug: string, id: string) => api<void>(`/weddings/${enc(slug)}/guests/${id}`, { method: "DELETE" }),
  importGuests: (slug: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api<T.ImportResult>(`/weddings/${enc(slug)}/guests/import`, { form });
  },
  exportGuests: (slug: string) => download(`/weddings/${enc(slug)}/guests/export.csv`, "guests.csv"),

  dispatches: (slug: string) => api<T.DispatchSummary[]>(`/weddings/${enc(slug)}/dispatches`),
  dispatchPreview: (slug: string, body: T.DispatchInput) => api<{ recipients: number }>(`/weddings/${enc(slug)}/dispatches/preview`, { body }),
  createDispatch: (slug: string, body: T.DispatchInput) => api<T.DispatchSummary>(`/weddings/${enc(slug)}/dispatches`, { body }),

  myRsvp: (slug: string) => api<T.MyRsvp>(`/weddings/${enc(slug)}/rsvp/me`),
  saveRsvp: (slug: string, body: T.RsvpInput) => api<T.Rsvp>(`/weddings/${enc(slug)}/rsvp/me`, { method: "PUT", body }),
  rsvps: (slug: string) => api<T.RsvpRow[]>(`/weddings/${enc(slug)}/rsvps`),
  rsvpSummary: (slug: string) => api<T.RsvpSummary>(`/weddings/${enc(slug)}/rsvps/summary`),
  exportRsvps: (slug: string) => download(`/weddings/${enc(slug)}/rsvps/export.csv`, "rsvps.csv"),

  registry: (slug: string) => api<T.RegistryState>(`/weddings/${enc(slug)}/registry`),
  lockTiles: (body: T.LockInput) => api<T.LockResult>("/registry/lock-tile", { body }),
  contribution: (id: string) => api<T.ContributionDetail>(`/registry/contributions/${id}`),
  cancelContribution: (id: string) => api<void>(`/registry/contributions/${id}`, { method: "DELETE" }),
  donorWall: (slug: string) => api<T.WallEntry[]>(`/weddings/${enc(slug)}/donor-wall`),
  myContributions: (slug: string) => api<T.MyContribution[]>(`/weddings/${enc(slug)}/contributions/mine`),
  contributions: (slug: string, status?: string) =>
    api<T.OwnerContribution[]>(`/weddings/${enc(slug)}/contributions${status ? `?status=${status}` : ""}`),
  exportContributions: (slug: string) => download(`/weddings/${enc(slug)}/contributions/export.csv`, "gifts.csv"),

  checkout: (id: string, t: string) => api<T.Checkout>(`/payments/checkout/${id}?t=${enc(t)}`, { auth: false }),
  verifyPayment: (id: string, t: string, body: Record<string, string>) =>
    api<T.PaymentResult>(`/payments/checkout/${id}/verify?t=${enc(t)}`, { body, auth: false }),
  completeMock: (id: string, t: string, outcome: "success" | "failure") =>
    api<T.PaymentResult>(`/payments/mock/${id}/complete?t=${enc(t)}`, { body: { outcome }, auth: false }),

  receipt: (id: string, t: string) => api<T.Receipt>(`/receipts/${id}?t=${enc(t)}`, { auth: false }),
  verifyReceipt: (receiptNumber: string) => api<T.ReceiptVerification>(`/receipts/verify/${enc(receiptNumber)}`, { auth: false }),

  blessings: (slug: string, status?: string) =>
    api<T.Blessing[]>(`/weddings/${enc(slug)}/blessings${status ? `?status=${status}&limit=200` : "?limit=100"}`),
  postBlessing: (slug: string, input: { message?: string; tableNumber?: string; photo?: File | null }) => {
    const form = new FormData();
    if (input.message) form.append("message", input.message);
    if (input.tableNumber) form.append("tableNumber", input.tableNumber);
    if (input.photo) form.append("photo", input.photo);
    return api<T.Blessing>(`/weddings/${enc(slug)}/blessings`, { form });
  },
  moderateBlessing: (slug: string, id: string, status: T.ModerationStatus) =>
    api<T.Blessing>(`/weddings/${enc(slug)}/blessings/${id}`, { method: "PATCH", body: { status } }),

  stage: (slug: string) => api<T.StagePayload>(`/weddings/${enc(slug)}/stage`),

  ledger: (slug: string) => api<T.Ledger>(`/weddings/${enc(slug)}/ledger`),
  requestSettlement: (slug: string, body: T.SettlementInput) => api<T.Settlement>(`/weddings/${enc(slug)}/settlements`, { body }),
  hostApproveSettlement: (slug: string, id: string) => api<T.Settlement>(`/weddings/${enc(slug)}/settlements/${id}/approve`, { method: "POST" }),
  hostRejectSettlement: (slug: string, id: string, reason: string) =>
    api<T.Settlement>(`/weddings/${enc(slug)}/settlements/${id}/reject`, { body: { reason } }),
  complianceSettlements: (status?: string) => api<T.ComplianceSettlement[]>(`/admin/settlements${status ? `?status=${status}` : ""}`),
  complianceApprove: (id: string) => api<T.Settlement>(`/admin/settlements/${id}/approve`, { method: "POST" }),
  complianceDisburse: (id: string, bankReference: string) => api<T.Settlement>(`/admin/settlements/${id}/disburse`, { body: { bankReference } }),
  complianceReject: (id: string, reason: string) => api<T.Settlement>(`/admin/settlements/${id}/reject`, { body: { reason } }),
};
