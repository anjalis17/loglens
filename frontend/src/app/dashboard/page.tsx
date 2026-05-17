"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelative } from "@/lib/utils";
import type { SubjectListItem } from "@/types/api";
import { Plus, LogOut } from "lucide-react";

function SummaryBadge({ status }: { status: SubjectListItem["summary_status"] }) {
  if (!status || status === "pending") return <Badge variant="outline">No summary</Badge>;
  if (status === "complete") return <Badge variant="success">Fresh</Badge>;
  if (status === "stale") return <Badge variant="warning">Stale</Badge>;
  return <Badge variant="destructive">Failed</Badge>;
}

export default function DashboardPage() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    if (!getToken()) router.replace("/login");
  }, [router]);

  const { data: subjects, isLoading } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => api.get<SubjectListItem[]>("/subjects"),
    enabled: !!getToken(),
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">LogLens</h1>
        <div className="flex items-center gap-3">
          <Link href="/subjects/new">
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" /> Add Subject
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={() => { logout(); router.push("/login"); }}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-2xl font-bold mb-6">Your subjects</h2>
        {isLoading && <p className="text-muted-foreground">Loading…</p>}
        {subjects?.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <p className="mb-4">No subjects yet.</p>
            <Link href="/subjects/new">
              <Button>Add your first subject</Button>
            </Link>
          </div>
        )}
        <div className="grid gap-4">
          {subjects?.map((s) => (
            <Link key={s.id} href={`/subjects/${s.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{s.full_name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {s.role_title ?? s.relationship_type}
                      </p>
                    </div>
                    <SummaryBadge status={s.summary_status} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{s.entry_count} {s.entry_count === 1 ? "entry" : "entries"}</span>
                    {s.last_entry_at && (
                      <span>Last: {formatRelative(s.last_entry_at)}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
