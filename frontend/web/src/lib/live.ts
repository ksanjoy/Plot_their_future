"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { API_URL, tokens } from "./api";
import type { Blessing, DispatchSummary, OwnerContribution, RegistryState, RsvpSummary, WallEntry } from "./types";

export type LiveChannel = "wedding" | "admin" | "stage";

/** Payloads per event. `contribution.funded` is a wall entry on wedding/stage channels and the owner view on admin. */
export interface LiveEvents {
  "registry.updated": RegistryState;
  "contribution.funded": WallEntry & Partial<OwnerContribution>;
  "blessing.approved": Blessing;
  "rsvp.updated": RsvpSummary;
  "dispatch.progress": DispatchSummary;
}
export type LiveHandlers = { [K in keyof LiveEvents]?: (payload: LiveEvents[K]) => void };

const EVENTS = ["registry.updated", "contribution.funded", "blessing.approved", "rsvp.updated", "dispatch.progress"] as const;

/**
 * Subscribes to a wedding's live channel. Handlers can change between renders
 * without reconnecting; the socket re-joins automatically after reconnects.
 */
export function useLive(slug: string | undefined, channel: LiveChannel, handlers: LiveHandlers, enabled = true) {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!slug || !enabled || !tokens.access) return;
    const socket: Socket = io(`${API_URL}/live`, {
      transports: ["websocket"],
      auth: (cb) => cb({ token: tokens.access }),
    });
    const join = () => socket.emit("join", { slug, channel });
    socket.on("connect", join);
    for (const event of EVENTS) {
      socket.on(event, (payload: LiveEvents[typeof event]) => {
        const handler = handlersRef.current[event] as ((p: typeof payload) => void) | undefined;
        handler?.(payload);
      });
    }
    return () => {
      socket.disconnect();
    };
  }, [slug, channel, enabled]);
}
