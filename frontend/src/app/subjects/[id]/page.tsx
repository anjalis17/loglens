"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { EntryFeed } from "@/components/entries/EntryFeed";
import { SummaryView } from "@/components/summary/SummaryView";
import { LetterList } from "@/components/letters/LetterList";
import type { SubjectOut } from "@/types/api";
import { ArrowLeft, Plus } from "lucide-react";

type Tab = "entries" | "summary" | "letters";

export default function SubjectDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [tab, setTab] = useState<Tab>("entries");

  const { data: subject, isLoading } = useQuery({
    queryKey: ["subject", id],
    queryFn: () => api.get<SubjectOut>(`/subjects/${id}`),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!subject) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Subject not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold">{subject.full_name}</h1>
              <p className="text-sm text-muted-foreground">
                {subject.role_title ? `${subject.role_title} · ` : ""}{subject.relationship_type}
              </p>
            </div>
          </div>
          {tab === "entries" && (
            <Link href={`/subjects/${id}/log`}>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-1" /> Log entry
              </Button>
            </Link>
          )}
        </div>
      </header>

      <div className="border-b px-6">
        <nav className="flex gap-1">
          {(["entries", "summary", "letters"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors capitalize ${
                tab === t
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {tab === "entries" && <EntryFeed subjectId={id} />}
        {tab === "summary" && <SummaryView subjectId={id} />}
        {tab === "letters" && <LetterList subjectId={id} />}
      </main>
    </div>
  );
}
