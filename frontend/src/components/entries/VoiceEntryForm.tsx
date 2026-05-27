"use client";

import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { uploadVoiceEntry } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Mic, Upload, CheckCircle2, FileAudio } from "lucide-react";
import type { EntryOut } from "@/types/api";

interface Props {
  subjectId: string;
  onSuccess: () => void;
}

export function VoiceEntryForm({ subjectId, onSuccess }: Props) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.type.startsWith("audio/")) {
      setFile(dropped);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError("");
    setLoading(true);
    try {
      await uploadVoiceEntry<EntryOut>(`/subjects/${subjectId}/entries/voice`, file);
      await queryClient.invalidateQueries({ queryKey: ["entries", subjectId] });
      await queryClient.invalidateQueries({ queryKey: ["subjects"] });
      setSuccess(true);
      setTimeout(onSuccess, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
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
        <p className="font-semibold text-foreground">Audio uploaded!</p>
        <p className="text-sm text-muted-foreground mt-1">Transcribing in the background — the entry will appear shortly.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Drop zone */}
      <div
        className={`relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer ${
          dragOver
            ? "border-primary bg-primary/5"
            : file
            ? "border-primary/40 bg-primary/5"
            : "border-border hover:border-primary/40 hover:bg-muted/50"
        }`}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
          {file ? (
            <>
              <div className="w-12 h-12 rounded-full bg-primary/10 mb-4 flex items-center justify-center">
                <FileAudio className="w-6 h-6 text-primary" />
              </div>
              <p className="font-medium text-foreground text-sm">{file.name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {(file.size / (1024 * 1024)).toFixed(1)} MB
              </p>
              <button
                type="button"
                className="text-xs text-primary mt-3 hover:underline"
                onClick={(e) => { e.stopPropagation(); setFile(null); }}
              >
                Change file
              </button>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-muted mb-4 flex items-center justify-center">
                <Mic className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="font-medium text-sm text-foreground">Drop an audio file or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1.5">MP3, M4A, WAV, WEBM · Max 100 MB</p>
            </>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <Button type="submit" disabled={loading || !file} className="gap-2 h-10">
        {loading ? (
          "Uploading…"
        ) : (
          <>
            <Upload className="w-4 h-4" />
            Upload & transcribe
          </>
        )}
      </Button>
    </form>
  );
}
