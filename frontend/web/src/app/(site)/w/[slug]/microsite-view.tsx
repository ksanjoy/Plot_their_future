"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  CalendarPlus,
  ClipboardCheck,
  Gift,
  Lock,
  MapPin,
  PlayCircle,
  Settings,
  Shirt,
  ShieldCheck,
  Video,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { useToast } from "@/components/toast";
import { Badge, EmptyState, ErrorState, errorMessage, PageLoader, ProgressBar, Spinner } from "@/components/ui";
import { BlessingForm, BlessingsGrid } from "@/components/wedding/blessings-wall";
import { Countdown } from "@/components/wedding/countdown";
import { FloorPlan } from "@/components/wedding/floor-plan";
import { GiftSheet, toPath } from "@/components/wedding/gift-sheet";
import { RsvpDialog } from "@/components/wedding/rsvp-dialog";
import { ApiError, endpoints } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { coupleName, formatDate, formatDateTime, formatDayShort, formatInr, formatTime, percent } from "@/lib/format";
import { useLive } from "@/lib/live";
import type { Blessing, Microsite, RegistryState, WallEntry } from "@/lib/types";

export function MicrositeView() {
  const { slug } = useParams<{ slug: string }>();
  return (
    <RequireAuth slug={slug}>
      <Microsite slug={slug} />
    </RequireAuth>
  );
}

function NotInvited() {
  const { signOut, user } = useAuth();
  return (
    <div className="mx-auto my-16 max-w-md px-4 text-center">
      <div className="card p-8">
        <Lock className="mx-auto text-gold" size={40} />
        <h1 className="mt-3 font-display text-xl font-bold text-maroon">Private celebration</h1>
        <p className="mt-2 text-sm text-muted">
          {user?.phone} isn&apos;t on this couple&apos;s guest list. Please sign in with the number your invitation was sent to, or ask the hosts to add you.
        </p>
        <button className="btn-primary mt-5" onClick={() => void signOut()}>
          Use a different number
        </button>
      </div>
    </div>
  );
}

function Microsite({ slug }: { slug: string }) {
  const search = useSearchParams();
  const qc = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const [giftOpen, setGiftOpen] = useState(search.get("gift") === "1");
  const [giftRoom, setGiftRoom] = useState<string | null>(null);
  const [rsvpOpen, setRsvpOpen] = useState(false);
  const tableNumber = search.get("table");
  const refLead = search.get("ref_lead");

  const site = useQuery({ queryKey: ["microsite", slug], queryFn: () => endpoints.microsite(slug) });
  const enabled = site.isSuccess;
  const registry = useQuery({ queryKey: ["registry", slug], queryFn: () => endpoints.registry(slug), enabled });
  const wall = useQuery({ queryKey: ["donor-wall", slug], queryFn: () => endpoints.donorWall(slug), enabled });
  const blessings = useQuery({ queryKey: ["blessings", slug], queryFn: () => endpoints.blessings(slug), enabled });
  const mine = useQuery({ queryKey: ["my-gifts", slug], queryFn: () => endpoints.myContributions(slug), enabled });

  useLive(
    slug,
    "wedding",
    {
      "registry.updated": (state: RegistryState) => {
        qc.setQueryData(["registry", slug], state);
        qc.setQueryData<Microsite>(["microsite", slug], (old) =>
          old ? { ...old, registry: { ...old.registry, fundedSft: state.fundedSft, heldSft: state.heldSft, progress: state.progress, raisedPaise: state.raisedPaise } } : old,
        );
      },
      "contribution.funded": (entry: WallEntry) => {
        qc.setQueryData<WallEntry[]>(["donor-wall", slug], (old) => (old && !old.some((e) => e.id === entry.id) ? [entry, ...old] : old));
        void qc.invalidateQueries({ queryKey: ["my-gifts", slug] });
      },
      "blessing.approved": (b: Blessing) => {
        qc.setQueryData<Blessing[]>(["blessings", slug], (old) => (old && !old.some((x) => x.id === b.id) ? [b, ...old] : old));
      },
    },
    enabled,
  );

  if (site.isPending) return <PageLoader />;
  if (site.isError) {
    if (site.error instanceof ApiError && site.error.code === "NOT_INVITED") return <NotInvited />;
    return <ErrorState error={site.error} />;
  }

  const { wedding: w, ceremonies, invitation, role, rsvp } = site.data;
  const summary = registry.data ?? { ...site.data.registry };
  const registryEnabled = role !== "GUEST" || invitation?.enableRegistry !== false;
  const isStaff = role !== "GUEST";
  const openGift = (roomKey?: string) => {
    setGiftRoom(roomKey ?? null);
    setGiftOpen(true);
  };

  return (
    <div className="flex-1">
      <section className="maroon-gradient relative overflow-hidden text-white">
        <Image
          src={w.coverPhotoUrl ?? "/images/couple_portrait.jpg"}
          alt=""
          fill
          priority
          className="object-cover opacity-30"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-14 md:py-20">
          {isStaff && (
            <Link href={`/admin/${slug}`} className="btn mb-6 border border-white/40 !py-1.5 text-xs text-white hover:bg-white/10">
              <Settings size={14} /> Open host console
            </Link>
          )}
          <p className="text-xs font-semibold tracking-[0.3em] text-gold-light uppercase">
            {invitation ? `Namaste ${invitation.guestName.split(" ")[0]}, you're invited` : "The wedding of"}
          </p>
          <h1 className="mt-3 font-display text-4xl leading-tight font-bold md:text-6xl">
            {w.brideName}
            <span className="block font-serif text-3xl text-gold-light italic md:text-4xl">&amp;</span>
            {w.groomName}
          </h1>
          <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-white/85">
            {w.weddingDate && (
              <span className="flex items-center gap-1.5">
                <CalendarDays size={16} className="text-gold-light" /> {formatDate(w.weddingDate, w.timezone)}
              </span>
            )}
            {w.city && (
              <span className="flex items-center gap-1.5">
                <MapPin size={16} className="text-gold-light" /> {w.city}
              </span>
            )}
          </p>
          {w.weddingDate && (
            <div className="mt-6">
              <Countdown to={w.weddingDate} light />
            </div>
          )}
          <div className="mt-8 flex flex-wrap gap-3">
            {registryEnabled && (
              <button className="btn-gold" onClick={() => openGift()}>
                <Gift size={16} /> Gift a square foot
              </button>
            )}
            {invitation && (
              <button className="btn border border-white/50 text-white hover:bg-white/10" onClick={() => setRsvpOpen(true)}>
                <ClipboardCheck size={16} /> {rsvp ? `RSVP: ${rsvp.status.toLowerCase()}` : "RSVP now"}
              </button>
            )}
            <a href="#itinerary" className="btn border border-white/50 text-white hover:bg-white/10">
              <CalendarDays size={16} /> Itinerary
            </a>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-12">
        {(w.welcomeNote || w.videoInviteUrl) && (
          <section className="grid items-center gap-6 md:grid-cols-2">
            {w.welcomeNote && (
              <div>
                <h2 className="font-display text-2xl font-bold text-maroon">A note from the couple</h2>
                <p className="mt-3 font-serif text-lg leading-relaxed whitespace-pre-line italic">{w.welcomeNote}</p>
              </div>
            )}
            {w.videoInviteUrl && (
              <div className="card overflow-hidden">
                {/\.(mp4|webm)(\?|$)/.test(w.videoInviteUrl) ? (
                  <video src={w.videoInviteUrl} controls playsInline className="aspect-video w-full bg-ink" poster={w.coverPhotoUrl ?? undefined} />
                ) : (
                  <a href={w.videoInviteUrl} target="_blank" rel="noreferrer" className="flex aspect-video items-center justify-center gap-2 bg-ink text-white">
                    <PlayCircle size={40} className="text-gold" /> Watch our video invitation
                  </a>
                )}
              </div>
            )}
          </section>
        )}

        <section id="itinerary" className="scroll-mt-20">
          <h2 className="font-display text-2xl font-bold text-maroon">Your itinerary</h2>
          <p className="mt-1 text-sm text-muted">{isStaff ? "All ceremonies" : "The ceremonies you're invited to"}</p>
          {ceremonies.length ? (
            <ol className="mt-5 space-y-3">
              {ceremonies.map((c) => (
                <li key={c.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="gold-gradient flex w-20 shrink-0 flex-col items-center rounded-xl py-2 text-ink">
                    <span className="text-xs font-bold uppercase">{formatDayShort(c.startsAt, w.timezone)}</span>
                    <span className="font-display text-sm font-bold">{formatTime(c.startsAt, w.timezone)}</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-serif text-lg font-bold">{c.title}</p>
                    <p className="text-sm text-muted">
                      {c.venueName}
                      {c.venueAddress && `, ${c.venueAddress}`}
                    </p>
                    {c.description && <p className="mt-1 text-sm">{c.description}</p>}
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted">
                      {c.dressCode && (
                        <span className="flex items-center gap-1">
                          <Shirt size={12} /> {c.dressCode}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {c.venueMapsUrl && (
                      <a href={c.venueMapsUrl} target="_blank" rel="noreferrer" className="btn-ghost !px-3 !py-1.5 text-xs">
                        <MapPin size={14} /> Map
                      </a>
                    )}
                    {c.streamUrl && (
                      <a href={c.streamUrl} target="_blank" rel="noreferrer" className="btn-ghost !px-3 !py-1.5 text-xs">
                        <Video size={14} /> Live
                      </a>
                    )}
                    <button
                      className="btn-ghost !px-3 !py-1.5 text-xs"
                      onClick={() => endpoints.ceremonyIcs(slug, c.id).catch((e) => toast(errorMessage(e), "error"))}
                    >
                      <CalendarPlus size={14} /> Add to calendar
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="mt-5">
              <EmptyState title="The itinerary will be shared soon" />
            </div>
          )}
        </section>

        {registryEnabled && (
          <section id="registry" className="scroll-mt-20">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-maroon">Build their first home</h2>
                <p className="mt-1 text-sm text-muted">
                  {w.propertyName ?? "Their dream home"}
                  {w.propertyLocation && ` • ${w.propertyLocation}`}
                </p>
              </div>
              <button className="btn-primary" onClick={() => openGift()}>
                <Gift size={16} /> Gift square feet
              </button>
            </div>
            <div className="card mt-5 grid gap-4 p-5 md:grid-cols-4">
              <div className="md:col-span-2">
                <p className="text-xs font-semibold tracking-wide text-muted uppercase">Home gifted so far</p>
                <p className="mt-1 font-display text-3xl font-bold text-maroon">
                  {summary.fundedSft.toLocaleString("en-IN")} <span className="text-base text-muted">/ {summary.totalSft.toLocaleString("en-IN")} sq.ft.</span>
                </p>
                <ProgressBar value={summary.progress} className="mt-3 !h-3" />
                <p className="mt-1 text-xs text-muted">
                  {percent(summary.progress)} • {formatInr(summary.raisedPaise)} of {formatInr(summary.targetPaise)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold tracking-wide text-muted uppercase">Rate</p>
                <p className="mt-1 font-serif text-xl font-bold">{formatInr(summary.ratePerSftPaise)} / sq.ft.</p>
              </div>
              <div className="text-xs text-muted">
                <p className="flex items-center gap-1.5 font-semibold text-emerald-800">
                  <ShieldCheck size={14} /> RBI tripartite escrow
                </p>
                {w.escrowBankName && <p className="mt-1">{w.escrowBankName}</p>}
                {w.reraRegId && <p>RERA {w.reraRegId}</p>}
              </div>
            </div>
            <div className="mt-5">
              {registry.data ? (
                <FloorPlan rooms={registry.data.rooms} ratePaise={registry.data.ratePerSftPaise} onSelect={(r) => openGift(r.key)} />
              ) : (
                <Spinner label="Loading the floor plan…" />
              )}
            </div>
          </section>
        )}

        {mine.data && mine.data.length > 0 && (
          <section>
            <h2 className="font-display text-xl font-bold text-maroon">Your gifts</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {mine.data.map((c) => (
                <div key={c.id} className="card flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-semibold">
                      {c.units} sq.ft. • {c.room.name}
                    </p>
                    <p className="text-xs text-muted">
                      {formatInr(c.amountPaise)} • {formatDateTime(c.paidAt ?? c.createdAt, w.timezone)}
                    </p>
                  </div>
                  {c.status === "SUCCESS" && c.links.thankYouUrl ? (
                    <div className="flex gap-2">
                      <Link href={toPath(c.links.thankYouUrl)} className="btn-ghost !px-3 !py-1.5 text-xs">
                        Certificate
                      </Link>
                      {c.links.receiptUrl && (
                        <a href={c.links.receiptUrl} className="btn-ghost !px-3 !py-1.5 text-xs" target="_blank" rel="noreferrer">
                          Receipt PDF
                        </a>
                      )}
                    </div>
                  ) : c.status === "PENDING" && c.links.checkoutUrl ? (
                    <Link href={toPath(c.links.checkoutUrl)} className="btn-primary !px-3 !py-1.5 text-xs">
                      Complete payment
                    </Link>
                  ) : (
                    <Badge tone="warn">{c.status === "REFUND_REQUIRED" ? "Refund in progress" : c.status.toLowerCase()}</Badge>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {registryEnabled && (
          <section>
            <h2 className="font-display text-2xl font-bold text-maroon">Wall of love</h2>
            <p className="mt-1 text-sm text-muted">Everyone who has gifted a piece of the home</p>
            {wall.data?.length ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {wall.data.map((d) => (
                  <div key={d.id} className="card flex gap-3 p-4">
                    <span className="gold-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-ink">{d.initials}</span>
                    <div>
                      <p className="font-semibold">
                        {d.donorName}
                        {d.relationship && <span className="font-normal text-muted"> • {d.relationship}</span>}
                      </p>
                      <p className="text-xs text-maroon">
                        {d.units} sq.ft. in the {d.room.name}
                      </p>
                      {d.blessing && <p className="mt-1 font-serif text-sm italic">&ldquo;{d.blessing}&rdquo;</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5">
                <EmptyState title="Be the first to gift a square foot" />
              </div>
            )}
          </section>
        )}

        <section>
          <h2 className="font-display text-2xl font-bold text-maroon">Blessings</h2>
          <p className="mt-1 text-sm text-muted">Leave a message or a photo for {coupleName(w)}</p>
          <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_2fr]">
            <BlessingForm slug={slug} tableNumber={tableNumber} />
            {blessings.data ? <BlessingsGrid blessings={blessings.data} /> : <Spinner />}
          </div>
        </section>
      </div>

      {registry.data && giftOpen && (
        <GiftSheet
          key={giftRoom ?? "any"}
          open
          onClose={() => setGiftOpen(false)}
          slug={slug}
          registry={registry.data}
          initialRoom={giftRoom}
          defaultName={invitation?.guestName ?? user?.name ?? ""}
          tableNumber={tableNumber}
          refLead={refLead ?? invitation?.refLead}
        />
      )}
      {invitation && <RsvpDialog open={rsvpOpen} onClose={() => setRsvpOpen(false)} slug={slug} />}
    </div>
  );
}