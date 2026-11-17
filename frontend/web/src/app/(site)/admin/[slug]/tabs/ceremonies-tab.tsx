"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/toast";
import { EmptyState, errorMessage, ErrorState, Field, Modal, Spinner } from "@/components/ui";
import { endpoints } from "@/lib/api";
import { formatDateTime, fromLocalInput, toLocalInput } from "@/lib/format";
import type { Ceremony } from "@/lib/types";
import { ADMIN, can, type TabProps } from "./shared";

function CeremonyForm({ slug, ceremony, nextOrder, onDone }: { slug: string; ceremony: Ceremony | null; nextOrder: number; onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({
    title: ceremony?.title ?? "",
    description: ceremony?.description ?? "",
    startsAt: toLocalInput(ceremony?.startsAt),
    endsAt: toLocalInput(ceremony?.endsAt),
    venueName: ceremony?.venueName ?? "",
    venueAddress: ceremony?.venueAddress ?? "",
    venueMapsUrl: ceremony?.venueMapsUrl ?? "",
    streamUrl: ceremony?.streamUrl ?? "",
    dressCode: ceremony?.dressCode ?? "",
    sortOrder: ceremony?.sortOrder ?? nextOrder,
  });
  const set = (k: keyof typeof f, v: string | number) => setF((s) => ({ ...s, [k]: v }));
  const save = useMutation({
    mutationFn: () => {
      const body = {
        ...f,
        description: f.description || null,
        venueAddress: f.venueAddress || null,
        dressCode: f.dressCode || null,
        startsAt: fromLocalInput(f.startsAt) ?? undefined,
        endsAt: fromLocalInput(f.endsAt),
      };
      return ceremony ? endpoints.updateCeremony(slug, ceremony.id, body) : endpoints.createCeremony(slug, body);
    },
    onSuccess: () => {
      toast(ceremony ? "Ceremony updated" : "Ceremony added");
      void qc.invalidateQueries({ queryKey: ["ceremonies", slug] });
      void qc.invalidateQueries({ queryKey: ["microsite", slug] });
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
      <Field label="Title">
        <input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} required maxLength={80} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Starts (IST)">
          <input className="input" type="datetime-local" value={f.startsAt} onChange={(e) => set("startsAt", e.target.value)} required />
        </Field>
        <Field label="Ends (IST)">
          <input className="input" type="datetime-local" value={f.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
        </Field>
        <Field label="Venue">
          <input className="input" value={f.venueName} onChange={(e) => set("venueName", e.target.value)} required maxLength={100} />
        </Field>
        <Field label="Dress code">
          <input className="input" value={f.dressCode} onChange={(e) => set("dressCode", e.target.value)} maxLength={40} />
        </Field>
      </div>
      <Field label="Address">
        <input className="input" value={f.venueAddress} onChange={(e) => set("venueAddress", e.target.value)} maxLength={300} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Google Maps link">
          <input className="input" type="url" value={f.venueMapsUrl} onChange={(e) => set("venueMapsUrl", e.target.value)} />
        </Field>
        <Field label="Live stream link">
          <input className="input" type="url" value={f.streamUrl} onChange={(e) => set("streamUrl", e.target.value)} />
        </Field>
      </div>
      <Field label="Description">
        <textarea className="input min-h-20" value={f.description} onChange={(e) => set("description", e.target.value)} maxLength={1000} />
      </Field>
      <Field label="Display order">
        <input className="input" type="number" min={0} max={1000} value={f.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value))} />
      </Field>
      {save.isError && <p className="text-sm text-maroon">{errorMessage(save.error)}</p>}
      <button className="btn-primary w-full" disabled={save.isPending}>
        {save.isPending ? "Saving…" : ceremony ? "Save changes" : "Add ceremony"}
      </button>
    </form>
  );
}

export function CeremoniesTab({ slug, wedding, role }: TabProps) {
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<Ceremony | "new" | null>(null);
  const q = useQuery({ queryKey: ["ceremonies", slug], queryFn: () => endpoints.ceremonies(slug) });
  const remove = useMutation({
    mutationFn: (id: string) => endpoints.deleteCeremony(slug, id),
    onSuccess: () => {
      toast("Ceremony removed");
      void qc.invalidateQueries({ queryKey: ["ceremonies", slug] });
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });
  const editable = can(role, ADMIN);

  if (q.isPending) return <Spinner />;
  if (q.isError) return <ErrorState error={q.error} />;
  return (
    <div className="space-y-4">
      {editable && (
        <button className="btn-primary !py-2" onClick={() => setEditing("new")}>
          <Plus size={16} /> Add ceremony
        </button>
      )}
      {!q.data.length ? (
        <EmptyState title="No ceremonies yet">Add Haldi, Mehendi, Muhurtham and more. Guests see only the ones they&apos;re invited to.</EmptyState>
      ) : (
        <div className="space-y-3">
          {q.data.map((c) => (
            <div key={c.id} className="card flex flex-wrap items-center gap-4 p-4">
              <div className="flex-1">
                <p className="font-serif text-lg font-bold">{c.title}</p>
                <p className="text-sm text-muted">
                  {formatDateTime(c.startsAt, wedding.timezone)}
                  {c.endsAt && ` – ${formatDateTime(c.endsAt, wedding.timezone)}`}
                </p>
                <p className="mt-1 flex items-center gap-1 text-sm">
                  <MapPin size={14} className="text-gold" /> {c.venueName}
                  {c.dressCode && <span className="text-muted"> • Dress code: {c.dressCode}</span>}
                </p>
              </div>
              <div className="flex gap-1">
                <button className="rounded-lg p-2 hover:bg-line/60" title="Download calendar file" onClick={() => endpoints.ceremonyIcs(slug, c.id).catch((e) => toast(errorMessage(e), "error"))}>
                  <CalendarPlus size={16} />
                </button>
                {editable && (
                  <>
                    <button className="rounded-lg p-2 hover:bg-line/60" title="Edit" onClick={() => setEditing(c)}>
                      <Pencil size={16} />
                    </button>
                    <button
                      className="rounded-lg p-2 text-maroon hover:bg-rose-50"
                      title="Delete"
                      onClick={() => {
                        if (confirm(`Delete "${c.title}"? Guests will no longer see it.`)) remove.mutate(c.id);
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Add ceremony" : "Edit ceremony"} wide>
        {editing !== null && (
          <CeremonyForm
            key={editing === "new" ? "new" : editing.id}
            slug={slug}
            ceremony={editing === "new" ? null : editing}
            nextOrder={q.data.length}
            onDone={() => setEditing(null)}
          />
        )}
      </Modal>
    </div>
  );
}
