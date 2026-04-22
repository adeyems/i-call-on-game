"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { JoinView } from "./JoinView";
import { HomeLink } from "@/components/shared/HomeLink";

export function JoinGate() {
  const params = useSearchParams();
  const code = params.get("code")?.trim().toUpperCase() ?? "";
  const initialName = params.get("name") ?? "";

  if (!code) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-4 py-12 text-center">
        <HomeLink />
        <div className="card-glow p-8">
          <h1 className="text-2xl font-bold">No room code</h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Ask your host for an invite link that includes the room code.
          </p>
          <Link href="/" className="btn-primary mt-6 inline-flex">
            Home
          </Link>
        </div>
      </main>
    );
  }

  return <JoinView roomCode={code} initialName={initialName} />;
}
