"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { endpoints } from "@/lib/api";
import { DIETARY_LABELS, formatDateTime } from "@/lib/format";
import type { MyRsvp, RsvpInput, RsvpStatus } from "@/lib/types";
import { useToast } from "../toast";
import { errorMessage, Field, Modal, Spinner } from "../ui";

function Counter({ label, value, onChange, min = 0, max }: { label: string; value: number; onChange: (n: number) => void; min?: number; max: number }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-line bg-white px-3 py-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-3">
        <button type="button" className="rounded-full border border-line p-1 disabled:opacity-30" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={`Fewer ${label}`}>
          <Minus size={14} />
        </button>
        <span className="w-5 text-center font-semibold tabular-nums">{value}</span>
        <button type="button" className="rounded-full border border-line p-1 disabled:opacity-30" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`More ${label}`}>
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

function RsvpForm({ slug, data, onDone }: { slug: string; data: MyRsvp; onDone: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const r = data.rsvp;
  const max = data.invitation.maxAttendees;
  const [form, setForm] = useState<RsvpInput>({
    status: r?.status ?? "ATTENDING",
    adults: r?.adults || 1,
    children: r?.children ?? 0,
    infants: r?.infants ?? 0,
    attendingCeremonyIds: r?.attendingCeremonyIds ?? data.invitedCeremonies.map((c) => c.id),
    dietary: r?.dietary ?? [],
    allergies: r?.allergies ?? "",
    arrivalMode: r?.arrivalMode ?? null,
    arrivalDetails: r?.arrivalDetails ?? "",
    needsAccommodation: r?.needsAccommodation ?? false,
    checkInDate: r?.checkInDate?.slice(0, 10) ?? null,
    checkOutDate: r?.checkOutDate?.slice(0, 10) ?? null,
    needsShuttle: r?.needsShuttle ?? false,
    note: r?.note ?? "",
    guestName: data.invitation.guestName,
    email: data.invitation.email,
    occupation: "",
    foodPreference: r?.foodPreference ?? null,
    accommodationRooms: r?.accommodationRooms ?? 1,
    accommodationGuests: r?.accommodationGuests ?? 1,
  });
  const [ceremonyStatus, setCeremonyStatus] = useState<Record<string, RsvpStatus>>(() => {
    const saved = Object.fromEntries((r?.ceremonyResponses ?? []).map((row) => [row.ceremonyId, row.status]));
    return Object.fromEntries(data.invitedCeremonies.map((c) => [c.id, saved[c.id] ?? (form.attendingCeremonyIds.includes(c.id) ? "ATTENDING" : "DECLINED")]));
  });
  const set = <K extends keyof RsvpInput>(k: K, v: RsvpInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggle = (k: "attendingCeremonyIds" | "dietary", v: string) =>
    setForm((f) => ({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] }));

  const save = useMutation({
    mutationFn: () =>
      endpoints.saveRsvp(slug, {
        ...form,
        allergies: form.allergies || null,
        arrivalDetails: form.arrivalDetails || null,
        note: form.note || null,
        email: form.email || null,
        occupation: form.occupation || undefined,
        foodPreference: form.status === "DECLINED" ? null : form.foodPreference || null,
        accommodationRooms: form.status !== "DECLINED" && form.needsAccommodation ? form.accommodationRooms ?? 0 : 0,
        accommodationGuests: form.status !== "DECLINED" && form.needsAccommodation ? form.accommodationGuests ?? 0 : 0,
        attendingCeremonyIds: form.status === "DECLINED" ? [] : Object.entries(ceremonyStatus).filter(([, status]) => status !== "DECLINED").map(([id]) => id),
        ceremonyResponses:
          form.status === "DECLINED"
            ? []
            : Object.entries(ceremonyStatus).map(([ceremonyId, status]) => ({
                ceremonyId,
                status,
                adults: status === "DECLINED" ? 0 : form.adults,
                children: status === "DECLINED" ? 0 : form.children,
              })),
      }),
    onSuccess: () => {
      toast(form.status === "DECLINED" ? "Thank you for letting us know." : "RSVP confirmed! A WhatsApp confirmation is on its way.");
      void qc.invalidateQueries({ queryKey: ["rsvp", slug] });
      void qc.invalidateQueries({ queryKey: ["microsite", slug] });
      onDone();
    },
  });

  const attending = form.status !== "DECLINED";
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["ATTENDING", "Joyfully accept"],
            ["MAYBE", "Tentative"],
            ["DECLINED", "Regretfully decline"],
          ] as [RsvpStatus, string][]
        ).map(([s, label]) => (
          <button key={s} type="button" onClick={() => set("status", s)} className={`rounded-xl border p-3 text-sm font-semibold transition ${form.status === s ? "border-maroon bg-maroon text-white" : "border-line bg-white"}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <input className="input" value={form.guestName ?? ""} onChange={(e) => set("guestName", e.target.value)} maxLength={80} required />
        </Field>
        <Field label="Email (optional)">
          <input className="input" type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="Occupation">
          <input className="input" value={form.occupation ?? ""} onChange={(e) => set("occupation", e.target.value)} maxLength={80} />
        </Field>
      </div>

      {attending && (
        <>
          <div>
            <span className="label">Party size (your invitation covers {max})</span>
            <div className="grid gap-2 sm:grid-cols-3">
              <Counter label="Adults" value={form.adults} min={1} max={max - form.children} onChange={(n) => set("adults", n)} />
              <Counter label="Children" value={form.children} max={max - form.adults} onChange={(n) => set("children", n)} />
              <Counter label="Infants" value={form.infants} max={4} onChange={(n) => set("infants", n)} />
            </div>
          </div>
          {data.invitedCeremonies.length > 0 && (
            <div>
              <span className="label">Ceremonies you&apos;ll attend</span>
              <div className="space-y-2">
                {data.invitedCeremonies.map((c) => (
                  <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white p-3 text-sm">
                    <span>
                      <span className="font-semibold">{c.title}</span>
                      <span className="block text-xs text-muted">
                        {formatDateTime(c.startsAt)} • {c.venueName}
                      </span>
                    </span>
                    <select
                      className="input !w-36"
                      value={ceremonyStatus[c.id] ?? "DECLINED"}
                      onChange={(e) => setCeremonyStatus((current) => ({ ...current, [c.id]: e.target.value as RsvpStatus }))}
                    >
                      <option value="ATTENDING">Yes</option>
                      <option value="MAYBE">Maybe</option>
                      <option value="DECLINED">No</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <span className="label">Dietary preferences</span>
            <div className="flex flex-wrap gap-2">
              {Object.entries(DIETARY_LABELS).map(([k, label]) => (
                <button key={k} type="button" onClick={() => toggle("dietary", k)} className={`chip ${form.dietary.includes(k) ? "chip-active" : ""}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <Field label="Food preference">
            <select className="input" value={form.foodPreference ?? ""} onChange={(e) => set("foodPreference", e.target.value || null)}>
              <option value="">Select…</option>
              <option value="VEG">Veg</option>
              <option value="NON_VEG">Non-veg</option>
              <option value="JAIN">Jain</option>
              <option value="OTHER">Other</option>
            </select>
          </Field>
          <Field label="Allergies or special needs">
            <input className="input" value={form.allergies ?? ""} onChange={(e) => set("allergies", e.target.value)} maxLength={200} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Arriving by">
              <select className="input" value={form.arrivalMode ?? ""} onChange={(e) => set("arrivalMode", e.target.value || null)}>
                <option value="">Select…</option>
                <option value="FLIGHT">Flight</option>
                <option value="TRAIN">Train</option>
                <option value="ROAD">Road</option>
                <option value="LOCAL">I&apos;m local</option>
              </select>
            </Field>
            <Field label="Flight / train number">
              <input className="input" value={form.arrivalDetails ?? ""} onChange={(e) => set("arrivalDetails", e.target.value)} maxLength={120} />
            </Field>
          </div>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-maroon" checked={form.needsAccommodation} onChange={(e) => set("needsAccommodation", e.target.checked)} />
            I need accommodation
          </label>
          {form.needsAccommodation && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Counter label="Rooms" value={form.accommodationRooms ?? 1} min={1} max={20} onChange={(n) => set("accommodationRooms", n)} />
              <Counter label="People staying" value={form.accommodationGuests ?? 1} min={1} max={40} onChange={(n) => set("accommodationGuests", n)} />
              <Field label="Check-in">
                <input className="input" type="date" value={form.checkInDate ?? ""} onChange={(e) => set("checkInDate", e.target.value || null)} />
              </Field>
              <Field label="Check-out">
                <input className="input" type="date" value={form.checkOutDate ?? ""} onChange={(e) => set("checkOutDate", e.target.value || null)} />
              </Field>
            </div>
          )}
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-maroon" checked={form.needsShuttle} onChange={(e) => set("needsShuttle", e.target.checked)} />
            I&apos;d like the venue shuttle
          </label>
        </>
      )}
      <Field label="Note to the couple">
        <textarea className="input min-h-16" value={form.note ?? ""} onChange={(e) => set("note", e.target.value)} maxLength={500} />
      </Field>
      {save.isError && <p className="text-sm text-maroon">{errorMessage(save.error)}</p>}
      <button className="btn-primary w-full" disabled={save.isPending}>
        {save.isPending ? "Saving…" : r ? "Update RSVP" : "Send RSVP"}
      </button>
    </form>
  );
}

export function RsvpDialog({ open, onClose, slug }: { open: boolean; onClose: () => void; slug: string }) {
  const q = useQuery({ queryKey: ["rsvp", slug], queryFn: () => endpoints.myRsvp(slug), enabled: open });
  return (
    <Modal open={open} onClose={onClose} title="RSVP" wide>
      {q.isPending ? <Spinner /> : q.isError ? <p className="text-sm text-maroon">{errorMessage(q.error)}</p> : <RsvpForm key={q.data.rsvp?.updatedAt ?? "new"} slug={slug} data={q.data} onDone={onClose} />}
    </Modal>
  );
}
