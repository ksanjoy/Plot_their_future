"use client";

import { useState, type ReactNode } from "react";
import { fromLocalInput, toLocalInput } from "@/lib/format";
import type { StageDisplayMode, Wedding } from "@/lib/types";
import { Field } from "../ui";

export interface WeddingFormValues {
  brideName: string;
  groomName: string;
  city: string;
  weddingDate: string;
  welcomeNote: string;
  videoInviteUrl: string;
  propertyName: string;
  propertyLocation: string;
  ratePerSft: number;
  presetTiers: string;
  holdMinutes: number;
  reraRegId: string;
  escrowBankName: string;
  escrowAccountNumber: string;
  escrowIfsc: string;
  taxExemptionEnabled: boolean;
  stageDisplayMode: StageDisplayMode;
}

export const initialWeddingValues = (w?: Wedding | null): WeddingFormValues => ({
  brideName: w?.brideName ?? "",
  groomName: w?.groomName ?? "",
  city: w?.city ?? "",
  weddingDate: toLocalInput(w?.weddingDate),
  welcomeNote: w?.welcomeNote ?? "",
  videoInviteUrl: w?.videoInviteUrl ?? "",
  propertyName: w?.propertyName ?? "",
  propertyLocation: w?.propertyLocation ?? "",
  ratePerSft: w ? Math.round(w.ratePerSftPaise / 100) : 4500,
  presetTiers: (w?.presetTiers ?? [1, 5, 10, 25]).join(", "),
  holdMinutes: w ? Math.round(w.cartHoldTtlSec / 60) : 15,
  reraRegId: w?.reraRegId ?? "",
  escrowBankName: w?.escrowBankName ?? "",
  escrowAccountNumber: "",
  escrowIfsc: w?.escrowIfsc ?? "",
  taxExemptionEnabled: w?.taxExemptionEnabled ?? true,
  stageDisplayMode: w?.stageDisplayMode ?? "NAMES_AND_BLESSINGS",
});

/** Maps form values to the API body; blank optional fields become null, an untouched account number is omitted. */
export function toWeddingBody(v: WeddingFormValues) {
  const opt = (s: string) => (s.trim() ? s.trim() : null);
  const tiers = v.presetTiers
    .split(/[,\s]+/)
    .map((t) => Number.parseInt(t, 10))
    .filter((n) => n > 0);
  return {
    brideName: v.brideName.trim(),
    groomName: v.groomName.trim(),
    city: opt(v.city),
    weddingDate: fromLocalInput(v.weddingDate),
    welcomeNote: opt(v.welcomeNote),
    videoInviteUrl: opt(v.videoInviteUrl),
    propertyName: opt(v.propertyName),
    propertyLocation: opt(v.propertyLocation),
    ratePerSft: v.ratePerSft,
    presetTiers: [...new Set(tiers)].sort((a, b) => a - b).slice(0, 6),
    cartHoldTtlSec: v.holdMinutes * 60,
    reraRegId: opt(v.reraRegId),
    escrowBankName: opt(v.escrowBankName),
    ...(v.escrowAccountNumber.trim() ? { escrowAccountNumber: v.escrowAccountNumber.trim() } : {}),
    escrowIfsc: opt(v.escrowIfsc.toUpperCase()),
    taxExemptionEnabled: v.taxExemptionEnabled,
    stageDisplayMode: v.stageDisplayMode,
  };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 font-serif text-lg font-bold text-maroon">{title}</legend>
      {children}
    </fieldset>
  );
}

export function WeddingFields({
  values,
  onChange,
  accountHint,
}: {
  values: WeddingFormValues;
  onChange: (v: WeddingFormValues) => void;
  accountHint?: string | null;
}) {
  const set = <K extends keyof WeddingFormValues>(k: K, v: WeddingFormValues[K]) => onChange({ ...values, [k]: v });
  return (
    <div className="space-y-8">
      <Section title="The couple">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Bride's name">
            <input className="input" value={values.brideName} onChange={(e) => set("brideName", e.target.value)} required maxLength={50} />
          </Field>
          <Field label="Groom's name">
            <input className="input" value={values.groomName} onChange={(e) => set("groomName", e.target.value)} required maxLength={50} />
          </Field>
          <Field label="Wedding date & time (IST)">
            <input className="input" type="datetime-local" value={values.weddingDate} onChange={(e) => set("weddingDate", e.target.value)} />
          </Field>
          <Field label="City">
            <input className="input" value={values.city} onChange={(e) => set("city", e.target.value)} maxLength={80} />
          </Field>
        </div>
        <Field label="Welcome note">
          <textarea className="input min-h-24" value={values.welcomeNote} onChange={(e) => set("welcomeNote", e.target.value)} maxLength={2000} />
        </Field>
        <Field label="Video invitation link" hint="YouTube/Vimeo link, or upload a video in Settings after creating">
          <input className="input" type="url" value={values.videoInviteUrl} onChange={(e) => set("videoInviteUrl", e.target.value)} />
        </Field>
      </Section>

      <Section title="The home">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Property name">
            <input className="input" value={values.propertyName} onChange={(e) => set("propertyName", e.target.value)} maxLength={120} />
          </Field>
          <Field label="Location">
            <input className="input" value={values.propertyLocation} onChange={(e) => set("propertyLocation", e.target.value)} maxLength={160} />
          </Field>
          <Field label="Price per sq.ft. (₹)">
            <input className="input" type="number" min={100} max={100000} value={values.ratePerSft} onChange={(e) => set("ratePerSft", Number(e.target.value))} required />
          </Field>
          <Field label="Gift presets (sq.ft.)" hint="Up to 6, comma separated">
            <input className="input" value={values.presetTiers} onChange={(e) => set("presetTiers", e.target.value)} />
          </Field>
          <Field label="Checkout hold (minutes)">
            <input className="input" type="number" min={1} max={60} value={values.holdMinutes} onChange={(e) => set("holdMinutes", Number(e.target.value))} />
          </Field>
          <Field label="RERA registration">
            <input className="input" value={values.reraRegId} onChange={(e) => set("reraRegId", e.target.value)} maxLength={40} />
          </Field>
        </div>
      </Section>

      <Section title="Escrow account">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Bank">
            <input className="input" value={values.escrowBankName} onChange={(e) => set("escrowBankName", e.target.value)} maxLength={80} />
          </Field>
          <Field label="Account number" hint={accountHint ? `Current: ${accountHint}. Leave blank to keep.` : undefined}>
            <input className="input" inputMode="numeric" pattern="\d{6,20}" value={values.escrowAccountNumber} onChange={(e) => set("escrowAccountNumber", e.target.value)} />
          </Field>
          <Field label="IFSC">
            <input className="input uppercase" value={values.escrowIfsc} onChange={(e) => set("escrowIfsc", e.target.value)} pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}" />
          </Field>
        </div>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-maroon" checked={values.taxExemptionEnabled} onChange={(e) => set("taxExemptionEnabled", e.target.checked)} />
          Show the Sec 56(2)(x) marriage-gift tax exemption on receipts
        </label>
      </Section>

      <Section title="Venue LED screen">
        <Field label="What the stage screen shows">
          <select className="input" value={values.stageDisplayMode} onChange={(e) => set("stageDisplayMode", e.target.value as StageDisplayMode)}>
            <option value="NAMES_AND_BLESSINGS">Donor names and blessings</option>
            <option value="ANONYMIZED">Initials only</option>
            <option value="PROGRESS_ONLY">Progress only</option>
          </select>
        </Field>
      </Section>
    </div>
  );
}

export function useWeddingForm(w?: Wedding | null) {
  return useState<WeddingFormValues>(() => initialWeddingValues(w));
}
