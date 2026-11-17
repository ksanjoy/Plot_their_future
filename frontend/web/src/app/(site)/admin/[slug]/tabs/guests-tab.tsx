"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Download, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { useDeferredValue, useRef, useState } from "react";
import { useToast } from "@/components/toast";
import { Badge, EmptyState, errorMessage, ErrorState, Field, Modal, Spinner } from "@/components/ui";
import { endpoints } from "@/lib/api";
import { COHORT_LABELS } from "@/lib/format";
import type { Ceremony, Cohort, Guest, GuestInput, ImportResult } from "@/lib/types";
import { ADMIN, can, type TabProps } from "./shared";

const RSVP_TONE = { ATTENDING: "success", DECLINED: "danger", MAYBE: "warn", PENDING: "neutral" } as const;

function GuestForm({
  slug,
  guest,
  ceremonies,
  lockedRefLead,
  onDone,
}: {
  slug: string;
  guest: Guest | null;
  ceremonies: Ceremony[];
  lockedRefLead: boolean;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState<GuestInput>({
    guestName: guest?.guestName ?? "",
    phone: guest?.phone ?? "",
    email: guest?.email ?? null,
    cohort: guest?.cohort ?? "FAMILY",
    maxAttendees: guest?.maxAttendees ?? 2,
    enableRegistry: guest?.enableRegistry ?? true,
    ceremonyIds: guest?.ceremonyIds ?? ceremonies.map((c) => c.id),
    refLead: guest?.refLead ?? null,
  });
  const set = <K extends keyof GuestInput>(k: K, v: GuestInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, email: form.email || null, refLead: form.refLead || null };
      if (lockedRefLead) delete (body as Partial<GuestInput>).refLead;
      return guest ? endpoints.updateGuest(slug, guest.id, body) : endpoints.createGuest(slug, body);
    },
    onSuccess: () => {
      toast(guest ? "Guest updated" : "Guest added");
      void qc.invalidateQueries({ queryKey: ["guests", slug] });
      onDone();
    },
  });
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <input className="input" value={form.guestName} onChange={(e) => set("guestName", e.target.value)} required maxLength={80} />
        </Field>
        <Field label="WhatsApp number" hint="10-digit Indian numbers get +91 automatically">
          <input className="input" value={form.phone} onChange={(e) => set("phone", e.target.value)} required inputMode="tel" />
        </Field>
        <Field label="Email">
          <input className="input" type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="Cohort">
          <select className="input" value={form.cohort} onChange={(e) => set("cohort", e.target.value as Cohort)}>
            {Object.entries(COHORT_LABELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Seats on this invitation">
          <input className="input" type="number" min={1} max={10} value={form.maxAttendees} onChange={(e) => set("maxAttendees", Number(e.target.value))} />
        </Field>
        {!lockedRefLead && (
          <Field label="Family lead tag" hint="Used for per-family tracking links">
            <input className="input" value={form.refLead ?? ""} onChange={(e) => set("refLead", e.target.value)} maxLength={30} />
          </Field>
        )}
      </div>
      {ceremonies.length > 0 && (
        <div>
          <span className="label">Invited to</span>
          <div className="flex flex-wrap gap-2">
            {ceremonies.map((c) => {
              const on = form.ceremonyIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`chip ${on ? "chip-active" : ""}`}
                  onClick={() => set("ceremonyIds", on ? form.ceremonyIds.filter((x) => x !== c.id) : [...form.ceremonyIds, c.id])}
                >
                  {c.title}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-maroon" checked={form.enableRegistry} onChange={(e) => set("enableRegistry", e.target.checked)} />
        Show the home gift registry to this guest
      </label>
      {save.isError && <p className="text-sm text-maroon">{errorMessage(save.error)}</p>}
      <button className="btn-primary w-full" disabled={save.isPending}>
        {save.isPending ? "Saving…" : guest ? "Save changes" : "Add guest"}
      </button>
    </form>
  );
}

function ImportDialog({ slug, open, onClose }: { slug: string; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const imp = useMutation({
    mutationFn: (file: File) => endpoints.importGuests(slug, file),
    onSuccess: (r) => {
      setResult(r);
      void qc.invalidateQueries({ queryKey: ["guests", slug] });
    },
  });
  return (
    <Modal
      open={open}
      onClose={() => {
        setResult(null);
        onClose();
      }}
      title="Import guests from CSV"
    >
      <div className="space-y-4 text-sm">
        <p className="text-muted">
          Columns: <code>guest_name, phone, email, cohort, max_attendees, invited_events, ref_lead, enable_registry</code>. Use ceremony titles separated by
          <code> | </code> in <code>invited_events</code>, or <code>all</code>. Existing phone numbers are updated.
        </p>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="input" aria-label="CSV file" />
        <button
          className="btn-primary w-full"
          disabled={imp.isPending}
          onClick={() => {
            const f = fileRef.current?.files?.[0];
            if (f) imp.mutate(f);
          }}
        >
          <Upload size={16} /> {imp.isPending ? "Importing…" : "Import"}
        </button>
        {imp.isError && <p className="text-maroon">{errorMessage(imp.error)}</p>}
        {result && (
          <div className="rounded-xl bg-white p-3">
            <p className="font-semibold">
              {result.created} added • {result.updated} updated • {result.errors.length} skipped
            </p>
            {result.errors.length > 0 && (
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-maroon">
                {result.errors.map((e) => (
                  <li key={e.row}>
                    Row {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

export function GuestsTab({ slug, role }: TabProps) {
  const qc = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [cohort, setCohort] = useState("");
  const [rsvp, setRsvp] = useState("");
  const [ceremonyId, setCeremonyId] = useState("");
  const [editing, setEditing] = useState<Guest | "new" | null>(null);
  const [importing, setImporting] = useState(false);
  const deferredSearch = useDeferredValue(search);
  const filters = { search: deferredSearch || undefined, cohort: cohort || undefined, rsvp: rsvp || undefined, ceremonyId: ceremonyId || undefined };

  const guests = useQuery({ queryKey: ["guests", slug, filters], queryFn: () => endpoints.guests(slug, filters), placeholderData: keepPreviousData });
  const ceremonies = useQuery({ queryKey: ["ceremonies", slug], queryFn: () => endpoints.ceremonies(slug) });
  const remove = useMutation({
    mutationFn: (id: string) => endpoints.deleteGuest(slug, id),
    onSuccess: () => {
      toast("Guest removed");
      void qc.invalidateQueries({ queryKey: ["guests", slug] });
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  const ceremonyTitle = (id: string) => ceremonies.data?.find((c) => c.id === id)?.title ?? "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input className="input !pl-9" placeholder="Search name, phone or email" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input !w-auto" value={cohort} onChange={(e) => setCohort(e.target.value)} aria-label="Cohort">
          <option value="">All cohorts</option>
          {Object.entries(COHORT_LABELS).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
        <select className="input !w-auto" value={rsvp} onChange={(e) => setRsvp(e.target.value)} aria-label="RSVP">
          <option value="">Any RSVP</option>
          <option value="PENDING">Awaiting reply</option>
          <option value="ATTENDING">Attending</option>
          <option value="MAYBE">Tentative</option>
          <option value="DECLINED">Declined</option>
        </select>
        <select className="input !w-auto" value={ceremonyId} onChange={(e) => setCeremonyId(e.target.value)} aria-label="Ceremony">
          <option value="">All ceremonies</option>
          {ceremonies.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary !py-2" onClick={() => setEditing("new")}>
          <Plus size={16} /> Add guest
        </button>
        <button className="btn-ghost !py-2" onClick={() => setImporting(true)}>
          <Upload size={16} /> Import CSV
        </button>
        <button className="btn-ghost !py-2" onClick={() => endpoints.exportGuests(slug).catch((e) => toast(errorMessage(e), "error"))}>
          <Download size={16} /> Export CSV
        </button>
        {guests.data && <span className="self-center text-sm text-muted">{guests.data.length} guests</span>}
      </div>

      {guests.isPending ? (
        <Spinner />
      ) : guests.isError ? (
        <ErrorState error={guests.error} />
      ) : !guests.data.length ? (
        <EmptyState title="No guests found">Add guests one by one or import your list from a spreadsheet.</EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-line bg-ivory text-left text-xs tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-3">Guest</th>
                <th className="px-4 py-3">Cohort</th>
                <th className="px-4 py-3">Ceremonies</th>
                <th className="px-4 py-3">Seats</th>
                <th className="px-4 py-3">RSVP</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {guests.data.map((g) => (
                <tr key={g.id} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{g.guestName}</p>
                    <p className="text-xs text-muted">
                      {g.phone}
                      {g.refLead && ` • ${g.refLead}`}
                    </p>
                  </td>
                  <td className="px-4 py-3">{COHORT_LABELS[g.cohort]}</td>
                  <td className="max-w-56 px-4 py-3 text-xs text-muted">{g.ceremonyIds.map(ceremonyTitle).filter(Boolean).join(", ") || "—"}</td>
                  <td className="px-4 py-3">{g.maxAttendees}</td>
                  <td className="px-4 py-3">
                    <Badge tone={RSVP_TONE[g.rsvpStatus]}>{g.rsvpStatus === "PENDING" ? "Awaiting" : g.rsvpStatus.toLowerCase()}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        className="rounded-lg p-2 hover:bg-line/60"
                        title="Copy invitation link"
                        onClick={() => void navigator.clipboard.writeText(g.inviteLink).then(() => toast("Invitation link copied"))}
                      >
                        <Copy size={15} />
                      </button>
                      <button className="rounded-lg p-2 hover:bg-line/60" title="Edit" onClick={() => setEditing(g)}>
                        <Pencil size={15} />
                      </button>
                      <button
                        className="rounded-lg p-2 text-maroon hover:bg-rose-50"
                        title="Remove"
                        onClick={() => {
                          if (confirm(`Remove ${g.guestName} from the guest list?`)) remove.mutate(g.id);
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Add guest" : "Edit guest"} wide>
        {editing !== null && ceremonies.data && (
          <GuestForm
            key={editing === "new" ? "new" : editing.id}
            slug={slug}
            guest={editing === "new" ? null : editing}
            ceremonies={ceremonies.data}
            lockedRefLead={!can(role, ADMIN)}
            onDone={() => setEditing(null)}
          />
        )}
      </Modal>
      <ImportDialog slug={slug} open={importing} onClose={() => setImporting(false)} />
    </div>
  );
}
