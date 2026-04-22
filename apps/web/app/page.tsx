import { EntryCard } from "@/components/home/EntryCard";
import { Hero } from "@/components/home/Hero";
import { HowToPlay } from "@/components/home/HowToPlay";

export default function HomePage() {
  return (
    <main className="min-h-screen px-4 py-10 sm:py-14">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <Hero />
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:items-start">
          <EntryCard />
          <HowToPlay />
        </div>
      </div>
    </main>
  );
}
