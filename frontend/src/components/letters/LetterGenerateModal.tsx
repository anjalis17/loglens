"use client";

import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getToken } from "@/lib/auth";
import { BASE_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Tone = "formal" | "warm" | "balanced";

interface Props {
  subjectId: string;
  open: boolean;
  onClose: () => void;
}

export function LetterGenerateModal({ subjectId, open, onClose }: Props) {
  const queryClient = useQueryClient();
  const [purpose, setPurpose] = useState("");
  const [tone, setTone] = useState<Tone>("balanced");
  const [additionalContext, setAdditionalContext] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [letterText, setLetterText] = useState("");
  const [warning, setWarning] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  function resetForm() {
    setPurpose("");
    setTone("balanced");
    setAdditionalContext("");
    setStreaming(false);
    setLetterText("");
    setWarning("");
    setError("");
    setDone(false);
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setWarning("");
    setLetterText("");
    setDone(false);
    setStreaming(true);

    try {
      const token = getToken();
      const res = await fetch(`${BASE_URL}/letters/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subject_id: subjectId,
          purpose,
          tone,
          additional_context: additionalContext || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? "Generation failed");
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = JSON.parse(line.slice(6));
          if (json.type === "warning") setWarning(json.message);
          if (json.type === "chunk") setLetterText((prev) => prev + json.text);
          if (json.type === "done") {
            setDone(true);
            await queryClient.invalidateQueries({ queryKey: ["letters", subjectId] });
          }
          if (json.type === "error") throw new Error(json.message);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setStreaming(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(letterText);
  }

  function handleDownload() {
    const blob = new Blob([letterText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "recommendation-letter.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { resetForm(); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate recommendation letter</DialogTitle>
        </DialogHeader>

        {!streaming && !letterText && (
          <form onSubmit={handleGenerate} className="space-y-4 mt-2">
            <div className="space-y-1">
              <Label htmlFor="purpose">Purpose</Label>
              <Input
                id="purpose"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Graduate school application, job at Acme Corp, fellowship…"
                required
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <Label>Tone</Label>
              <div className="flex gap-2">
                {(["formal", "warm", "balanced"] as Tone[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTone(t)}
                    className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors capitalize ${
                      tone === t
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background hover:bg-accent"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="context">Additional context <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                id="context"
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                placeholder="Any specific achievements or projects to highlight…"
                className="min-h-[80px]"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full">Generate letter</Button>
          </form>
        )}

        {(streaming || letterText) && (
          <div className="mt-2 space-y-4">
            {warning && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm text-yellow-800">
                {warning}
              </div>
            )}

            <div className="border rounded-md p-4 min-h-[300px] font-serif text-sm leading-relaxed whitespace-pre-wrap bg-muted/20">
              {letterText}
              {streaming && <span className="inline-block w-0.5 h-4 bg-foreground animate-pulse ml-0.5 align-text-bottom" />}
            </div>

            {done && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleCopy}>Copy to clipboard</Button>
                <Button variant="outline" onClick={handleDownload}>Download .txt</Button>
                <Button variant="ghost" onClick={() => { resetForm(); }}>Generate another</Button>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
