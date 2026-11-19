"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { RequireAuth } from "@/components/require-auth";
import { Badge, EmptyState, ErrorState, Spinner } from "@/components/ui";
import { endpoints } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { coupleName, formatDate, ROLE_LABELS } from "@/lib/format";

export function AdminHome() {
  return (
    <RequireAuth>
      <WeddingList />
    </RequireAuth>
  );
}

function WeddingList() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ["my-weddings"], queryFn: endpoints.myWeddings });
  const managed = q.data?.filter((w) => w.role !== "GUEST") ?? [];
  const invited = q.data?.filter((w) => w.role === "GUEST") ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.25em] text-maroon uppercase">Host console</p>
          <h1 className="mt-1 font-display text-3xl font-bold text-maroon">Your celebrations</h1>
        </div>
        <div className="flex gap-2">
          {user?.isPlatformAdmin && (
            <Link href="/admin/compliance" className="btn-ghost">
              <ShieldCheck size={16} /> Compliance desk
            </Link>
          )}
          <Link href="/admin/new" className="btn-primary">
            <Plus size={16} /> Create a wedding
          </Link>
        </div>
      </div>

      {q.isPending ? (
        <Spinner />
      ) : q.isError ? (
        <ErrorState error={q.error} />
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {managed.map((w) => (
              <Link key={w.id} href={`/admin/${w.slug}`} className="card group overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="relative h-36">
                  <Image src={w.coverPhotoUrl ?? "/images/couple_portrait.jpg"} alt="" fill className="object-cover" />
                </div>
                <div className="p-4">
                  <p className="font-serif text-lg font-bold">{coupleName(w)}</p>
                  <p className="text-sm text-muted">
                    {formatDate(w.weddingDate, w.timezone) || "Date to be announced"}
                    {w.city && ` • ${w.city}`}
                  </p>
                  <div className="mt-2">
                    <Badge tone="gold">{ROLE_LABELS[w.role]}</Badge>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          {!managed.length && (
            <div className="mt-8">
              <EmptyState title="You aren't hosting a wedding yet">Create a microsite for your wedding in a couple of minutes.</EmptyState>
            </div>
          )}
          {invited.length > 0 && (
            <div className="mt-12">
              <h2 className="font-serif text-xl font-bold">Weddings you&apos;re invited to</h2>
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
        </>
      )}
    </div>
  );
}
