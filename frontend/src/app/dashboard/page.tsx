"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatRelative } from "@/lib/utils";
import type { SubjectListItem } from "@/types/api";
import { Plus, LogOut, Users, ChevronRight } from "lucide-react";

function SummaryBadge({ status }: { status: SubjectListItem["summary_status"] }) {
  if (!status || status === "pending") return <Badge variant="outline" className="text-xs">No summary</Badge>;
  if (status === "complete") return <Badge variant="success" className="text-xs">Fresh</Badge>;
  if (status === "stale") return <Badge variant="warning" className="text-xs">Stale</Badge>;
  return <Badge variant="destructive" className="text-xs">Failed</Badge>;
}

function InitialsAvatar({ name }: { name: string }) {
  const parts = name.trim().split(" ");
  const initials = parts.length >= 2
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`
    : name.slice(0, 2);
  return (
    <div className="w-10 h-10 rounded-full gradient-teal flex items-center justify-center shrink-0">
      <span className="text-sm font-semibold text-white uppercase">{initials}</span>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!getToken()) router.replace("/login");
  }, [router]);

  const { data: subjects, isLoading } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => api.get<SubjectListItem[]>("/subjects"),
    // Only enable after mount so server and client produce identical initial HTML.
    enabled: mounted && !!getToken(),
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border/60 px-6 py-0 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between h-14">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md gradient-teal flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-white" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="font-semibold text-foreground tracking-tight">LogLens</span>
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <span className="text-sm text-muted-foreground hidden sm:block mr-2">{user.email}</span>
            )}
            <Link href="/subjects/new">
              <Button size="sm" className="gap-1.5 h-8">
                <Plus className="w-3.5 h-3.5" /> Add Subject
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => { logout(); router.push("/login"); }}
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Your subjects</h1>
          <p className="text-muted-foreground mt-1 text-sm">People you&apos;re tracking observations for</p>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-card rounded-xl border border-border animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && subjects?.length === 0 && (
          <div className="text-center py-24">
            <div className="w-16 h-16 rounded-2xl gradient-teal-subtle mx-auto mb-4 flex items-center justify-center">
              <Users className="w-8 h-8 text-primary/60" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">No subjects yet</h3>
            <p className="text-muted-foreground text-sm mb-6">Add someone you&apos;d like to track observations for.</p>
            <Link href="/subjects/new">
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> Add your first subject
              </Button>
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {subjects?.map((s) => (
            <Link key={s.id} href={`/subjects/${s.id}`}>
              <div className="bg-card rounded-xl border border-border/60 hover:border-primary/30 hover:shadow-md transition-all duration-200 cursor-pointer group p-5">
                <div className="flex items-center gap-4">
                  <InitialsAvatar name={s.full_name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                          {s.full_name}
                        </p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {s.role_title ?? s.relationship_type}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <SummaryBadge status={s.summary_status} />
                        <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary/60 transition-colors" />
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2.5 text-xs text-muted-foreground">
                      <span className="font-medium">{s.entry_count} {s.entry_count === 1 ? "entry" : "entries"}</span>
                      {s.last_entry_at && (
                        <span>Last logged {formatRelative(s.last_entry_at)}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
