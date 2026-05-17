"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <header className="border-b px-6 py-4">
        <Link href="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </Link>
      </header>
      <main className="max-w-lg mx-auto px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Add a subject</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" required autoFocus />
              </div>
              <div className="space-y-1">
                <Label htmlFor="role">Role / title</Label>
                <Input id="role" value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} placeholder="Software Engineering Intern" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rel">Relationship</Label>
                <select
                  id="rel"
                  value={relationshipType}
                  onChange={(e) => setRelationshipType(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {RELATIONSHIP_TYPES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-3">
                <Button type="submit" disabled={loading}>
                  {loading ? "Creating…" : "Create subject"}
                </Button>
                <Link href="/dashboard">
                  <Button type="button" variant="outline">Cancel</Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
