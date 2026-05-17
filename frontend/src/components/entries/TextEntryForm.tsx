"use client";

import { useState, KeyboardEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
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
      <div className="text-center py-12">
        <p className="text-lg font-medium text-green-700">Entry saved!</p>
        <p className="text-sm text-muted-foreground mt-1">Redirecting…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1">
        <Label htmlFor="entry-text">Observation</Label>
        <Textarea
          id="entry-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What did you notice today? Be specific — capture the episode, not just the trait."
          className="min-h-[200px] resize-none text-base"
          autoFocus
          required
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="tag-input">Tags</Label>
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 pr-1">
              {tag}
              <button type="button" onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}>
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
        <Input
          id="tag-input"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={handleTagKeyDown}
          onBlur={addTag}
          placeholder="Type tag, press Enter"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={loading || !text.trim()}>
          {loading ? "Saving…" : "Save entry"}
        </Button>
      </div>
    </form>
  );
}
