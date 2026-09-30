import { Medal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PaschenFinalRankingResponse } from "@/types/paschen";

const MEDAL_COLORS: Record<number, string> = {
  1: "text-[#FCB45A]",
  2: "text-[#B6B6B6]",
  3: "text-[#C08457]",
};

export function PaschenRankingTable({
  data,
  isLoading,
}: {
  data: PaschenFinalRankingResponse | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (!data || data.entries.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        Noch keine Platzierungen vorhanden.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant={data.isComplete ? "default" : "outline"}>
          {data.isComplete ? "Endstand" : "Zwischenstand"}
        </Badge>
        <span className="text-xs text-muted-foreground">
          Beste {data.rankingSize} – weniger Punkte = besser
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-14">Platz</TableHead>
            <TableHead>Teilnehmer</TableHead>
            <TableHead>Erreicht</TableHead>
            <TableHead className="text-right">Punkte</TableHead>
            <TableHead className="text-right">Spiele</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.entries.map((entry) => (
            <TableRow key={entry.participantId}>
              <TableCell className="font-semibold tabular-nums">
                <span className="flex items-center gap-1">
                  {MEDAL_COLORS[entry.rank] && (
                    <Medal
                      className={cn("h-3.5 w-3.5", MEDAL_COLORS[entry.rank])}
                    />
                  )}
                  {entry.rank}
                </span>
              </TableCell>
              <TableCell className="font-medium">
                {entry.participantName}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {entry.stageLabel}
              </TableCell>
              <TableCell className="text-right font-bold tabular-nums">
                {entry.totalPoints}
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {entry.matchesPlayed}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

