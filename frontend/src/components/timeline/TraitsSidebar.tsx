"use client";

import type { CoreTrait, CautionItem } from "@/types/api";
import { AlertTriangle } from "lucide-react";

export const TRAIT_COLORS = [
  { dot: "#7c3aed", ring: "rgba(124,58,237,0.18)",  bg: "#f5f3ff", border: "#c4b5fd", text: "#6d28d9" }, // violet
  { dot: "#db2777", ring: "rgba(219,39,119,0.18)",  bg: "#fdf2f8", border: "#f9a8d4", text: "#be185d" }, // rose
  { dot: "#2563eb", ring: "rgba(37,99,235,0.18)",   bg: "#eff6ff", border: "#93c5fd", text: "#1d4ed8" }, // blue
  { dot: "#16a34a", ring: "rgba(22,163,74,0.18)",   bg: "#f0fdf4", border: "#86efac", text: "#15803d" }, // green
  { dot: "#dc2626", ring: "rgba(220,38,38,0.18)",   bg: "#fef2f2", border: "#fca5a5", text: "#b91c1c" }, // red
  { dot: "#4f46e5", ring: "rgba(79,70,229,0.18)",   bg: "#eef2ff", border: "#a5b4fc", text: "#4338ca" }, // indigo
  { dot: "#a21caf", ring: "rgba(162,28,175,0.18)",  bg: "#fdf4ff", border: "#e879f9", text: "#86198f" }, // fuchsia
];

export const CAUTION_COLOR = {
  dot: "#d97706", ring: "rgba(217,119,6,0.20)", bg: "#fffbeb", border: "#fcd34d", text: "#92400e",
};

export type FocusedItem =
  | { kind: "trait"; idx: number }
  | { kind: "caution"; idx: number }
  | null;

interface Props {
  traits: CoreTrait[];
  cautions: CautionItem[];
  focused: FocusedItem;
  onFocus: (item: FocusedItem) => void;
}

export function TraitsSidebar({ traits, cautions, focused, onFocus }: Props) {
  function toggleTrait(i: number) {
    onFocus(focused?.kind === "trait" && focused.idx === i ? null : { kind: "trait", idx: i });
  }
  function toggleCaution(i: number) {
    onFocus(focused?.kind === "caution" && focused.idx === i ? null : { kind: "caution", idx: i });
  }

  return (
    <div className="space-y-6">
      {traits.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Core Traits
          </p>
          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
            Click a trait to highlight supporting entries.
          </p>
          <div className="space-y-2.5">
            {traits.map((trait, i) => {
              const color    = TRAIT_COLORS[i % TRAIT_COLORS.length];
              const isActive = focused?.kind === "trait" && focused.idx === i;
              return (
                <button
                  key={i}
                  onClick={() => toggleTrait(i)}
                  className="w-full text-left rounded-xl transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  style={{
                    border: `1px solid ${isActive ? color.border : "hsl(var(--border) / 0.6)"}`,
                    borderLeft: `3px solid ${color.dot}`,
                    backgroundColor: isActive ? color.bg : "hsl(var(--card))",
                    boxShadow: isActive ? `0 0 0 1px ${color.ring}, 0 1px 4px 0 ${color.ring}` : "none",
                  }}
                >
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color.dot }} />
                      <p
                        className="text-sm font-semibold leading-tight flex-1"
                        style={{ color: isActive ? color.text : "hsl(var(--foreground))" }}
                      >
                        {trait.trait}
                      </p>
                      {isActive && (
                        <span
                          className="text-xs font-semibold px-1.5 py-0.5 rounded-full leading-none"
                          style={{ backgroundColor: color.dot, color: "#fff" }}
                        >
                          active
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {trait.evidence.slice(0, 2).map((ev, j) => (
                        <div key={j} className="flex gap-1.5">
                          <span className="shrink-0 mt-0.5 text-xs" style={{ color: color.dot }}>·</span>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {typeof ev === "string" ? ev : ev.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {cautions.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
              Cautions
            </p>
          </div>
          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
            Click a caution to highlight related entries.
          </p>
          <div className="space-y-2.5">
            {cautions.map((c, i) => {
              const isActive = focused?.kind === "caution" && focused.idx === i;
              return (
                <button
                  key={i}
                  onClick={() => toggleCaution(i)}
                  className="w-full text-left rounded-xl transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  style={{
                    border: `1px solid ${isActive ? CAUTION_COLOR.border : "hsl(var(--border) / 0.6)"}`,
                    borderLeft: `3px solid ${CAUTION_COLOR.dot}`,
                    backgroundColor: isActive ? CAUTION_COLOR.bg : "hsl(var(--card))",
                    boxShadow: isActive
                      ? `0 0 0 1px ${CAUTION_COLOR.ring}, 0 1px 4px 0 ${CAUTION_COLOR.ring}`
                      : "none",
                  }}
                >
                  <div className="p-3.5 flex items-start justify-between gap-2">
                    <p
                      className="text-xs leading-relaxed"
                      style={{ color: isActive ? CAUTION_COLOR.text : "#92400e" }}
                    >
                      {typeof c === "string" ? c : c.text}
                    </p>
                    {isActive && (
                      <span
                        className="text-xs font-semibold px-1.5 py-0.5 rounded-full leading-none shrink-0 mt-0.5"
                        style={{ backgroundColor: CAUTION_COLOR.dot, color: "#fff" }}
                      >
                        active
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
