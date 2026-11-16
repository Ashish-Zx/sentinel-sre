"use client";

import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * Clerk's UI components render additional DOM on the client that is not present
 * in the server HTML, which causes hydration mismatches. We therefore render a
 * stable skeleton until the client has hydrated, then mount the real controls.
 */
function useHydrated() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

export default function AuthActions() {
  const mounted = useHydrated();

  if (!mounted) {
    return (
      <div className="flex items-center gap-3">
        <div className="h-8 w-24 animate-pulse rounded-lg bg-surface-3" />
        <div className="h-8 w-20 animate-pulse rounded-lg bg-surface-3" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Show when="signed-out">
        <SignUpButton mode="modal">
          <button
            type="button"
            className="btn btn-secondary h-8 px-3.5 text-xs cursor-pointer"
          >
            Sign up
          </button>
        </SignUpButton>
        <SignInButton mode="modal">
          <button
            type="button"
            className="btn btn-primary h-8 px-3.5 text-xs cursor-pointer"
          >
            Sign in
          </button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </div>
  );
}
