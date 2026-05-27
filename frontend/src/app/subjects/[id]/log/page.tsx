"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TextEntryForm } from "@/components/entries/TextEntryForm";
import { VoiceEntryForm } from "@/components/entries/VoiceEntryForm";
import { ArrowLeft, FileText, Mic } from "lucide-react";

export default function LogEntryPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const [mode, setMode] = useState<"text" | "voice">("text");

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border/60 shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center gap-3">
          <Link href={`/subjects/${id}`} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="w-px h-5 bg-border" />
          <span className="text-sm font-medium text-foreground">Log an entry</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-foreground mb-1">New observation</h1>
          <p className="text-sm text-muted-foreground">Capture something specific — an episode, a conversation, a pattern you noticed.</p>
        </div>

        {/* Mode toggle */}
        <div className="inline-flex bg-muted rounded-xl p-1 mb-8 gap-1">
          <button
            onClick={() => setMode("text")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              mode === "text"
                ? "bg-card shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="w-4 h-4" />
            Text
          </button>
          <button
            onClick={() => setMode("voice")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              mode === "voice"
                ? "bg-card shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Mic className="w-4 h-4" />
            Voice
          </button>
        </div>

        {mode === "text" ? (
          <TextEntryForm subjectId={id} onSuccess={() => router.push(`/subjects/${id}`)} />
        ) : (
          <VoiceEntryForm subjectId={id} onSuccess={() => router.push(`/subjects/${id}`)} />
        )}
      </main>
    </div>
  );
}
