import type { Role } from "@prisma/client";

/** Capacités par rôle. ADMIN a tout. */
export const PERMISSIONS = {
  "dashboard:view": ["ADMIN", "EDITOR", "MARKETING", "SUPPORT"],
  "products:read": ["ADMIN", "EDITOR", "MARKETING", "SUPPORT"],
  "products:write": ["ADMIN", "EDITOR"],
  "products:publish": ["ADMIN", "EDITOR"],
  "products:import": ["ADMIN", "EDITOR"],
  "catalog:write": ["ADMIN", "EDITOR"], // catégories, collections, packs
  "orders:read": ["ADMIN", "SUPPORT", "MARKETING"],
  "orders:refund": ["ADMIN", "SUPPORT"],
  "customers:read": ["ADMIN", "SUPPORT", "MARKETING"],
  "reviews:moderate": ["ADMIN", "SUPPORT", "MARKETING"],
  "coupons:write": ["ADMIN", "MARKETING"],
  "blog:write": ["ADMIN", "EDITOR", "MARKETING"],
  "newsletter:read": ["ADMIN", "MARKETING"],
  "appearance:write": ["ADMIN", "MARKETING"],
  "settings:write": ["ADMIN"],
  "users:write": ["ADMIN"],
  "apikeys:write": ["ADMIN"],
  "pages:write": ["ADMIN", "EDITOR"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function roleCan(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  if (role === "ADMIN") return true;
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrateur",
  EDITOR: "Éditeur",
  MARKETING: "Marketing",
  SUPPORT: "Support",
};
