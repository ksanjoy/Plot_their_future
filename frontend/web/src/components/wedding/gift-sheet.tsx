"use client";

import { useMutation } from "@tanstack/react-query";
import { Gift, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { endpoints } from "@/lib/api";
import { formatInr } from "@/lib/format";
import type { RegistryState } from "@/lib/types";
import { errorMessage, Field, Modal } from "../ui";
import { RoomIcon } from "./floor-plan";

const RELATIONSHIPS = ["Family", "Cousin", "Uncle / Aunt", "Friend", "Colleague", "Neighbour", "Family friend"];

/** Converts an absolute web link from the API into an in-app path. */
export const toPath = (url: string) => {
  const u = new URL(url);
  return `${u.pathname}${u.search}`;
};

export function GiftSheet({
  open,
  onClose,
  slug,
  registry,
  initialRoom,
  defaultName,
  tableNumber,
  refLead,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  registry: RegistryState;
  initialRoom?: string | null;
  defaultName?: string;
  tableNumber?: string | null;
  refLead?: string | null;
}) {
  const router = useRouter();
  const openRooms = registry.rooms.filter((r) => r.openSft > 0);
  const [roomKey, setRoomKey] = useState<string>(initialRoom ?? openRooms[0]?.key ?? "");
  const [units, setUnits] = useState<number>(registry.presetTiers[0] ?? 1);
  const [custom, setCustom] = useState("");
  const [donorName, setDonorName] = useState(defaultName ?? "");
  const [relationship, setRelationship] = useState("");
  const [blessing, setBlessing] = useState("");
  const [anonymous, setAnonymous] = useState(false);

  const room = registry.rooms.find((r) => r.key === roomKey);
  const selectedUnits = custom ? Number.parseInt(custom, 10) || 0 : units;
  const amount = selectedUnits * registry.ratePerSftPaise;
  const overRoom = room ? selectedUnits > room.openSft : true;

  const lock = useMutation({
    mutationFn: () =>
      endpoints.lockTiles({
        slug,
        roomKey,
        units: selectedUnits,
        donorName: donorName.trim() || undefined,
        relationship: relationship || undefined,
        blessing: blessing.trim() || undefined,
        anonymous,
        tableNumber: tableNumber || undefined,
        refLead: refLead || undefined,
      }),
    onSuccess: (res) => {
      if (res.links.checkoutUrl) router.push(toPath(res.links.checkoutUrl));
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="Gift square feet" wide>
      {!openRooms.length ? (
        <p className="py-6 text-center font-serif text-lg text-maroon">Every square foot has been gifted. Thank you for your love!</p>
      ) : (
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            lock.mutate();
          }}
        >
          <div>
            <span className="label">1. Choose a room</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {registry.rooms.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  disabled={r.openSft <= 0}
                  onClick={() => setRoomKey(r.key)}
                  className={`flex items-center gap-2 rounded-xl border p-2.5 text-left text-sm transition disabled:opacity-40 ${
                    roomKey === r.key ? "border-maroon bg-maroon text-white" : "border-line bg-white hover:border-gold"
                  }`}
                >
                  <RoomIcon icon={r.icon} size={16} />
                  <span>
                    <span className="block font-semibold leading-tight">{r.name}</span>
                    <span className={`text-xs ${roomKey === r.key ? "text-white/80" : "text-muted"}`}>{r.openSft} sq.ft. open</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="label">2. How many square feet?</span>
            <div className="flex flex-wrap gap-2">
              {registry.presetTiers.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setUnits(t);
                    setCustom("");
                  }}
                  className={`chip !px-4 !py-2 !text-sm ${!custom && units === t ? "chip-active" : ""}`}
                >
                  {t} sq.ft. • {formatInr(t * registry.ratePerSftPaise)}
                </button>
              ))}
              <input
                className="input !w-32"
                type="number"
                min={1}
                max={500}
                placeholder="Custom"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                aria-label="Custom square feet"
              />
            </div>
            {overRoom && room && <p className="mt-2 text-xs text-maroon">Only {room.openSft} sq.ft. are still open in the {room.name}.</p>}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Your name on the gift">
              <input className="input" value={donorName} onChange={(e) => setDonorName(e.target.value)} maxLength={80} required={!anonymous} />
            </Field>
            <Field label="Relationship to the couple">
              <select className="input" value={relationship} onChange={(e) => setRelationship(e.target.value)}>
                <option value="">Select…</option>
                {RELATIONSHIPS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Your blessing (optional)" hint="Shown on the donor wall and the venue LED screen.">
            <textarea className="input min-h-20" value={blessing} onChange={(e) => setBlessing(e.target.value)} maxLength={500} />
          </Field>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-maroon" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
            Gift anonymously (shown as &ldquo;A Well-Wisher&rdquo;)
          </label>

          <div className="maroon-gradient flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4 text-white">
            <div>
              <p className="text-xs tracking-widest text-gold-light uppercase">Your gift</p>
              <p className="font-display text-2xl font-bold">{formatInr(amount)}</p>
              <p className="text-xs text-white/75">
                {selectedUnits || 0} sq.ft. in the {room?.name ?? "—"} • reserved for {Math.round(registry.holdTtlSec / 60)} minutes while you pay
              </p>
            </div>
            <button className="btn-gold" disabled={lock.isPending || !room || selectedUnits < 1 || overRoom}>
              <Gift size={16} /> {lock.isPending ? "Reserving…" : "Reserve & pay"}
            </button>
          </div>
          {lock.isError && <p className="text-sm text-maroon">{errorMessage(lock.error)}</p>}
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <ShieldCheck size={14} className="text-emerald-700" /> Paid into RBI tripartite escrow • Tax-exempt marriage gift under Sec 56(2)(x)
          </p>
        </form>
      )}
    </Modal>
  );
}
