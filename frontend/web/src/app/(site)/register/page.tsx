"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { errorMessage, Field } from "@/components/ui";
import { endpoints } from "@/lib/api";
import { formatInr } from "@/lib/format";

function Form() {
  const router = useRouter();
  const flats = useQuery({ queryKey: ["flats"], queryFn: endpoints.flats });
  const [brideName, setBrideName] = useState("");
  const [groomName, setGroomName] = useState("");
  const [welcomeNote, setWelcomeNote] = useState("");
  const [city, setCity] = useState("");
  const [contactMobile, setContactMobile] = useState("");
  const [flatId, setFlatId] = useState("");
  const [title, setTitle] = useState("Wedding");
  const [startsAt, setStartsAt] = useState("");
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [venueMapsUrl, setVenueMapsUrl] = useState("");
  const save = useMutation({
    mutationFn: () =>
      endpoints.registerWedding({
        brideName,
        groomName,
        welcomeNote,
        city,
        contactMobile,
        flatId,
        ceremonies: [{ title, startsAt: new Date(startsAt).toISOString(), venueName, venueAddress, venueMapsUrl }],
      }),
    onSuccess: () => router.push("/admin"),
  });
  return (
    <form
      className="mx-auto w-full max-w-2xl space-y-4 px-4 py-10"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <p className="text-xs font-semibold tracking-[0.25em] text-maroon uppercase">Couple</p>
      <h1 className="font-display text-3xl font-bold text-maroon">Register a marriage</h1>
      <p className="text-sm text-muted">This goes to the admin for approval. The flat stays available to others until it is approved.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Bride"><input className="input" value={brideName} onChange={(e) => setBrideName(e.target.value)} required /></Field>
        <Field label="Groom"><input className="input" value={groomName} onChange={(e) => setGroomName(e.target.value)} required /></Field>
      </div>
      <Field label="Your story"><textarea className="input min-h-24" value={welcomeNote} onChange={(e) => setWelcomeNote(e.target.value)} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="City"><input className="input" value={city} onChange={(e) => setCity(e.target.value)} /></Field>
        <Field label="Contact mobile for the admin"><input className="input" value={contactMobile} onChange={(e) => setContactMobile(e.target.value)} required /></Field>
      </div>
      <Field label="Ceremony">
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Date and time"><input className="input" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required /></Field>
        <Field label="Venue"><input className="input" value={venueName} onChange={(e) => setVenueName(e.target.value)} required /></Field>
      </div>
      <Field label="Address"><input className="input" value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)} /></Field>
      <Field label="Map link"><input className="input" value={venueMapsUrl} onChange={(e) => setVenueMapsUrl(e.target.value)} placeholder="https://maps.google.com/..." /></Field>
      <Field label="Choose a flat">
        <div className="grid gap-2">
          {flats.data?.map((flat) => (
            <label key={flat.id} className={`card block cursor-pointer p-3 ${flatId === flat.id ? "border-maroon" : ""}`}>
              <input className="mr-2" type="radio" name="flat" checked={flatId === flat.id} onChange={() => setFlatId(flat.id)} required />
              <span className="font-semibold">{flat.name}</span>
              <span className="mt-1 block text-xs text-muted">
                {flat.flatType} • {flat.location} • {flat.totalSft} sq.ft. • {formatInr(flat.pricePerSftPaise)} / sq.ft. • {flat.brickRatio} bricks = 1 sq.ft.
              </span>
            </label>
          ))}
          {flats.isSuccess && !flats.data.length && <p className="text-sm text-muted">No flats are available yet. An admin needs to list one.</p>}
        </div>
      </Field>
      {save.isError && <p className="text-sm text-maroon">{errorMessage(save.error)}</p>}
      <button className="btn-primary" disabled={save.isPending || !flatId}>
        {save.isPending ? "Submitting…" : "Submit for approval"}
      </button>
    </form>
  );
}

export default function RegisterPage() {
  return (
    <RequireAuth>
      <Form />
    </RequireAuth>
  );
}
