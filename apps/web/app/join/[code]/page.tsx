import { JoinView } from "@/components/join/JoinView";

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <JoinView roomCode={code.toUpperCase()} />;
}
