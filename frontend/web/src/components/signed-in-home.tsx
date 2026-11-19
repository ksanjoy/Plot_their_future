"use client";

import { useQuery } from "@tanstack/react-query";
import { Home, HeartHandshake, Users } from "lucide-react";
import Link from "next/link";
import { endpoints } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { coupleName, formatDate } from "@/lib/format";

const CARDS = [
  { icon: Home, title: "Gift-a-Square-Foot", body: "Guests fund square feet, or smaller bricks, and the floor plan fills in as blessings arrive." },
  { icon: Users, title: "Invites and RSVP", body: "After approval, import guests, choose ceremonies, and send the wedding link on WhatsApp." },
  { icon: HeartHandshake, title: "Voluntary, always", body: "Presence comes first. Gifting is optional and a square foot is not ownership of the home." },
];

export function SignedInHome() {
  const { user, ready } = useAuth();
  const mine = useQuery({ queryKey: ["my-weddings"], queryFn: endpoints.myWeddings, enabled: ready && Boolean(user) });
  if (!ready || !user) return null;
  const hosted = mine.data?.filter((w) => w.role !== "GUEST") ?? [];
  const invited = mine.data?.filter((w) => w.role === "GUEST") ?? [];
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.25em] text-gold uppercase">Welcome{user.name ? `, ${user.name.split(" ")[0]}` : ""}</p>
          <h2 className="mt-1 font-display text-3xl font-bold text-maroon">Celebrate the wedding. Build the future.</h2>
        </div>
        <Link href="/register" className="btn-primary">
          Register a marriage
        </Link>
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {CARDS.map((card) => (
          <div key={card.title} className="card p-4">
            <card.icon className="text-maroon" size={18} />
            <p className="mt-2 font-semibold">{card.title}</p>
            <p className="mt-1 text-sm text-muted">{card.body}</p>
          </div>
        ))}
      </div>
      {hosted.length > 0 && (
        <div className="mt-8">
          <h3 className="font-serif text-xl font-bold">Your weddings</h3>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {hosted.map((w) => (
              <li key={w.id}>
                <Link href={w.approvalStatus && w.approvalStatus !== "APPROVED" ? "/admin" : `/admin/${w.slug}`} className="card block p-4 hover:border-gold">
                  <p className="font-semibold">{coupleName(w)}</p>
                  <p className="text-xs text-muted">{formatDate(w.weddingDate, w.timezone) || "Date to be announced"} • {w.approvalStatus ?? "APPROVED"}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {invited.length > 0 && (
        <div className="mt-8">
          <h3 className="font-serif text-xl font-bold">You&apos;re invited</h3>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {invited.map((w) => (
              <li key={w.id}>
                <Link href={`/w/${w.slug}`} className="card block p-4 hover:border-gold">
                  <p className="font-semibold">{coupleName(w)}</p>
                  <p className="text-xs text-muted">{formatDate(w.weddingDate, w.timezone)}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
