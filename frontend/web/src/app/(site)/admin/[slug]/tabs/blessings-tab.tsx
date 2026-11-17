"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, EyeOff } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { useToast } from "@/components/toast";
import { Badge, EmptyState, errorMessage, ErrorState, Spinner } from "@/components/ui";
import { endpoints } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { ModerationStatus } from "@/lib/types";
import type { TabProps } from "./shared";

export function BlessingsTab({ slug, wedding }: TabProps) {
  const qc = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState<ModerationStatus>("PENDING");
  const q = useQuery({ queryKey: ["blessings", slug, status], queryFn: () => endpoints.blessings(slug, status) });
  const moderate = useMutation({
    mutationFn: ({ id, next }: { id: string; next: ModerationStatus }) => endpoints.moderateBlessing(slug, id, next),
    onSuccess: (_, { next }) => {
      toast(next === "APPROVED" ? "Blessing approved and shown on stage" : "Blessing hidden");
      void qc.invalidateQueries({ queryKey: ["blessings", slug] });
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(
          [
            ["PENDING", "Awaiting review"],
            ["APPROVED", "Approved"],
            ["HIDDEN", "Hidden"],
          ] as [ModerationStatus, string][]
        ).map(([s, label]) => (
          <button key={s} className={`chip ${status === s ? "chip-active" : ""}`} onClick={() => setStatus(s)}>
            {label}
          </button>
        ))}
      </div>
      {q.isPending ? (
        <Spinner />
      ) : q.isError ? (
        <ErrorState error={q.error} />
      ) : !q.data.length ? (
        <EmptyState title={status === "PENDING" ? "All caught up" : "Nothing here"}>
          {status === "PENDING" && "Photo blessings wait here for approval before appearing on the wall and stage screen."}
        </EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {q.data.map((b) => (
            <div key={b.id} className="card overflow-hidden">
              {b.photoUrl && <Image src={b.photoUrl} alt={`Photo from ${b.authorName}`} width={500} height={320} className="h-48 w-full object-cover" />}
              <div className="space-y-2 p-4">
                {b.message && <p className="font-serif italic">&ldquo;{b.message}&rdquo;</p>}
                <p className="text-xs text-muted">
                  {b.authorName}
                  {b.tableNumber && ` • Table ${b.tableNumber}`} • {formatDateTime(b.createdAt, wedding.timezone)}
                </p>
                <div className="flex items-center gap-2">
                  <Badge tone={b.status === "APPROVED" ? "success" : b.status === "HIDDEN" ? "neutral" : "warn"}>{b.status.toLowerCase()}</Badge>
                  <div className="ml-auto flex gap-1">
                    {b.status !== "APPROVED" && (
                      <button className="btn-primary !px-3 !py-1.5 text-xs" disabled={moderate.isPending} onClick={() => moderate.mutate({ id: b.id, next: "APPROVED" })}>
                        <Check size={14} /> Approve
                      </button>
                    )}
                    {b.status !== "HIDDEN" && (
                      <button className="btn-ghost !px-3 !py-1.5 text-xs" disabled={moderate.isPending} onClick={() => moderate.mutate({ id: b.id, next: "HIDDEN" })}>
                        <EyeOff size={14} /> Hide
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
