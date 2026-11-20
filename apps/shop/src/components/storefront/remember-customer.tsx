"use client";
import { useEffect, useRef } from "react";
import { rememberCustomerAction } from "@/app/actions/customer";
import type { RememberInput } from "@/lib/customers/session";

/** Mémorise le client sur cet appareil (compte sans mot de passe), une seule fois par page. */
export function RememberCustomer({ input }: { input: RememberInput }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void rememberCustomerAction(input);
  }, [input]);
  return null;
}
