"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Maximize, Sparkles } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { ErrorState, PageLoader, ProgressBar } from "@/components/ui";
import { RoomIcon } from "@/components/wedding/floor-plan";
import { endpoints, stageQrUrl } from "@/lib/api";
import { formatInr, percent } from "@/lib/format";
import { useLive } from "@/lib/live";
import type { StagePayload, WallEntry } from "@/lib/types";

export function StageScreen() {
  const { slug } = useParams<{ slug: string }>();
  return (
    <RequireAuth>
      <Stage slug={slug} />
    </RequireAuth>
  );
}

function Stage({ slug }: { slug: string }) {
  const qc = useQueryClient();
  const key = ["stage", slug];
  const q = useQuery({ queryKey: key, queryFn: () => endpoints.stage(slug), refetchInterval: 5 * 60_000 });
  const [celebrate, setCelebrate] = useState<WallEntry | null>(null);
  const [spot, setSpot] = useState(0);

  useLive(
    slug,
    "stage",
    {
      "registry.updated": (r) =>
        qc.setQueryData<StagePayload>(key, (old) =>
          old
            ? {
                ...old,
                registry: { ...old.registry, ...r },
              }
            : old,
        ),
      "contribution.funded": (entry) => {
        qc.setQueryData<StagePayload>(key, (old) => (old && !old.donors.some((d) => d.id === entry.id) ? { ...old, donors: [entry, ...old.donors].slice(0, 50) } : old));
        setCelebrate(entry);
      },
      "blessing.approved": (b) => {
        qc.setQueryData<StagePayload>(key, (old) => (old && !old.blessings.some((x) => x.id === b.id) ? { ...old, blessings: [b, ...old.blessings].slice(0, 50) } : old));
        setSpot(0);
      },
    },
    q.isSuccess,
  );

  useEffect(() => {
    if (!celebrate) return;
    const t = setTimeout(() => setCelebrate(null), 8000);
    return () => clearTimeout(t);
  }, [celebrate]);

  const blessingCount = q.data?.blessings.length ?? 0;
  useEffect(() => {
    if (blessingCount < 2) return;
    const t = setInterval(() => setSpot((s) => (s + 1) % blessingCount), 9000);
    return () => clearInterval(t);
  }, [blessingCount]);

  if (q.isPending) return <PageLoader />;
  if (q.isError) return <ErrorState error={q.error} />;
  const { wedding: w, registry: r, donors, blessings } = q.data;
  const showPeople = w.displayMode !== "PROGRESS_ONLY";
  const blessing = blessings[spot % Math.max(1, blessings.length)];

  return (
    <div className="maroon-gradient relative flex h-dvh flex-col overflow-hidden text-white">
      <button
        className="absolute top-4 right-4 z-20 rounded-full bg-white/10 p-2 opacity-30 transition hover:opacity-100"
        onClick={() => void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())}
        aria-label="Toggle full screen"
      >
        <Maximize size={18} />
      </button>

      <div className="grid flex-1 grid-cols-[3fr_2fr] gap-8 p-10">
        <div className="flex flex-col">
          <p className="text-sm tracking-[0.4em] text-gold-light uppercase">Building their first home</p>
          <h1 className="mt-3 font-display text-6xl leading-tight font-bold">
            {w.brideName} <span className="font-serif text-gold-light italic">&amp;</span> {w.groomName}
          </h1>
          {w.propertyName && <p className="mt-2 font-serif text-2xl text-white/80 italic">{w.propertyName}</p>}

          <div className="mt-10">
            <div className="flex items-end justify-between">
              <p className="font-display text-7xl font-bold text-gold-light tabular-nums">
                {r.fundedSft.toLocaleString("en-IN")}
                <span className="ml-3 text-3xl text-white/70">/ {r.totalSft.toLocaleString("en-IN")} sq.ft.</span>
              </p>
              <p className="font-display text-4xl font-bold">{percent(r.progress)}</p>
            </div>
            <ProgressBar value={r.progress} className="mt-4 !h-6 bg-white/15" />
            <p className="mt-2 text-xl text-white/80">{formatInr(r.raisedPaise)} gifted with love</p>
          </div>

          <div className="mt-10 grid grid-cols-3 gap-4">
            {r.rooms.map((room) => (
              <div key={room.key} className="rounded-2xl bg-white/10 p-4">
                <p className="flex items-center gap-2 text-lg font-semibold">
                  <RoomIcon icon={room.icon} size={20} /> {room.name}
                </p>
                <ProgressBar value={room.sft ? room.fundedSft / room.sft : 0} className="mt-2 bg-white/15" />
                <p className="mt-1 text-sm text-white/70">
                  {room.fundedSft}/{room.sft} sq.ft.
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-5 rounded-3xl bg-white p-5 text-ink">
            {/* eslint-disable-next-line @next/next/no-img-element -- PNG served by the API */}
            <img src={stageQrUrl(slug)} alt="Scan to gift" className="h-40 w-40" />
            <div>
              <p className="font-display text-2xl font-bold text-maroon">Scan to gift a square foot</p>
              <p className="mt-1 text-lg text-muted">{formatInr(r.ratePerSftPaise)} per sq.ft. • UPI, cards, netbanking</p>
            </div>
          </div>
          {showPeople && blessing && (
            <figure key={blessing.id} className="flex-1 rounded-3xl bg-white/10 p-6">
              {blessing.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- moderated guest upload
                <img src={blessing.photoUrl} alt="" className="mb-4 max-h-56 w-full rounded-2xl object-cover" />
              )}
              {blessing.message && <blockquote className="font-serif text-3xl leading-snug italic">&ldquo;{blessing.message}&rdquo;</blockquote>}
              <figcaption className="mt-4 text-xl text-gold-light">— {blessing.authorName}</figcaption>
            </figure>
          )}
        </div>
      </div>

      {showPeople && donors.length > 0 && (
        <div className="overflow-hidden border-t border-white/15 bg-black/20 py-4">
          <div className="animate-ticker flex w-max gap-12 text-xl whitespace-nowrap">
            {[...donors, ...donors].map((d, i) => (
              <span key={`${d.id}-${i}`}>
                <span className="font-semibold text-gold-light">{d.donorName}</span> gifted {d.units} sq.ft. of the {d.room.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {celebrate && showPeople && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="gold-gradient rounded-[2rem] px-16 py-12 text-center text-ink shadow-2xl">
            <Sparkles className="mx-auto" size={56} />
            <p className="mt-4 font-display text-5xl font-bold">{celebrate.donorName}</p>
            <p className="mt-2 text-3xl">
              just gifted {celebrate.units} sq.ft. of the {celebrate.room.name}!
            </p>
            {celebrate.blessing && <p className="mt-4 max-w-2xl font-serif text-2xl italic">&ldquo;{celebrate.blessing}&rdquo;</p>}
          </div>
        </div>
      )}
    </div>
  );
}
