"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CartItem } from "@/lib/orders/cart-types";

interface CartState {
  items: CartItem[];
  couponCode: string | null;
  isOpen: boolean;
  hydrated: boolean;
  add: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  remove: (kind: CartItem["kind"], id: string) => void;
  setQuantity: (kind: CartItem["kind"], id: string, quantity: number) => void;
  setCoupon: (code: string | null) => void;
  clear: () => void;
  open: () => void;
  close: () => void;
  setHydrated: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      couponCode: null,
      isOpen: false,
      hydrated: false,
      add: (item) =>
        set((s) => {
          const existing = s.items.find((i) => i.kind === item.kind && i.id === item.id);
          if (existing) {
            return { items: s.items.map((i) => (i === existing ? { ...i, quantity: Math.min(10, i.quantity + (item.quantity ?? 1)) } : i)), isOpen: true };
          }
          return { items: [...s.items, { ...item, quantity: item.quantity ?? 1 }], isOpen: true };
        }),
      remove: (kind, id) => set((s) => ({ items: s.items.filter((i) => !(i.kind === kind && i.id === id)) })),
      setQuantity: (kind, id, quantity) =>
        set((s) => ({ items: s.items.map((i) => (i.kind === kind && i.id === id ? { ...i, quantity: Math.max(1, Math.min(10, quantity)) } : i)) })),
      setCoupon: (code) => set({ couponCode: code }),
      clear: () => set({ items: [], couponCode: null }),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "cc-cart",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ items: s.items, couponCode: s.couponCode }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);

export function cartCount(items: CartItem[]): number {
  return items.reduce((n, i) => n + i.quantity, 0);
}
export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((n, i) => n + i.unitPriceCents * i.quantity, 0);
}
