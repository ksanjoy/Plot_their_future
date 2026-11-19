"use client";

import { useQuery } from "@tanstack/react-query";
import { RequireAuth } from "@/components/require-auth";
import { endpoints } from "@/lib/api";

function List() {
  const q = useQuery({ queryKey: ["inbox"], queryFn: endpoints.notifications });
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold text-maroon">Notifications</h1>
        <button className="text-sm text-maroon" onClick={() => void endpoints.readNotifications()}>Mark read</button>
      </div>
      <ul className="mt-4 space-y-2">
        {q.data?.items.map((item) => (
          <li key={item.id} className="card p-3">
            <p className="font-semibold">{item.title}</p>
            <p className="whitespace-pre-line text-sm text-muted">{item.body}</p>
          </li>
        ))}
        {q.isSuccess && !q.data.items.length && <p className="text-sm text-muted">No notifications yet.</p>}
      </ul>
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <RequireAuth>
      <List />
    </RequireAuth>
  );
}
