"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { EntryCard } from "./EntryCard";
import type { EntryPage } from "@/types/api";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, BookOpen } from "lucide-react";

interface Props {
  subjectId: string;
}

export function EntryFeed({ subjectId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["entries", subjectId],
    queryFn: () => api.get<EntryPage>(`/subjects/${subjectId}/entries?page_size=50`),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-card rounded-xl border border-border/60 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data?.items.length) {
    return (
      <div className="text-center py-20">
        <div className="w-14 h-14 rounded-2xl gradient-teal-subtle mx-auto mb-4 flex items-center justify-center">
          <BookOpen className="w-7 h-7 text-primary/60" />
        </div>
        <h3 className="text-base font-semibold text-foreground mb-1">No entries yet</h3>
        <p className="text-sm text-muted-foreground mb-6">Start capturing observations to build a longitudinal picture.</p>
        <Link href={`/subjects/${subjectId}/log`}>
          <Button className="gap-2">
            <Plus className="w-4 h-4" /> Log first entry
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">
        {data.total} {data.total === 1 ? "entry" : "entries"}
      </p>
      {data.items.map((entry) => (
        <EntryCard key={entry.id} entry={entry} subjectId={subjectId} />
      ))}
    </div>
  );
}
