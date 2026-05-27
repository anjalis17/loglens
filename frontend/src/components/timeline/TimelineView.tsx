"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, BASE_URL } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import type { EntryPage, EntryOut, SummaryOut, NotableEpisode, CoreTrait, CautionItem } from "@/types/api";
import { Mic, ChevronDown, ChevronUp, Sparkles, RefreshCw, BookOpen, Loader2, AlertTriangle } from "lucide-react";
import { TraitsSidebar, TRAIT_COLORS, CAUTION_COLOR, type FocusedItem } from "./TraitsSidebar";

// ─── Caution keyword matching ──────────────────────────────────────────────────
// Only used for cautions (plain strings). Traits use LLM-assigned entry_ids directly.

const STOP_WORDS = new Set([
  "about","after","again","against","along","also","although","always","among","another",
  "anyone","anything","appear","around","asked","based","because","become","before",
  "being","below","between","both","bring","brought","called","cannot","cause","change",
  "clear","come","comes","could","doing","during","early","either","else","enough",
  "even","every","everyone","everything","feel","felt","first","found","from","gave",
  "getting","given","going","great","group","have","having","helped","helps","here",
  "high","himself","however","important","including","instead","into","itself","just",
  "keep","kept","knew","known","large","later","lead","left","less","like","likely",
  "little","look","looked","looking","made","make","many","might","more","most","much",
  "must","myself","never","next","nothing","number","often","once","only","open",
  "other","otherwise","over","part","people","place","point","provide","rather",
  "really","right","same","seem","seemed","several","should","show","since","small",
  "some","someone","something","sometimes","soon","started","still","such","take",
  "taken","than","that","their","them","then","there","these","they","thing","think",
  "this","those","though","time","together","toward","under","until","upon",
  "used","using","very","want","well","were","what","when","where","whether","which",
  "while","will","with","within","without","would","your",
]);

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,.;:!?()\[\]{}"'—\-]+/)
    .filter((w) => w.length > 4 && !STOP_WORDS.has(w));
}

function matchesCaution(entryText: string, caution: string): boolean {
  if (!entryText || !caution) return false;
  const entryKw = new Set(extractKeywords(entryText));
  const cautionKw = extractKeywords(caution);
  if (cautionKw.length === 0) return false;
  const matches = cautionKw.filter((w) => entryKw.has(w)).length;
  return matches >= Math.max(2, Math.ceil(cautionKw.length * 0.4));
}

// ─── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ entries }: { entries: EntryOut[] }) {
  if (entries.length < 2) return null;

  const sorted = [...entries].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const start   = new Date(sorted[0].created_at).getTime();
  const end     = new Date(sorted[sorted.length - 1].created_at).getTime();
  const range   = end - start || 1;
  const BUCKETS = 18;
  const counts  = Array<number>(BUCKETS).fill(0);

  sorted.forEach((e) => {
    const idx = Math.min(
      Math.floor(((new Date(e.created_at).getTime() - start) / range) * BUCKETS),
      BUCKETS - 1
    );
    counts[idx]++;
  });

  const max   = Math.max(...counts, 1);
  const H     = 52;
  const W     = 600;
  const slotW = W / BUCKETS;
  const barW  = slotW * 0.6;
  const gap   = slotW * 0.4;

  return (
    <div className="bg-card rounded-xl border border-border/60 p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Logging activity
        </p>
        <p className="text-xs text-muted-foreground">
          {entries.length} {entries.length === 1 ? "entry" : "entries"}
        </p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: H }}>
        <defs>
          <linearGradient id="sparkGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(183,68%,65%)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="hsl(183,68%,28%)" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        {counts.map((count, i) => {
          const barH = count === 0 ? 2 : Math.max((count / max) * H, 4);
          const x    = i * slotW + gap / 2;
          return (
            <rect
              key={i} x={x} y={H - barH} width={barW} height={barH} rx={2}
              fill={count === 0 ? "hsl(183,20%,90%)" : "url(#sparkGrad)"}
            />
          );
        })}
      </svg>
      <div className="flex justify-between mt-1.5">
        <span className="text-xs text-muted-foreground">{formatDate(sorted[0].created_at)}</span>
        <span className="text-xs text-muted-foreground">{formatDate(sorted[sorted.length - 1].created_at)}</span>
      </div>
    </div>
  );
}

// ─── Entry dot ─────────────────────────────────────────────────────────────────

const DEFAULT_DOT = { color: "#94a3b8", ring: "rgba(148,163,184,0.18)" };

function EntryDot({
  entry,
  focused,
  matchedEntryIds,
  onSelect,
  isSelected,
}: {
  entry: EntryOut;
  focused: FocusedItem;
  matchedEntryIds: Set<string>;
  onSelect: (entry: EntryOut) => void;
  isSelected: boolean;
}) {
  const isMatched = focused !== null && matchedEntryIds.has(entry.id);
  const dimmed    = focused !== null && !isMatched;
  const enlarged  = isMatched || isSelected;

  let dotStyle: React.CSSProperties;
  if (focused?.kind === "trait" && isMatched) {
    const color = TRAIT_COLORS[focused.idx % TRAIT_COLORS.length];
    dotStyle = { backgroundColor: color.dot, boxShadow: `0 0 0 5px ${color.ring}` };
  } else if (focused?.kind === "caution" && isMatched) {
    dotStyle = { backgroundColor: CAUTION_COLOR.dot, boxShadow: `0 0 0 5px ${CAUTION_COLOR.ring}` };
  } else {
    dotStyle = {
      backgroundColor: DEFAULT_DOT.color,
      boxShadow: isSelected
        ? `0 0 0 6px rgba(148,163,184,0.30), 0 0 0 1px ${DEFAULT_DOT.color}`
        : `0 0 0 5px ${DEFAULT_DOT.ring}`,
    };
  }

  return (
    <div
      className="relative flex items-center justify-center w-9 h-9 cursor-pointer group"
      onClick={() => onSelect(entry)}
      title="Click to read entry"
    >
      <div
        className={`w-4 h-4 rounded-full transition-all duration-200 group-hover:scale-125 group-hover:brightness-110 ${
          dimmed ? "opacity-20" : "opacity-100"
        } ${enlarged ? "scale-125" : ""}`}
        style={dotStyle}
      />
    </div>
  );
}

// ─── Entry detail dialog ────────────────────────────────────────────────────────

function EntryDetailDialog({
  entry,
  cautions,
  onClose,
}: {
  entry: EntryOut | null;
  cautions: CautionItem[];
  onClose: () => void;
}) {
  const audioSrc  = entry?.audio_url ? `${BASE_URL}${entry.audio_url}` : null;
  const isPending = entry?.content_type === "voice" && entry?.transcription_status === "pending";
  const isFailed  = entry?.content_type === "voice" && entry?.transcription_status === "failed";

  const matchedCautions = entry
    ? cautions.filter((c) => {
        const item = c as CautionItem | string;
        if (typeof item === "string") return matchesCaution(entry.raw_text ?? "", item);
        return item.entry_ids.includes(entry.id);
      })
    : [];

  return (
    <Dialog open={!!entry} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60">
          <div className="flex items-center gap-2 flex-wrap pr-6">
            {entry?.content_type === "voice" && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">
                <Mic className="w-3 h-3" /> Voice
              </span>
            )}
            <DialogTitle className="text-sm font-semibold text-foreground">
              {entry ? formatDate(entry.created_at) : ""}
            </DialogTitle>
            {entry?.author_email && (
              <span className="text-xs text-muted-foreground">· {entry.author_email}</span>
            )}
          </div>
        </DialogHeader>

        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
          {isPending ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground italic">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              Transcribing audio…
            </div>
          ) : isFailed ? (
            <p className="text-sm text-destructive/80 italic">Transcription failed.</p>
          ) : (
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
              {entry?.raw_text}
            </p>
          )}

          {audioSrc && (
            <div className="mt-5">
              <audio controls src={audioSrc} className="w-full h-9 rounded-lg"
                style={{ accentColor: "hsl(183,68%,28%)" }} />
            </div>
          )}

          {entry?.tags && entry.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-border/40">
              {entry.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs px-2 py-0.5 rounded-full">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {matchedCautions.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border/40">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
                  {matchedCautions.length === 1 ? "Relevant caution" : "Relevant cautions"}
                </p>
              </div>
              <div className="space-y-2">
                {matchedCautions.map((c, i) => (
                  <p key={i} className="text-xs text-amber-800 leading-relaxed bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
                    {typeof c === "string" ? c : c.text}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Episode card ──────────────────────────────────────────────────────────────

function EpisodeCard({
  episode,
  episodeIdx,
}: {
  episode: NotableEpisode;
  episodeIdx: number;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="bg-card border border-border/60 rounded-xl shadow-sm overflow-hidden cursor-pointer select-none hover:shadow-md transition-all duration-200"
      style={{ borderLeft: "3px solid hsl(183,68%,28%)" }}
      onClick={() => setExpanded((v) => !v)}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                Milestone {episodeIdx + 1}
              </span>
              {episode.date_approx && (
                <span className="text-xs text-muted-foreground">· {episode.date_approx}</span>
              )}
            </div>
            <p className="font-semibold text-sm text-foreground leading-snug mb-1">
              {episode.title}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {episode.description}
            </p>
          </div>
          <div className="shrink-0 text-muted-foreground/40 mt-0.5">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </div>

      {expanded && episode.qualities_demonstrated.length > 0 && (
        <div className="border-t border-border/60 bg-muted/20 px-4 py-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Qualities demonstrated
          </p>
          <div className="flex flex-wrap gap-1.5">
            {episode.qualities_demonstrated.map((q, i) => (
              <Badge key={i} variant="secondary" className="text-xs px-2 py-0.5 rounded-full">
                {q}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Timeline data model ────────────────────────────────────────────────────────

type TimelineRow = {
  entry: EntryOut;
  episode?: { data: NotableEpisode; side: "left" | "right"; idx: number };
};

const ANCHOR_STOP = new Set([
  "about","after","also","been","being","both","come","doing","each","even","ever",
  "from","have","here","into","just","keep","like","made","make","more","much","must",
  "never","only","other","over","same","such","take","than","that","them","then",
  "there","they","this","those","time","very","want","well","were","what","when","with",
]);
function anchorWords(s: string): string[] {
  return s.toLowerCase().split(/\W+/).filter((w) => w.length > 3 && !ANCHOR_STOP.has(w));
}

// For each episode, find which entry's evidence text best matches the episode
// title+description via word overlap. Falls back to LLM-assigned entry_id if set.
function resolveEpisodeAnchorId(
  episode: NotableEpisode,
  traits: CoreTrait[]
): string | null {
  if (episode.entry_id) return episode.entry_id;

  const allEvidence: { entry_id: string; text: string }[] = [];
  for (const trait of traits) {
    for (const ev of trait.evidence) {
      if (typeof ev !== "string" && ev.entry_id && ev.text) {
        allEvidence.push({ entry_id: ev.entry_id, text: ev.text });
      }
    }
  }
  if (!allEvidence.length) return null;

  const epWords = new Set(anchorWords(`${episode.title} ${episode.description}`));
  let bestId: string | null = null;
  let bestScore = 0;
  for (const ev of allEvidence) {
    const score = anchorWords(ev.text).filter((w) => epWords.has(w)).length;
    if (score > bestScore) { bestScore = score; bestId = ev.entry_id; }
  }
  return bestId;
}

function buildTimeline(
  entries: EntryOut[],
  episodes: NotableEpisode[],
  traits: CoreTrait[]
): TimelineRow[] {
  const sorted = [...entries].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  if (!episodes.length || !sorted.length) {
    return sorted.map((entry) => ({ entry }));
  }

  const n = episodes.length;
  const m = sorted.length;
  const entryIdToIdx = new Map(sorted.map((e, i) => [e.id, i]));

  // reversed[0] = newest episode (chronological idx = n-1 → "Milestone N")
  const reversed = [...episodes].reverse();
  const anchorMap = new Map<number, { ep: NotableEpisode; originalIdx: number }>();

  reversed.forEach((ep, posIdx) => {
    const originalIdx = n - 1 - posIdx;
    // Resolve anchor: LLM-assigned entry_id → word-match fallback → even distribution
    const anchorId = resolveEpisodeAnchorId(ep, traits);
    let slot = anchorId && entryIdToIdx.has(anchorId)
      ? entryIdToIdx.get(anchorId)!
      : Math.min(Math.round((posIdx * (m - 1)) / Math.max(n - 1, 1)), m - 1);
    // Resolve slot collisions by shifting forward
    while (anchorMap.has(slot) && slot < m - 1) slot++;
    anchorMap.set(slot, { ep, originalIdx });
  });

  return sorted.map((entry, i) => {
    const anchor = anchorMap.get(i);
    if (!anchor) return { entry };
    return {
      entry,
      episode: {
        data: anchor.ep,
        side: anchor.originalIdx % 2 === 0 ? "right" : "left",
        idx: anchor.originalIdx,
      },
    };
  });
}

// ─── Main component ─────────────────────────────────────────────────────────────

export function TimelineView({ subjectId }: { subjectId: string }) {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing]       = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<EntryOut | null>(null);
  const [focused, setFocused]             = useState<FocusedItem>(null);
  const refreshVersionRef                 = useRef<number | null>(null);

  const { data: entryPage, isLoading: entriesLoading } = useQuery({
    queryKey: ["entries", subjectId, 200],
    queryFn: () => api.get<EntryPage>(`/subjects/${subjectId}/entries?page_size=200`),
    refetchInterval: 12000,
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["summary", subjectId],
    queryFn: () => api.get<SummaryOut>(`/subjects/${subjectId}/summary`),
    retry: false,
  });

  // Auto-poll summary when entries have been added since the last distillation
  const entryTotal        = entryPage?.total ?? 0;
  const summaryEntryCount = summary?.entry_count_at_distillation ?? 0;

  useEffect(() => {
    if (entryTotal <= summaryEntryCount) return;
    const id = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["summary", subjectId] });
    }, 4000);
    return () => clearInterval(id);
  }, [entryTotal, summaryEntryCount, subjectId, queryClient]);

  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    refreshVersionRef.current = summary?.distillation_version ?? null;
    try {
      await api.post(`/subjects/${subjectId}/summary/refresh`, {});
    } catch {
      setRefreshing(false);
      return;
    }
    // Poll every 2s until distillation_version increments (max 30s)
    let attempts = 0;
    const poll = async () => {
      if (attempts++ >= 15) {
        queryClient.invalidateQueries({ queryKey: ["summary", subjectId] });
        setRefreshing(false);
        return;
      }
      try {
        const fresh = await api.get<SummaryOut>(`/subjects/${subjectId}/summary`);
        if (fresh.distillation_version !== refreshVersionRef.current) {
          queryClient.setQueryData(["summary", subjectId], fresh);
          setRefreshing(false);
        } else {
          setTimeout(poll, 2000);
        }
      } catch {
        setTimeout(poll, 2000);
      }
    };
    setTimeout(poll, 2000);
  }

  function handleSelectEntry(entry: EntryOut) {
    setSelectedEntry((prev) => (prev?.id === entry.id ? null : entry));
  }

  const entries    = entryPage?.items ?? [];
  const ss         = summary?.structured_summary;
  const episodes   = ss?.notable_episodes ?? [];
  const traits     = ss?.core_traits ?? [];
  const cautions   = ss?.cautions ?? [];
  const growthArc  = ss?.growth_arc;
  const hasSummary = !!ss;
  const hasSidebar = traits.length > 0 || cautions.length > 0;

  const rows = useMemo(() => buildTimeline(entries, episodes, traits), [entries, episodes, traits]);

  // Set of entry IDs that should be highlighted for the current focus.
  // Traits: exact IDs from LLM-assigned evidence. Cautions: keyword matching fallback.
  const matchedEntryIds = useMemo<Set<string>>(() => {
    if (!focused) return new Set();
    if (focused.kind === "trait") {
      const evidence = traits[focused.idx]?.evidence ?? [];
      return new Set(
        evidence
          .map((ev) => (typeof ev === "string" ? null : ev.entry_id))
          .filter((id): id is string => !!id)
      );
    }
    const caution = cautions[focused.idx];
    if (!caution) return new Set();
    if (typeof caution !== "string" && caution.entry_ids.length > 0) {
      return new Set(caution.entry_ids);
    }
    const text = typeof caution === "string" ? caution : caution.text;
    return new Set(entries.filter((e) => e.raw_text && matchesCaution(e.raw_text, text)).map((e) => e.id));
  }, [focused, traits, cautions, entries]);

  // Excerpt text to display next to each highlighted dot.
  // Traits: use the LLM-written evidence text directly.
  // Cautions: use the caution string itself as the excerpt.
  const excerptMap = useMemo<Map<string, string>>(() => {
    if (!focused) return new Map();
    if (focused.kind === "trait") {
      const evidence = traits[focused.idx]?.evidence ?? [];
      const result = new Map<string, string>();
      for (const ev of evidence) {
        if (typeof ev !== "string" && ev.entry_id) result.set(ev.entry_id, ev.text);
      }
      return result;
    }
    const caution = cautions[focused.idx];
    if (!caution) return new Map();
    const text = typeof caution === "string" ? caution : caution.text;
    const result = new Map<string, string>();
    matchedEntryIds.forEach((id) => result.set(id, text));
    return result;
  }, [focused, traits, cautions, entries]);

  // Derive label for the active focus indicator
  const focusLabel: string | null =
    focused?.kind === "trait"
      ? (traits[focused.idx]?.trait ?? null)
      : focused?.kind === "caution"
      ? (() => { const c = cautions[focused.idx]; return c ? (typeof c === "string" ? c : c.text) : "a caution"; })()
      : null;

  const focusDotColor: string | null =
    focused?.kind === "trait"
      ? TRAIT_COLORS[focused.idx % TRAIT_COLORS.length].dot
      : focused?.kind === "caution"
      ? CAUTION_COLOR.dot
      : null;

  if (entriesLoading) {
    return (
      <div className="space-y-4">
        <div className="h-24 bg-card rounded-xl border border-border/60 animate-pulse" />
        <div className="flex gap-8">
          <div className="flex-1 space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-card rounded-xl border border-border/60 animate-pulse" />
            ))}
          </div>
          <div className="w-64 space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-24 bg-card rounded-xl border border-border/60 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!entries.length) {
    return (
      <div className="text-center py-20">
        <div className="w-14 h-14 rounded-2xl gradient-teal-subtle mx-auto mb-4 flex items-center justify-center">
          <BookOpen className="w-7 h-7 text-primary/60" />
        </div>
        <p className="text-base font-semibold text-foreground mb-1">No entries yet</p>
        <p className="text-sm text-muted-foreground">
          Log some observations first to see the trajectory unfold.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <EntryDetailDialog entry={selectedEntry} cautions={cautions} onClose={() => setSelectedEntry(null)} />

      {growthArc && (
        <div className="bg-primary/5 border border-primary/15 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1.5">
                Growth Arc
              </p>
              <p className="text-sm text-foreground leading-relaxed italic">
                &ldquo;{growthArc}&rdquo;
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Context row */}
      <div className="flex items-center gap-4 flex-wrap">
        {focused === null ? (
          <span className="text-xs text-muted-foreground/70">
            {hasSidebar
              ? "Select a trait or caution to highlight related entries · click any dot to read"
              : "Click any dot to read the full observation"}
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: focusDotColor! }} />
            <span className="text-xs text-muted-foreground">
              Highlighting entries for{" "}
              <span className="font-semibold text-foreground">{focusLabel}</span>
            </span>
            <button
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
              onClick={() => setFocused(null)}
            >
              clear
            </button>
          </div>
        )}

        {!hasSummary && !summaryLoading && (
          <div className="ml-auto">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5"
              onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
              Generate summary to unlock highlights
            </Button>
          </div>
        )}
        {hasSummary && (
          <div className="ml-auto">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-muted-foreground"
              onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        )}
      </div>

      {/* Main layout */}
      <div className="flex gap-8 items-start">
        <div className="flex-1 min-w-0">
          <div className="relative">
            {/* Spine */}
            <div
              className="absolute top-0 bottom-0 pointer-events-none z-0"
              style={{
                left: "calc(50% - 1px)", width: 2,
                background: "linear-gradient(to bottom, hsl(183,68%,28%) 0%, hsl(183,68%,85%) 100%)",
              }}
            />

            <div className="relative z-10">
              {/* Start cap — Today */}
              <div className="grid items-center pt-2 pb-4" style={{ gridTemplateColumns: "1fr 36px 1fr" }}>
                <div />
                <div className="flex items-center justify-center">
                  <div className="w-4 h-4 rounded-full bg-primary/50" />
                </div>
                <div className="pl-3 flex items-center">
                  <p className="text-xs font-medium text-primary whitespace-nowrap">Today</p>
                </div>
              </div>

              {rows.map((row) => {
                const traitFocused   = focused?.kind === "trait";
                const cautionFocused = focused?.kind === "caution";
                const traitColor     = traitFocused ? TRAIT_COLORS[focused!.idx % TRAIT_COLORS.length] : null;
                const excerptColor   = traitColor ?? (cautionFocused ? CAUTION_COLOR : null);
                const excerpt        = (traitFocused || cautionFocused)
                  ? (excerptMap.get(row.entry.id) ?? null)
                  : null;
                // Avoid putting the excerpt on the same side as an episode card.
                const excerptSide: "left" | "right" | null = excerpt
                  ? (row.episode?.side === "right" ? "left" : "right")
                  : null;

                const hasContent = !!row.episode || !!excerpt;

                return (
                  <div
                    key={row.entry.id}
                    className="grid items-center"
                    style={{
                      gridTemplateColumns: "1fr 36px 1fr",
                      paddingTop:    hasContent ? "10px" : "5px",
                      paddingBottom: hasContent ? "10px" : "5px",
                    }}
                  >
                    {/* Left slot — episode card or excerpt */}
                    <div className="pr-5 flex items-center justify-end min-h-0">
                      {row.episode?.side === "left" && (
                        <EpisodeCard episode={row.episode.data} episodeIdx={row.episode.idx} />
                      )}
                      {excerptSide === "left" && excerptColor && (
                        <div
                          className="rounded-lg px-3 py-2 text-xs leading-relaxed w-full"
                          style={{
                            backgroundColor: excerptColor.bg,
                            color: excerptColor.text,
                            border: `1px solid ${excerptColor.border}`,
                          }}
                        >
                          {excerpt}
                        </div>
                      )}
                    </div>

                    {/* Dot — always on the spine */}
                    <div className="flex items-center justify-center">
                      <EntryDot
                        entry={row.entry}
                        focused={focused}
                        matchedEntryIds={matchedEntryIds}
                        onSelect={handleSelectEntry}
                        isSelected={selectedEntry?.id === row.entry.id}
                      />
                    </div>

                    {/* Right slot — episode card or excerpt */}
                    <div className="pl-5 flex items-center min-h-0">
                      {row.episode?.side === "right" && (
                        <EpisodeCard episode={row.episode.data} episodeIdx={row.episode.idx} />
                      )}
                      {excerptSide === "right" && excerptColor && (
                        <div
                          className="rounded-lg px-3 py-2 text-xs leading-relaxed w-full"
                          style={{
                            backgroundColor: excerptColor.bg,
                            color: excerptColor.text,
                            border: `1px solid ${excerptColor.border}`,
                          }}
                        >
                          {excerpt}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

            </div>
          </div>
        </div>

        {hasSidebar && (
          <div className="w-64 shrink-0 sticky top-24">
            <TraitsSidebar
              traits={traits}
              cautions={cautions}
              focused={focused}
              onFocus={setFocused}
            />
          </div>
        )}
      </div>

      <Sparkline entries={entries} />
    </div>
  );
}
