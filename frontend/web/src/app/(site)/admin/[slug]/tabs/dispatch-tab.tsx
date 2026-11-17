"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import { EmptyState, errorMessage, ProgressBar, Spinner } from "@/components/ui";
import { endpoints } from "@/lib/api";
import { COHORT_LABELS, formatDateTime } from "@/lib/format";
import { useLive } from "@/lib/live";
import type { Cohort, DispatchInput, DispatchSummary } from "@/lib/types";
import type { TabProps } from "./shared";

export function DispatchTab({ slug }: TabProps) {
  const qc = useQueryClient();
  const toast = useToast();
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [ceremonyIds, setCeremonyIds] = useState<string[]>([]);
  const [includeRegistry, setIncludeRegistry] = useState(true);
  const [onlyPendingRsvp, setOnlyPendingRsvp] = useState(false);
  const input: DispatchInput = {
    cohorts: cohorts.length ? cohorts : undefined,
    ceremonyIds: ceremonyIds.length ? ceremonyIds : undefined,
    includeRegistry,
    onlyPendingRsvp,
  };

  const ceremonies = useQuery({ queryKey: ["ceremonies", slug], queryFn: () => endpoints.ceremonies(slug) });
  const list = useQuery({ queryKey: ["dispatches", slug], queryFn: () => endpoints.dispatches(slug) });
  const preview = useMutation({ mutationFn: () => endpoints.dispatchPreview(slug, input) });
  const { mutate: runPreview } = preview;
  const key = JSON.stringify(input);
  useEffect(() => {
    runPreview();
  }, [key, runPreview]);

  const send = useMutation({
    mutationFn: () => endpoints.createDispatch(slug, input),
    onSuccess: (d) => {
      toast(`Sending ${d.total} WhatsApp invitations`);
      void qc.invalidateQueries({ queryKey: ["dispatches", slug] });
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  useLive(slug, "admin", {
    "dispatch.progress": (s) => qc.setQueryData<DispatchSummary[]>(["dispatches", slug], (old) => old?.map((d) => (d.id === s.id ? s : d))),
  });

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const ceremonyTitle = (id: string) => ceremonies.data?.find((c) => c.id === id)?.title ?? "ceremony";

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
      <div className="card space-y-5 p-5">
        <h3 className="font-serif text-lg font-bold">Send WhatsApp invitations</h3>
        <div>
          <span className="label">Cohorts (none selected = everyone)</span>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(COHORT_LABELS) as Cohort[]).map((c) => (
              <button key={c} type="button" className={`chip ${cohorts.includes(c) ? "chip-active" : ""}`} onClick={() => setCohorts(toggle(cohorts, c))}>
                {COHORT_LABELS[c]}
              </button>
            ))}
          </div>
        </div>
        {ceremonies.data && ceremonies.data.length > 0 && (
          <div>
            <span className="label">Invited to (none selected = any)</span>
            <div className="flex flex-wrap gap-2">
              {ceremonies.data.map((c) => (
                <button key={c.id} type="button" className={`chip ${ceremonyIds.includes(c.id) ? "chip-active" : ""}`} onClick={() => setCeremonyIds(toggle(ceremonyIds, c.id))}>
                  {c.title}
                </button>
              ))}
            </div>
          </div>
        )}
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-maroon" checked={includeRegistry} onChange={(e) => setIncludeRegistry(e.target.checked)} />
          Mention the home gift registry in the message
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-maroon" checked={onlyPendingRsvp} onChange={(e) => setOnlyPendingRsvp(e.target.checked)} />
          Only guests who haven&apos;t replied yet (reminder)
        </label>
        <div className="flex items-center justify-between rounded-xl bg-ivory p-3 text-sm">
          <span className="flex items-center gap-2">
            <Users size={16} className="text-gold" /> Recipients
          </span>
          <span className="font-display text-xl font-bold">{preview.isPending ? "…" : (preview.data?.recipients ?? 0)}</span>
        </div>
        <button
          className="btn-primary w-full"
          disabled={send.isPending || !preview.data?.recipients}
          onClick={() => {
            if (confirm(`Send personalised WhatsApp invitations to ${preview.data?.recipients ?? 0} guests?`)) send.mutate();
          }}
        >
          <Send size={16} /> {send.isPending ? "Queuing…" : "Send invitations"}
        </button>
        <p className="text-xs text-muted">Each guest receives a unique, private link. Messages are rate-limited and retried automatically.</p>
      </div>

      <div className="space-y-3">
        <h3 className="font-serif text-lg font-bold">History</h3>
        {list.isPending ? (
          <Spinner />
        ) : !list.data?.length ? (
          <EmptyState title="No invitations sent yet" />
        ) : (
          list.data.map((d) => {
            const done = d.sent + d.failed + d.skipped;
            return (
              <div key={d.id} className="card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-semibold">{formatDateTime(d.createdAt)}</span>
                  <span className="text-muted">
                    {d.sent} sent • {d.queued} queued • {d.failed} failed • {d.skipped} skipped
                  </span>
                </div>
                <ProgressBar value={d.total ? done / d.total : 1} className="mt-2" tone="maroon" />
                <p className="mt-2 text-xs text-muted">
                  {d.cohorts.length ? d.cohorts.map((c) => COHORT_LABELS[c]).join(", ") : "All cohorts"}
                  {d.ceremonyIds.length > 0 && ` • ${d.ceremonyIds.map(ceremonyTitle).join(", ")}`}
                  {d.refLead && ` • ${d.refLead}`}
                  {!d.includeRegistry && " • without registry"}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
