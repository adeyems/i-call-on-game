"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { JoinView } from "./JoinView";
import { HomeLink } from "@/components/shared/HomeLink";

/** Supports Card Game Lobby deep links like "#room=ABC123" (optionally "#room=ABC123&name=…"). */
function parseHashParams(hash: string): { code: string; name: string } {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);
  return {
    code: params.get("room")?.trim().toUpperCase() ?? "",
    name: params.get("name") ?? ""
  };
}

export function JoinGate() {
  const params = useSearchParams();
  const queryCode = params.get("code")?.trim().toUpperCase() ?? "";
  const queryName = params.get("name") ?? "";

  // The hash fragment isn't available during SSG, so read it after mount.
  const [hash, setHash] = useState<{ code: string; name: string }>({ code: "", name: "" });
  useEffect(() => {
    const update = () => setHash(parseHashParams(window.location.hash));
    update();
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);

  const code = queryCode || hash.code;
  const initialName = queryName || hash.name;

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
