"use client";

import { MonitorPlay, Printer } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Field } from "@/components/ui";
import { stageQrUrl } from "@/lib/api";
import type { TabProps } from "./shared";

const MODE_LABEL = {
  NAMES_AND_BLESSINGS: "donor names and blessings",
  ANONYMIZED: "donor initials only",
  PROGRESS_ONLY: "only the progress of the home",
};

export function StageTab({ slug, wedding }: TabProps) {
  const [tables, setTables] = useState(12);
  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap items-center gap-4 p-5">
        <MonitorPlay className="text-gold" size={32} />
        <div className="flex-1">
          <h3 className="font-serif text-lg font-bold">Venue LED screen</h3>
          <p className="text-sm text-muted">
            Open this on the venue screen (signed in as a host or venue staff). It updates live as gifts and blessings arrive and currently shows {MODE_LABEL[wedding.stageDisplayMode]}.
          </p>
        </div>
        <Link href={`/stage/${slug}`} target="_blank" className="btn-primary">
          Launch stage screen
        </Link>
      </div>

      <div className="card space-y-4 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-serif text-lg font-bold">Table QR codes</h3>
            <p className="text-sm text-muted">Guests scan to gift instantly; the table number is attached to their gift and blessing.</p>
          </div>
          <div className="flex items-end gap-2">
            <Field label="Tables">
              <input className="input !w-24" type="number" min={1} max={100} value={tables} onChange={(e) => setTables(Math.max(1, Math.min(100, Number(e.target.value))))} />
            </Field>
            <button className="btn-ghost !py-2.5" onClick={() => window.print()}>
              <Printer size={16} /> Print
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6 print:grid-cols-4">
          <figure className="rounded-xl border border-line bg-white p-3 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- PNG served by the API */}
            <img src={stageQrUrl(slug)} alt="General gift QR code" className="mx-auto aspect-square w-full" loading="lazy" />
            <figcaption className="mt-1 text-xs font-semibold">General</figcaption>
          </figure>
          {Array.from({ length: tables }, (_, i) => String(i + 1)).map((t) => (
            <figure key={t} className="rounded-xl border border-line bg-white p-3 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- PNG served by the API */}
              <img src={stageQrUrl(slug, t)} alt={`Table ${t} QR code`} className="mx-auto aspect-square w-full" loading="lazy" />
              <figcaption className="mt-1 text-xs font-semibold">Table {t}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </div>
  );
}
