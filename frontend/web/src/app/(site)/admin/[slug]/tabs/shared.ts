import type { Role, Wedding } from "@/lib/types";

export interface TabProps {
  slug: string;
  wedding: Wedding;
  role: Role;
}

export const ADMIN: Role[] = ["HOST", "CO_HOST"];
export const STAFF: Role[] = [...ADMIN, "LEAD", "VENUE"];

export const can = (role: Role, allowed: Role[]) => allowed.includes(role);
