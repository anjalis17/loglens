"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { EntryCard } from "./EntryCard";
import type { EntryPage } from "@/types/api";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface Props {
  subjectId: string;
}

export function EntryFeed({ subjectId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["entries", subjectId],
    queryFn: () => api.get<EntryPage>(`/subjects/${subjectId}/entries?page_size=50`),
  });

  if (isLoading) return <p className="text-muted-foreground">Loading entries…</p>;

  if (!data?.items.length) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="mb-4">No entries yet.</p>
        <Link href={`/subjects/${subjectId}/log`}>
          <Button>
            <Plus className="w-4 h-4 mr-1" /> Log first entry
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{data.total} entries</p>
      {data.items.map((entry) => (
        <EntryCard key={entry.id} entry={entry} subjectId={subjectId} />
      ))}
    </div>
  );
}
