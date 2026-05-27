"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, BASE_URL } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/utils";
import type { EntryOut } from "@/types/api";
import { Mic, Trash2, Loader2 } from "lucide-react";

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

  const isPending = entry.content_type === "voice" && entry.transcription_status === "pending";
  const isFailed = entry.content_type === "voice" && entry.transcription_status === "failed";
  const audioSrc = entry.audio_url ? `${BASE_URL}${entry.audio_url}` : null;

  return (
    <div
      className={`bg-card rounded-xl border border-border/60 p-5 transition-opacity ${
        deleting ? "opacity-40 pointer-events-none" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Meta row */}
          <div className="flex items-center gap-2 mb-3">
            {entry.content_type === "voice" && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">
                <Mic className="w-3 h-3" />
                Voice
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {formatRelative(entry.created_at)} · {entry.author_email}
            </span>
          </div>

          {/* Content */}
          {isPending ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground italic">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              Transcribing audio…
            </div>
          ) : isFailed ? (
            <p className="text-sm text-destructive/80 italic">Transcription failed.</p>
          ) : (
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">{entry.raw_text}</p>
          )}

          {/* Audio player */}
          {audioSrc && (
            <div className="mt-3">
              <audio
                controls
                src={audioSrc}
                className="w-full h-9 rounded-lg"
                style={{ accentColor: "hsl(183, 68%, 28%)" }}
              />
            </div>
          )}

          {/* Tags */}
          {entry.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {entry.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs px-2 py-0.5 rounded-full">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 h-8 w-8 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10"
          onClick={handleDelete}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
