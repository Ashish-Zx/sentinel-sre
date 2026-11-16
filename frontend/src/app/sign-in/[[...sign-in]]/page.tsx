import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Suspense fallback={<div className="h-24 w-64 animate-pulse rounded-xl bg-surface-2" />}>
        <SignIn />
      </Suspense>
    </div>
  );
}
