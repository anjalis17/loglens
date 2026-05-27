"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SubjectOut } from "@/types/api";
import { ArrowLeft } from "lucide-react";

const RELATIONSHIP_TYPES = [
  "direct report",
  "student",
  "mentee",
  "colleague",
  "other",
];

export default function NewSubjectPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [relationshipType, setRelationshipType] = useState("direct report");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const subject = await api.post<SubjectOut>("/subjects", {
        full_name: fullName,
        role_title: roleTitle || null,
        relationship_type: relationshipType,
      });
      router.push(`/subjects/${subject.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create subject");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border/60 shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center gap-3">
          <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="w-px h-5 bg-border" />
          <span className="text-sm font-medium text-foreground">New subject</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-foreground mb-1">Add a subject</h1>
          <p className="text-sm text-muted-foreground">Someone you want to track observations for over time.</p>
        </div>

        <div className="bg-card rounded-xl border border-border/60 p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm font-medium">Full name</Label>
              <Input
                id="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
                required
                autoFocus
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role" className="text-sm font-medium">
                Role / title <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="role"
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                placeholder="Software Engineering Intern"
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rel" className="text-sm font-medium">Relationship</Label>
              <select
                id="rel"
                value={relationshipType}
                onChange={(e) => setRelationshipType(e.target.value)}
                className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
              >
                {RELATIONSHIP_TYPES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <Button type="submit" disabled={loading} className="h-10">
                {loading ? "Creating…" : "Create subject"}
              </Button>
              <Link href="/dashboard">
                <Button type="button" variant="outline" className="h-10">Cancel</Button>
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
