"use client";

import { Plus, Trash2 } from "lucide-react";
import type { RoomInput } from "@/lib/types";

export const ROOM_ICONS = [
  ["weekend", "Living"],
  ["king_bed", "Master bedroom"],
  ["single_bed", "Bedroom"],
  ["kitchen", "Kitchen"],
  ["balcony", "Balcony"],
  ["bathtub", "Bathroom"],
] as const;

export const DEFAULT_ROOMS: RoomInput[] = [
  { key: "living_room", name: "Living Room", sft: 350, icon: "weekend", description: "Where family gathers for festivals and Sunday breakfasts" },
  { key: "master_bedroom", name: "Master Bedroom", sft: 250, icon: "king_bed", description: "A calm retreat for the couple" },
  { key: "second_bedroom", name: "Second Bedroom", sft: 180, icon: "single_bed", description: "For parents, guests or a future little one" },
  { key: "kitchen", name: "Kitchen", sft: 150, icon: "kitchen", description: "Where the first sweet dish will be made" },
  { key: "balcony", name: "Balcony", sft: 120, icon: "balcony", description: "Morning chai with a view" },
  { key: "bathrooms", name: "Bathrooms", sft: 150, icon: "bathtub", description: "Two well-appointed bathrooms" },
];

const toKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);

export function RoomsEditor({ rooms, onChange, lockedKeys = [] }: { rooms: RoomInput[]; onChange: (rooms: RoomInput[]) => void; lockedKeys?: string[] }) {
  const update = (i: number, patch: Partial<RoomInput>) => onChange(rooms.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const total = rooms.reduce((s, r) => s + (r.sft || 0), 0);
  return (
    <div className="space-y-2">
      {rooms.map((r, i) => {
        const locked = lockedKeys.includes(r.key);
        return (
          <div key={i} className="grid grid-cols-[1fr_90px_130px_auto] items-center gap-2">
            <input
              className="input"
              value={r.name}
              placeholder="Room name"
              aria-label="Room name"
              onChange={(e) => update(i, locked ? { name: e.target.value } : { name: e.target.value, key: toKey(e.target.value) || `room_${i + 1}` })}
              required
            />
            <input className="input" type="number" min={1} max={5000} value={r.sft} aria-label="Square feet" onChange={(e) => update(i, { sft: Number(e.target.value) })} required />
            <select className="input" value={r.icon ?? ""} aria-label="Icon" onChange={(e) => update(i, { icon: e.target.value || null })}>
              <option value="">Generic</option>
              {ROOM_ICONS.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
            <button type="button" className="rounded-lg p-2 text-maroon hover:bg-gold disabled:opacity-30" disabled={rooms.length <= 1} onClick={() => onChange(rooms.filter((_, j) => j !== i))} aria-label="Remove room">
              <Trash2 size={16} />
            </button>
            <input
              className="input col-span-4 !py-1.5 text-xs"
              value={r.description ?? ""}
              placeholder="Short description shown to guests"
              aria-label="Room description"
              onChange={(e) => update(i, { description: e.target.value || null })}
              maxLength={300}
            />
          </div>
        );
      })}
      <div className="flex items-center justify-between pt-1">
        <button type="button" className="btn-ghost !py-1.5 text-sm" onClick={() => onChange([...rooms, { key: `room_${rooms.length + 1}`, name: "", sft: 100, icon: null, description: null }])} disabled={rooms.length >= 20}>
          <Plus size={14} /> Add room
        </button>
        <span className="text-sm text-muted">Total: {total.toLocaleString("en-IN")} sq.ft.</span>
      </div>
    </div>
  );
}
