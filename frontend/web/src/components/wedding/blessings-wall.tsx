"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Send } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { endpoints } from "@/lib/api";
import type { Blessing } from "@/lib/types";
import { useToast } from "../toast";
import { EmptyState, errorMessage } from "../ui";

export function BlessingForm({ slug, tableNumber }: { slug: string; tableNumber?: string | null }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [message, setMessage] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const post = useMutation({
    mutationFn: () => endpoints.postBlessing(slug, { message, tableNumber: tableNumber ?? undefined, photo }),
    onSuccess: (b) => {
      setMessage("");
      setPhoto(null);
      if (fileRef.current) fileRef.current.value = "";
      toast(b.status === "APPROVED" ? "Your blessing is live!" : "Thank you! Your photo will appear once the hosts approve it.");
      void qc.invalidateQueries({ queryKey: ["blessings", slug] });
    },
  });
  return (
    <form
      className="card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        post.mutate();
      }}
    >
      <textarea
        className="input min-h-20"
        placeholder="Write your blessing for the couple…"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={280}
        aria-label="Blessing"
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <label className="btn-ghost cursor-pointer !py-2">
          <Camera size={16} /> {photo ? photo.name.slice(0, 24) : "Add a photo"}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
        </label>
        <span className="text-xs text-muted">{message.length}/280</span>
        <button className="btn-primary !py-2" disabled={post.isPending || (!message.trim() && !photo)}>
          <Send size={16} /> {post.isPending ? "Sending…" : "Send blessing"}
        </button>
      </div>
      {post.isError && <p className="mt-2 text-sm text-maroon">{errorMessage(post.error)}</p>}
    </form>
  );
}

export function BlessingsGrid({ blessings }: { blessings: Blessing[] }) {
  if (!blessings.length) return <EmptyState title="No blessings yet">Be the first to bless the couple!</EmptyState>;
  return (
    <div className="columns-1 gap-3 sm:columns-2 lg:columns-3">
      {blessings.map((b) => (
        <figure key={b.id} className="card mb-3 break-inside-avoid overflow-hidden">
          {b.photoUrl && <Image src={b.photoUrl} alt={`Photo from ${b.authorName}`} width={600} height={400} className="h-auto w-full object-cover" />}
          <div className="p-4">
            {b.message && <blockquote className="font-serif text-base italic">&ldquo;{b.message}&rdquo;</blockquote>}
            <figcaption className="mt-2 text-xs font-semibold text-maroon">
              — {b.authorName}
              {b.tableNumber && <span className="font-normal text-muted"> • Table {b.tableNumber}</span>}
            </figcaption>
          </div>
        </figure>
      ))}
    </div>
  );
}
