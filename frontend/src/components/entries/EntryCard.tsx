"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatRelative } from "@/lib/utils";
import type { EntryOut } from "@/types/api";
import { Trash2 } from "lucide-react";

interface Props {
  entry: EntryOut;
  subjectId: string;
}

export function EntryCard({ entry, subjectId }: Props) {
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this entry?")) return;
    setDeleting(true);
    try {
      await api.delete(`/entries/${entry.id}`);
      await queryClient.invalidateQueries({ queryKey: ["entries", subjectId] });
      await queryClient.invalidateQueries({ queryKey: ["subjects"] });
    } catch {
      setDeleting(false);
    }
  }

  return (
    <Card className={deleting ? "opacity-50 pointer-events-none" : ""}>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground mb-1.5">
              {formatRelative(entry.created_at)} · {entry.author_email}
            </p>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{entry.raw_text}</p>
            {entry.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {entry.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                ))}
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-destructive"
            onClick={handleDelete}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
