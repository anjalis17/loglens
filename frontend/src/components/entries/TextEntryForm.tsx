"use client";

import { useState, KeyboardEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X, CheckCircle2 } from "lucide-react";
import type { EntryOut } from "@/types/api";

interface Props {
  subjectId: string;
  onSuccess: () => void;
}

export function TextEntryForm({ subjectId, onSuccess }: Props) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  function addTag() {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag)) setTags((prev) => [...prev, tag]);
    setTagInput("");
  }

  function handleTagKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); addTag(); }
    if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setError("");
    setLoading(true);
    try {
      await api.post<EntryOut>(`/subjects/${subjectId}/entries`, {
        raw_text: text.trim(),
        tags,
      });
      await queryClient.invalidateQueries({ queryKey: ["entries", subjectId] });
      await queryClient.invalidateQueries({ queryKey: ["subjects"] });
      setSuccess(true);
      setTimeout(onSuccess, 800);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save entry");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="text-center py-16">
        <div className="w-12 h-12 rounded-full bg-primary/10 mx-auto mb-4 flex items-center justify-center">
          <CheckCircle2 className="w-6 h-6 text-primary" />
        </div>
        <p className="font-semibold text-foreground">Entry saved!</p>
        <p className="text-sm text-muted-foreground mt-1">Redirecting…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="entry-text" className="text-sm font-medium">Observation</Label>
        <Textarea
          id="entry-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What did you notice? Be specific — capture the episode, not just the trait."
          className="min-h-[220px] resize-none text-sm leading-relaxed"
          autoFocus
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="tag-input" className="text-sm font-medium">
          Tags <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1 pr-1.5 rounded-full text-xs">
                {tag}
                <button
                  type="button"
                  onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                  className="hover:text-destructive transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <Input
          id="tag-input"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={handleTagKeyDown}
          onBlur={addTag}
          placeholder="Type a tag, press Enter"
          className="h-10"
        />
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <Button type="submit" disabled={loading || !text.trim()} className="h-10">
        {loading ? "Saving…" : "Save entry"}
      </Button>
    </form>
  );
}
