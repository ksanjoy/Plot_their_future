"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarHeart, Lock, MapPin } from "lucide-react";
import Link from "next/link";
import { ProgressBar, Spinner } from "@/components/ui";
import { endpoints } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { percent, ROLE_LABELS } from "@/lib/format";

export function CelebrationFeed() {
  const { ready, user } = useAuth();
  const feed = useQuery({ queryKey: ["feed", user?.id ?? "anon"], queryFn: endpoints.feed, enabled: ready });

  if (!ready || feed.isPending) return <Spinner />;
  if (feed.isError) return <p className="mt-6 text-sm text-muted">The celebration feed is unavailable right now.</p>;
  if (!feed.data.length) return <p className="mt-6 text-sm text-muted">No celebrations yet. Be the first to create one!</p>;

  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {feed.data.map((w, i) =>
        w.unlocked ? (
          <Link key={w.slug} href={`/w/${w.slug}`} className="card group overflow-hidden transition hover:-translate-y-0.5 hover:border-gold">
            <div
              className="maroon-gradient relative flex h-32 items-center justify-center bg-cover bg-center"
              style={w.coverPhotoUrl ? { backgroundImage: `linear-gradient(rgba(115,19,40,.55),rgba(115,19,40,.55)),url(${w.coverPhotoUrl})` } : undefined}
            >
              <span className="font-display text-3xl font-bold text-gold-light">{w.monogram}</span>
              <span className="absolute top-3 right-3 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-semibold text-maroon">
                {ROLE_LABELS[w.role] ?? w.role}
              </span>
            </div>
            <div className="p-4">
              <p className="font-serif text-lg font-bold group-hover:text-maroon">
                {w.brideName} & {w.groomName}
              </p>
              <p className="mt-1 flex flex-wrap gap-3 text-xs text-muted">
                {w.monthYear && <span className="flex items-center gap-1"><CalendarHeart size={12} /> {w.monthYear}</span>}
                {w.city && <span className="flex items-center gap-1"><MapPin size={12} /> {w.city}</span>}
              </p>
              <ProgressBar value={w.progress} className="mt-3" />
              <p className="mt-1 text-xs text-muted">{percent(w.progress)} of their home gifted</p>
            </div>
          </Link>
        ) : (
          <div key={`locked-${i}`} className="card overflow-hidden opacity-75 grayscale" aria-label="Private celebration">
            <div className="flex h-32 items-center justify-center bg-line/60">
              <span className="font-display text-3xl font-bold text-muted">{w.monogram}</span>
            </div>
            <div className="p-4">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-muted">
                <Lock size={14} /> {w.label}
              </p>
              <p className="mt-1 flex flex-wrap gap-3 text-xs text-muted">
                {w.monthYear && <span>{w.monthYear}</span>}
                {w.city && <span>{w.city}</span>}
              </p>
            </div>
          </div>
        ),
      )}
    </div>
  );
}
