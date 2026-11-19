"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageUp, Trash2, UserPlus, Video } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { RoomsEditor } from "@/components/admin/rooms-editor";
import { toWeddingBody, useWeddingForm, WeddingFields } from "@/components/admin/wedding-form";
import { useToast } from "@/components/toast";
import { errorMessage, Field, Spinner } from "@/components/ui";
import { endpoints } from "@/lib/api";
import { ROLE_LABELS } from "@/lib/format";
import type { Member, RoomInput, Wedding } from "@/lib/types";
import type { TabProps } from "./shared";

function DetailsCard({ slug, wedding }: { slug: string; wedding: Wedding }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [values, setValues] = useWeddingForm(wedding);
  const save = useMutation({
    mutationFn: () => endpoints.updateWedding(slug, toWeddingBody(values)),
    onSuccess: () => {
      toast("Wedding details saved");
      void qc.invalidateQueries({ queryKey: ["microsite", slug] });
      void qc.invalidateQueries({ queryKey: ["registry", slug] });
    },
  });
  return (
    <form
      className="card space-y-6 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <WeddingFields values={values} onChange={setValues} accountHint={wedding.escrowAccountLast4 ? `••••${wedding.escrowAccountLast4}` : null} />
      {save.isError && <p className="text-sm text-maroon">{errorMessage(save.error)}</p>}
      <button className="btn-primary" disabled={save.isPending}>
        {save.isPending ? "Saving…" : "Save details"}
      </button>
    </form>
  );
}

function MediaCard({ slug, wedding }: { slug: string; wedding: Wedding }) {
  const qc = useQueryClient();
  const toast = useToast();
  const upload = useMutation({
    mutationFn: ({ kind, file }: { kind: "cover" | "video"; file: File }) => endpoints.uploadMedia(slug, kind, file),
    onSuccess: (_, { kind }) => {
      toast(kind === "cover" ? "Cover photo updated" : "Video invitation uploaded");
      void qc.invalidateQueries({ queryKey: ["microsite", slug] });
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });
  const pick = (kind: "cover" | "video") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload.mutate({ kind, file });
    e.target.value = "";
  };
  return (
    <div className="card space-y-4 p-5">
      <h3 className="font-serif text-lg font-bold text-maroon">Photos & video</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="relative aspect-video overflow-hidden rounded-xl bg-line/50">
            <Image src={wedding.coverPhotoUrl ?? "/images/couple_portrait.jpg"} alt="Cover" fill className="object-cover" />
          </div>
          <label className="btn-ghost mt-2 w-full cursor-pointer !py-2">
            <ImageUp size={16} /> {upload.isPending && upload.variables.kind === "cover" ? "Uploading…" : "Upload cover photo"}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={pick("cover")} />
          </label>
        </div>
        <div>
          <div className="flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-ink">
            {wedding.videoInviteUrl && /\.(mp4|webm)(\?|$)/.test(wedding.videoInviteUrl) ? (
              <video src={wedding.videoInviteUrl} controls className="h-full w-full" />
            ) : (
              <p className="px-4 text-center text-sm text-white/70">{wedding.videoInviteUrl ? `Linked: ${wedding.videoInviteUrl}` : "No video yet"}</p>
            )}
          </div>
          <label className="btn-ghost mt-2 w-full cursor-pointer !py-2">
            <Video size={16} /> {upload.isPending && upload.variables.kind === "video" ? "Uploading…" : "Upload video (MP4, ≤100 MB)"}
            <input type="file" accept="video/mp4,video/webm" className="sr-only" onChange={pick("video")} />
          </label>
        </div>
      </div>
    </div>
  );
}

function RoomsCard({ slug }: { slug: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const registry = useQuery({ queryKey: ["registry", slug], queryFn: () => endpoints.registry(slug) });
  const [rooms, setRooms] = useState<RoomInput[] | null>(null);
  const current: RoomInput[] =
    rooms ?? registry.data?.rooms.map((r) => ({ key: r.key, name: r.name, sft: r.sft, icon: r.icon, description: r.description })) ?? [];
  const save = useMutation({
    mutationFn: () => endpoints.replaceRooms(slug, current),
    onSuccess: (state) => {
      qc.setQueryData(["registry", slug], state);
      setRooms(null);
      toast("Floor plan saved");
    },
  });
  if (registry.isPending) return <Spinner />;
  const giftedKeys = registry.data?.rooms.filter((r) => r.fundedSft + r.heldSft > 0).map((r) => r.key) ?? [];
  return (
    <form
      className="card space-y-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div>
        <h3 className="font-serif text-lg font-bold text-maroon">Floor plan</h3>
        <p className="text-xs text-muted">Rooms that already have gifts can be renamed or enlarged but not removed or shrunk below the gifted area.</p>
      </div>
      <RoomsEditor rooms={current} onChange={setRooms} lockedKeys={giftedKeys} />
      {save.isError && <p className="text-sm text-maroon">{errorMessage(save.error)}</p>}
      <button className="btn-primary" disabled={save.isPending || !rooms}>
        {save.isPending ? "Saving…" : "Save floor plan"}
      </button>
    </form>
  );
}

function MembersCard({ slug, canManage }: { slug: string; canManage: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const members = useQuery({ queryKey: ["members", slug], queryFn: () => endpoints.members(slug) });
  const [form, setForm] = useState({ phone: "", name: "", role: "LEAD" as Member["role"], label: "" });
  const add = useMutation({
    mutationFn: () => endpoints.addMember(slug, { phone: form.phone, name: form.name || undefined, role: form.role, label: form.label || undefined }),
    onSuccess: () => {
      toast("Team member added");
      setForm({ phone: "", name: "", role: "LEAD", label: "" });
      void qc.invalidateQueries({ queryKey: ["members", slug] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => endpoints.removeMember(slug, id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["members", slug] }),
    onError: (e) => toast(errorMessage(e), "error"),
  });
  return (
    <div className="card space-y-4 p-5">
      <div>
        <h3 className="font-serif text-lg font-bold text-maroon">Team</h3>
        <p className="text-xs text-muted">Co-hosts manage everything; family leads see and invite only their own family; venue staff run the stage and RSVP lists.</p>
      </div>
      {members.isPending ? (
        <Spinner />
      ) : (
        <ul className="divide-y divide-line/60">
          {members.data?.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-2 text-sm">
              <div className="flex-1">
                <p className="font-semibold">{m.user.name ?? m.user.phone}</p>
                <p className="text-xs text-muted">
                  {m.user.phone} • {ROLE_LABELS[m.role]}
                  {m.label && ` • ${m.label}`}
                </p>
              </div>
              {canManage && m.role !== "HOST" && (
                <button
                  className="rounded-lg p-2 text-maroon hover:bg-gold"
                  aria-label="Remove member"
                  onClick={() => {
                    if (confirm(`Remove ${m.user.name ?? m.user.phone}?`)) remove.mutate(m.id);
                  }}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canManage && (
        <form
          className="grid gap-2 sm:grid-cols-[1fr_1fr_140px_1fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
        >
          <Field label="Phone">
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required inputMode="tel" />
          </Field>
          <Field label="Name">
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} />
          </Field>
          <Field label="Role">
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Member["role"] })}>
              <option value="CO_HOST">Co-host</option>
              <option value="LEAD">Family lead</option>
              <option value="VENUE">Venue staff</option>
            </select>
          </Field>
          <Field label="Family tag">
            <input className="input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. rao-family" required={form.role === "LEAD"} pattern="[A-Za-z0-9_\-]{2,30}" />
          </Field>
          <button className="btn-primary !py-2.5" disabled={add.isPending}>
            <UserPlus size={16} /> Add
          </button>
          {add.isError && <p className="text-sm text-maroon sm:col-span-5">{errorMessage(add.error)}</p>}
        </form>
      )}
    </div>
  );
}

function LinkCard({ slug, wedding }: { slug: string; wedding: Wedding }) {
  const toast = useToast();
  const [visibility, setVisibility] = useState(wedding.linkVisibility ?? "PUBLIC");
  const [hideAmounts, setHideAmounts] = useState(Boolean(wedding.hideAmountsFromGuests));
  const [legalName, setLegalName] = useState("");
  const [idLast4, setIdLast4] = useState("");
  const save = useMutation({
    mutationFn: () => endpoints.updateWedding(slug, { linkVisibility: visibility, hideAmountsFromGuests: hideAmounts }),
    onSuccess: () => toast("Link settings saved"),
  });
  const nudge = useMutation({
    mutationFn: () => endpoints.sendFollowUps(slug),
    onSuccess: (res) => toast(`Sent ${res.sent} of ${res.eligible} reminders`),
    onError: (e) => toast(errorMessage(e), "error"),
  });
  const kyc = useMutation({
    mutationFn: () => endpoints.submitKyc(slug, { legalName, idLast4 }),
    onSuccess: () => toast("KYC submitted for payout review"),
    onError: (e) => toast(errorMessage(e), "error"),
  });
  return (
    <div className="card space-y-4 p-5">
      <h3 className="font-serif text-lg font-bold text-maroon">Link, reminders and payout identity</h3>
      <p className="text-xs text-muted">Status: {wedding.approvalStatus ?? "APPROVED"} {wedding.approvalNote ? `• ${wedding.approvalNote}` : ""} • KYC {wedding.kycStatus ?? "NOT_REQUIRED"}</p>
      <Field label="Wedding link">
        <select className="input" value={visibility} onChange={(e) => setVisibility(e.target.value as NonNullable<Wedding["linkVisibility"]>)}>
          <option value="PUBLIC">Public link</option>
          <option value="PRIVATE">Private (invitees only, hidden from the feed)</option>
          <option value="PAUSED">Paused</option>
        </select>
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={hideAmounts} onChange={(e) => setHideAmounts(e.target.checked)} />
        Hide gift amounts from other guests
      </label>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary !py-2" onClick={() => save.mutate()} disabled={save.isPending}>Save link</button>
        <button className="btn-ghost !py-2" onClick={() => nudge.mutate()} disabled={nudge.isPending}>Remind guests who have not replied</button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Legal name for payout"><input className="input" value={legalName} onChange={(e) => setLegalName(e.target.value)} /></Field>
        <Field label="ID last 4"><input className="input" value={idLast4} onChange={(e) => setIdLast4(e.target.value)} maxLength={4} /></Field>
      </div>
      <button className="btn-ghost !py-2" onClick={() => kyc.mutate()} disabled={legalName.length < 2 || idLast4.length !== 4}>Submit identity for payouts</button>
    </div>
  );
}

export function SettingsTab({ slug, wedding, role }: TabProps) {
  return (
    <div className="space-y-6">
      <LinkCard slug={slug} wedding={wedding} />
      <DetailsCard key={wedding.id} slug={slug} wedding={wedding} />
      <MediaCard slug={slug} wedding={wedding} />
      <RoomsCard slug={slug} />
      <MembersCard slug={slug} canManage={role === "HOST" || role === "CO_HOST"} />
    </div>
  );
}
