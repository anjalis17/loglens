"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { EntryFeed } from "@/components/entries/EntryFeed";
import { SummaryView } from "@/components/summary/SummaryView";
import { LetterList } from "@/components/letters/LetterList";
import { TimelineView } from "@/components/timeline/TimelineView";
import type { SubjectOut } from "@/types/api";
import { ArrowLeft, Plus } from "lucide-react";

type Tab = "entries" | "trajectory" | "summary" | "letters";

const TAB_LABELS: Record<Tab, string> = {
  entries: "Entries",
  trajectory: "Trajectory",
  summary: "AI Summary",
  letters: "Letters",
};

export default function SubjectDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [tab, setTab] = useState<Tab>("entries");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const { data: subject, isLoading: queryLoading } = useQuery({
    queryKey: ["subject", id],
    queryFn: () => api.get<SubjectOut>(`/subjects/${id}`),
    enabled: mounted,
  });

  // Before mount: isLoading=true ensures server and client render the same spinner.
  const isLoading = !mounted || queryLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  if (!subject) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Subject not found.</p>
      </div>
    );
  }

  const initials = subject.full_name.trim().split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border/60 shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div className="w-px h-5 bg-border" />
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full gradient-teal flex items-center justify-center">
                  <span className="text-xs font-bold text-white">{initials}</span>
                </div>
                <div>
                  <p className="font-semibold text-foreground leading-tight text-sm">{subject.full_name}</p>
                  <p className="text-xs text-muted-foreground leading-tight">
                    {subject.role_title ? `${subject.role_title} · ` : ""}{subject.relationship_type}
                  </p>
                </div>
              </div>
            </div>
            {tab === "entries" && (
              <Link href={`/subjects/${id}/log`}>
                <Button size="sm" className="gap-1.5 h-8">
                  <Plus className="w-3.5 h-3.5" /> Log entry
                </Button>
              </Link>
            )}
          </div>

          <nav className="flex gap-0 -mb-px">
            {(["entries", "trajectory", "summary", "letters"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                {TAB_LABELS[t]}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {tab === "entries" && <EntryFeed subjectId={id} />}
        {tab === "trajectory" && <TimelineView subjectId={id} />}
        {tab === "summary" && <SummaryView subjectId={id} />}
        {tab === "letters" && <LetterList subjectId={id} />}
      </main>
    </div>
  );
}
