"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { GameView } from "./GameView";
import { HomeLink } from "@/components/shared/HomeLink";

export function GameGate() {
  const params = useSearchParams();
  const code = params.get("code")?.trim().toUpperCase() ?? "";

  if (!code) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-6 py-12 text-center">
        <HomeLink />
        <div className="card-glow p-8">
          <h1 className="text-2xl font-bold">No room code</h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Rejoin via your invite link to get back into the game.
          </p>
          <Link href="/" className="btn-primary mt-6 inline-flex">
            Home
          </Link>
        </div>
      </main>
    );
  }

  return <GameView roomCode={code} />;
}
