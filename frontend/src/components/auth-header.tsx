import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { Suspense } from "react";

export default function AuthHeader() {
  return (
    <header className="flex w-full items-center justify-between border-b border-zinc-200 bg-white px-6 py-3 dark:border-zinc-800 dark:bg-black">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          SentinelSRE
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Suspense fallback={<div className="h-8 w-8" />}>
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button
                type="button"
                className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              >
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button
                type="button"
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
              >
                Sign up
              </button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </Suspense>
      </div>
    </header>
  );
}
