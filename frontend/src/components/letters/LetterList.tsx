"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { LetterView } from "./LetterView";
import { LetterGenerateModal } from "./LetterGenerateModal";
import { Button } from "@/components/ui/button";
import type { LetterOut } from "@/types/api";
import { Plus } from "lucide-react";

interface Props {
  subjectId: string;
}

export function LetterList({ subjectId }: Props) {
  const [modalOpen, setModalOpen] = useState(false);

  const { data: letters, isLoading } = useQuery({
    queryKey: ["letters", subjectId],
    queryFn: () => api.get<LetterOut[]>(`/subjects/${subjectId}/letters`),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Recommendation letters</h3>
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> Generate new letter
        </Button>
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}

      {!isLoading && letters?.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="mb-4">No letters generated yet.</p>
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Generate first letter
          </Button>
        </div>
      )}

      {letters?.map((letter) => (
        <LetterView key={letter.id} letter={letter} />
      ))}

      <LetterGenerateModal
        subjectId={subjectId}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
