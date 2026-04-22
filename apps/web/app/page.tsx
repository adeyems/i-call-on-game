import { EntryCard } from "@/components/home/EntryCard";
import { Hero } from "@/components/home/Hero";
import { HowToPlay } from "@/components/home/HowToPlay";

export default function HomePage() {
  return (
    <main className="min-h-screen px-4 py-10 sm:py-14">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <Hero />
        <EntryCard />
        <HowToPlay />
      </div>
    </main>
  );
}
