"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { errorMessage, Field } from "@/components/ui";
import { endpoints } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatInr } from "@/lib/format";

const TABS = ["Approvals", "Flats", "Gifts", "Users", "Content", "Analytics", "Complaints"] as const;

function Desk() {
  const { user } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Approvals");
  if (user && !user.isPlatformAdmin) return <p className="p-10 text-sm text-muted">Platform admin only.</p>;
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <h1 className="font-display text-3xl font-bold text-maroon">Platform desk</h1>
      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button key={item} className={`chip ${tab === item ? "chip-active" : ""}`} onClick={() => setTab(item)}>
            {item}
          </button>
        ))}
      </div>
      <div className="mt-6">{tab === "Approvals" ? <Approvals /> : tab === "Flats" ? <Flats /> : tab === "Gifts" ? <Gifts /> : tab === "Users" ? <Users /> : tab === "Content" ? <Content /> : tab === "Analytics" ? <Analytics /> : <Complaints />}</div>
    </div>
  );
}

function Approvals() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["approvals"], queryFn: endpoints.approvals });
  const decide = useMutation({
    mutationFn: (input: { id: string; decision: string; reason?: string }) => endpoints.decideApproval(input.id, { decision: input.decision, reason: input.reason }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["approvals"] }),
  });
  return (
    <div className="space-y-3">
      {q.data?.map((row) => (
        <article key={row.id} className="card p-4">
          <p className="font-semibold">{row.brideName} & {row.groomName}</p>
          <p className="text-xs text-muted">{row.approvalStatus} • {row.contactMobile} • {row.flat?.name} • {row.flat?.location}</p>
          <p className="mt-2 text-sm">{row.welcomeNote}</p>
          <ul className="mt-2 text-xs text-muted">
            {row.ceremonies.map((c) => (
              <li key={c.id}>{c.title} • {c.venueName} {c.venueMapsUrl ? `• ${c.venueMapsUrl}` : ""}</li>
            ))}
          </ul>
          {row.registrant && (
            <p className="mt-2 text-xs">
              <a className="text-maroon underline" href={`tel:${row.registrant.phone}`}>Call</a>
              {" • "}
              <a className="text-maroon underline" href={`https://wa.me/${row.registrant.phone.replace(/\D/g, "")}`}>WhatsApp</a>
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn-primary !py-1" onClick={() => decide.mutate({ id: row.id, decision: "APPROVED" })}>Approve</button>
            <button className="btn-ghost !py-1" onClick={() => decide.mutate({ id: row.id, decision: "CHANGES_REQUESTED", reason: prompt("What should change?") || "Please update the details" })}>Request changes</button>
            <button className="btn-ghost !py-1" onClick={() => decide.mutate({ id: row.id, decision: "REJECTED", reason: prompt("Reason?") || "Not approved" })}>Reject</button>
          </div>
        </article>
      ))}
      {q.isSuccess && !q.data.length && <p className="text-sm text-muted">No registrations waiting.</p>}
      {decide.isError && <p className="text-sm text-maroon">{errorMessage(decide.error)}</p>}
    </div>
  );
}

function Flats() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-flats"], queryFn: endpoints.adminFlats });
  const [name, setName] = useState("2 BHK");
  const [location, setLocation] = useState("");
  const [flatType, setFlatType] = useState("2 BHK");
  const [pricePerSft, setPricePerSft] = useState(4500);
  const [brickRatio, setBrickRatio] = useState(10);
  const [targetAmount, setTargetAmount] = useState(500000);
  const [areaName, setAreaName] = useState("Living room");
  const [areaSft, setAreaSft] = useState(400);
  const create = useMutation({
    mutationFn: () =>
      endpoints.createFlat({
        name,
        location,
        flatType,
        pricePerSft,
        brickRatio,
        targetAmount,
        areas: [{ name: areaName, sft: areaSft }],
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin-flats"] }),
  });
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <form className="card space-y-3 p-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
        <Field label="Flat name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
        <Field label="Location"><input className="input" value={location} onChange={(e) => setLocation(e.target.value)} required /></Field>
        <Field label="Type"><input className="input" value={flatType} onChange={(e) => setFlatType(e.target.value)} required /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="₹ / sq.ft."><input className="input" type="number" value={pricePerSft} onChange={(e) => setPricePerSft(Number(e.target.value))} /></Field>
          <Field label="Bricks per sq.ft."><input className="input" type="number" value={brickRatio} onChange={(e) => setBrickRatio(Number(e.target.value))} /></Field>
        </div>
        <Field label="Down-payment target (₹)"><input className="input" type="number" value={targetAmount} onChange={(e) => setTargetAmount(Number(e.target.value))} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="First area"><input className="input" value={areaName} onChange={(e) => setAreaName(e.target.value)} /></Field>
          <Field label="Sq.ft."><input className="input" type="number" value={areaSft} onChange={(e) => setAreaSft(Number(e.target.value))} /></Field>
        </div>
        {create.isError && <p className="text-sm text-maroon">{errorMessage(create.error)}</p>}
        <button className="btn-primary">Add flat</button>
      </form>
      <ul className="space-y-2">
        {q.data?.map((flat) => (
          <li key={flat.id} className="card p-3 text-sm">
            <p className="font-semibold">{flat.name} • {flat.status}</p>
            <p className="text-xs text-muted">{flat.flatType} • {flat.location} • {flat.totalSft} sq.ft. • {formatInr(flat.pricePerSftPaise)} / sq.ft.</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Gifts() {
  const q = useQuery({ queryKey: ["admin-gifts"], queryFn: () => endpoints.adminGifts() });
  return (
    <ul className="space-y-2 text-sm">
      {q.data?.map((gift) => (
        <li key={gift.id} className="card p-3">
          {gift.donorName} • {gift.unitKind} • {formatInr(gift.amountPaise)} • {gift.status} • {gift.wedding?.brideName} & {gift.wedding?.groomName}
        </li>
      ))}
    </ul>
  );
}

function Users() {
  const qc = useQueryClient();
  const [qtext, setQtext] = useState("");
  const q = useQuery({ queryKey: ["admin-users", qtext], queryFn: () => endpoints.adminUsers(qtext || undefined) });
  const block = useMutation({
    mutationFn: (id: string) => endpoints.blockUser(id, prompt("Reason for blocking?") || "Abusive account"),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
  const unblock = useMutation({
    mutationFn: (id: string) => endpoints.unblockUser(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
  return (
    <div>
      <input className="input mb-3 max-w-xs" placeholder="Search name or phone" value={qtext} onChange={(e) => setQtext(e.target.value)} />
      <ul className="space-y-2 text-sm">
        {q.data?.map((user) => (
          <li key={user.id} className="card flex items-center justify-between p-3">
            <span>{user.name ?? "Unnamed"} • {user.phone} • {user.occupation ?? "—"} {user.blockedAt ? "• blocked" : ""}</span>
            {user.blockedAt ? (
              <button className="btn-ghost !py-1" onClick={() => unblock.mutate(user.id)}>Unblock</button>
            ) : (
              <button className="btn-ghost !py-1" onClick={() => block.mutate(user.id)}>Block</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Content() {
  const q = useQuery({ queryKey: ["admin-content"], queryFn: endpoints.adminContent });
  const [en, setEn] = useState("");
  const save = useMutation({
    mutationFn: () => endpoints.saveContent({ disclaimer: { ...(q.data?.disclaimer ?? { en: "", hi: "", te: "" }), en: en || q.data?.disclaimer.en || "" } }),
  });
  return (
    <form className="card space-y-3 p-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <Field label="English disclaimer">
        <textarea className="input min-h-40" defaultValue={q.data?.disclaimer.en} onChange={(e) => setEn(e.target.value)} />
      </Field>
      <p className="text-xs text-muted">Hindi and Telugu copies stay as stored unless you edit them here later. Support: {q.data?.supportPhone ?? "not set"}.</p>
      <button className="btn-primary">Save disclaimer</button>
    </form>
  );
}

function Analytics() {
  const q = useQuery({ queryKey: ["analytics"], queryFn: endpoints.analytics });
  const a = q.data;
  if (!a) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Stat label="Revenue" value={formatInr(a.gifts.revenuePaise)} />
      <Stat label="RSVP → gift" value={`${Math.round(a.conversion.rsvpToGift * 100)}%`} />
      <Stat label="Link → RSVP" value={`${Math.round(a.conversion.linkToRsvp * 100)}%`} />
      <div className="card p-4 sm:col-span-3 text-sm">
        <p>Weddings: {JSON.stringify(a.weddings)}</p>
        <p className="mt-2">Flats: {JSON.stringify(a.flats)}</p>
        <ul className="mt-2">{a.topWeddings.map((w) => <li key={w.slug}>{w.couple} • {formatInr(w.amountPaise)}</li>)}</ul>
      </div>
    </div>
  );
}

function Complaints() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["complaints"], queryFn: endpoints.complaints });
  const update = useMutation({
    mutationFn: (id: string) => endpoints.updateComplaint(id, { status: "RESOLVED", resolution: "Reviewed" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["complaints"] }),
  });
  return (
    <ul className="space-y-2 text-sm">
      {q.data?.map((row) => (
        <li key={row.id} className="card p-3">
          <p className="font-semibold">{row.subject} • {row.status}</p>
          <p>{row.message}</p>
          <p className="text-xs text-muted">{row.user?.name} • {row.user?.phone}</p>
          {row.status !== "RESOLVED" && <button className="btn-ghost mt-2 !py-1" onClick={() => update.mutate(row.id)}>Mark resolved</button>}
        </li>
      ))}
    </ul>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-display text-2xl font-bold text-maroon">{value}</p>
    </div>
  );
}

export function PlatformDesk() {
  return (
    <RequireAuth>
      <Desk />
    </RequireAuth>
  );
}
