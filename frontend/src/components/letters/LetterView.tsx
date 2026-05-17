"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import type { LetterOut } from "@/types/api";
import { ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  letter: LetterOut;
}

export function LetterView({ letter }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-medium text-sm">{letter.purpose}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs capitalize">{letter.tone}</Badge>
              <span className="text-xs text-muted-foreground">{formatDate(letter.created_at)}</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>
      {expanded && letter.letter_text && (
        <CardContent>
          <pre className="text-sm leading-relaxed whitespace-pre-wrap font-serif">{letter.letter_text}</pre>
        </CardContent>
      )}
    </Card>
  );
}
