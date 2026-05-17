"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { TextEntryForm } from "@/components/entries/TextEntryForm";
import { ArrowLeft } from "lucide-react";

export default function LogEntryPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <Link href={`/subjects/${id}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
      </header>
      <main className="max-w-2xl mx-auto px-6 py-8">
        <h2 className="text-2xl font-bold mb-6">Log an entry</h2>
        <TextEntryForm
          subjectId={id}
          onSuccess={() => router.push(`/subjects/${id}`)}
        />
      </main>
    </div>
  );
}
