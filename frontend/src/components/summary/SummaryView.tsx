"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelative } from "@/lib/utils";
import type { SummaryOut } from "@/types/api";
import { RefreshCw } from "lucide-react";
import { useState } from "react";

interface Props {
  subjectId: string;
}

export function SummaryView({ subjectId }: Props) {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data: summary, isLoading } = useQuery({
    queryKey: ["summary", subjectId],
    queryFn: () => api.get<SummaryOut>(`/subjects/${subjectId}/summary`),
    retry: false,
  });

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await api.post(`/subjects/${subjectId}/summary/refresh`, {});
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["summary", subjectId] });
        setRefreshing(false);
      }, 3000);
    } catch {
      setRefreshing(false);
    }
  }

  if (isLoading) return <p className="text-muted-foreground">Loading summary…</p>;

  if (!summary) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="mb-4">No summary yet. Log at least one entry first.</p>
        <Button onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Generate summary
        </Button>
      </div>
    );
  }

  const s = summary.structured_summary;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {summary.last_distilled_at && (
            <span>Updated {formatRelative(summary.last_distilled_at)} · v{summary.distillation_version}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {summary.distillation_status === "stale" && (
            <Badge variant="warning">Stale</Badge>
          )}
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {s && (
        <>
          {s.core_traits.length > 0 && (
            <section>
              <h3 className="text-base font-semibold mb-3">Core traits</h3>
              <div className="space-y-3">
                {s.core_traits.map((trait, i) => (
                  <Card key={i}>
                    <CardContent className="pt-4">
                      <p className="font-medium mb-1.5">{trait.trait}</p>
                      <ul className="space-y-1">
                        {trait.evidence.map((ev, j) => (
                          <li key={j} className="text-sm text-muted-foreground flex gap-2">
                            <span className="shrink-0">·</span>
                            <span>{ev}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {s.notable_episodes.length > 0 && (
            <section>
              <h3 className="text-base font-semibold mb-3">Notable episodes</h3>
              <div className="space-y-3">
                {s.notable_episodes.map((ep, i) => (
                  <Card key={i}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base">{ep.title}</CardTitle>
                        {ep.date_approx && (
                          <span className="text-xs text-muted-foreground shrink-0 ml-2">{ep.date_approx}</span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-2">{ep.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {ep.qualities_demonstrated.map((q, j) => (
                          <Badge key={j} variant="secondary" className="text-xs">{q}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {s.growth_arc && (
            <section>
              <h3 className="text-base font-semibold mb-2">Growth arc</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{s.growth_arc}</p>
            </section>
          )}

          {s.relationship_texture && (
            <section>
              <h3 className="text-base font-semibold mb-2">Relationship texture</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{s.relationship_texture}</p>
            </section>
          )}

          {s.cautions.length > 0 && (
            <section>
              <h3 className="text-base font-semibold mb-2 text-yellow-700">Cautions</h3>
              <ul className="space-y-1">
                {s.cautions.map((c, i) => (
                  <li key={i} className="text-sm text-yellow-700">· {c}</li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
