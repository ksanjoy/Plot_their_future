"use client";

import { Bath, Bed, BedDouble, CookingPot, Sofa, Sun, Home } from "lucide-react";
import type { RoomState } from "@/lib/types";
import { ProgressBar } from "../ui";

const ICONS: Record<string, typeof Home> = {
  weekend: Sofa,
  king_bed: BedDouble,
  single_bed: Bed,
  balcony: Sun,
  kitchen: CookingPot,
  bathtub: Bath,
};

export const RoomIcon = ({ icon, size = 18 }: { icon: string | null; size?: number }) => {
  const Icon = (icon && ICONS[icon]) || Home;
  return <Icon size={size} />;
};

/** One square per sq.ft.: gold = gifted, pulsing = being paid for right now, outline = open. */
function TileGrid({ room, compact }: { room: RoomState; compact?: boolean }) {
  const cells = room.cells.split("");
  return (
    <div className={`grid gap-[2px] ${compact ? "grid-cols-[repeat(auto-fill,minmax(6px,1fr))]" : "grid-cols-[repeat(auto-fill,minmax(10px,1fr))]"}`}>
      {cells.map((c, i) => {
        const donor = room.donors[String(room.startIndex + i)];
        return (
          <span
            key={i}
            title={c === "F" ? `Gifted${donor ? ` by ${donor}` : ""}` : c === "H" ? "Being gifted right now" : "Open"}
            className={`aspect-square rounded-[2px] ${
              c === "F" ? "gold-gradient" : c === "H" ? "tile-held bg-maroon/70" : "border border-line bg-white"
            }`}
          />
        );
      })}
    </div>
  );
}

export function FloorPlan({
  rooms,
  ratePaise,
  selectedKey,
  onSelect,
  compact = false,
}: {
  rooms: RoomState[];
  ratePaise: number;
  selectedKey?: string | null;
  onSelect?: (room: RoomState) => void;
  compact?: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rooms.map((room) => {
        const full = room.openSft <= 0;
        const selected = selectedKey === room.key;
        const content = (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${full ? "gold-gradient text-ink" : "bg-maroon/10 text-maroon"}`}>
                  <RoomIcon icon={room.icon} />
                </span>
                <div className="text-left">
                  <p className="font-semibold leading-tight">{room.name}</p>
                  <p className="text-xs text-muted">{room.sft} sq.ft.</p>
                </div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${full ? "bg-emerald-100 text-emerald-800" : "bg-ivory text-muted"}`}>
                {full ? "Fully gifted" : `${room.openSft} open`}
              </span>
            </div>
            {!compact && room.description && <p className="mt-2 text-left text-xs text-muted">{room.description}</p>}
            <div className="mt-3">
              <TileGrid room={room} compact={compact} />
            </div>
            <ProgressBar value={room.sft ? room.fundedSft / room.sft : 0} className="mt-3" />
            <p className="mt-1 text-left text-xs text-muted">
              {room.fundedSft}/{room.sft} gifted{room.heldSft ? ` • ${room.heldSft} being gifted now` : ""}
              {!compact && ` • ₹${(ratePaise / 100).toLocaleString("en-IN")}/sq.ft.`}
            </p>
          </>
        );
        return onSelect ? (
          <button
            key={room.key}
            type="button"
            disabled={full}
            onClick={() => onSelect(room)}
            className={`card p-4 text-left transition hover:border-gold disabled:cursor-default disabled:hover:border-line ${selected ? "border-maroon ring-2 ring-maroon/30" : ""}`}
          >
            {content}
          </button>
        ) : (
          <div key={room.key} className="card p-4">
            {content}
          </div>
        );
      })}
    </div>
  );
}
