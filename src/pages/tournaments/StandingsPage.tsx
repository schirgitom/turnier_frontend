import { useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { getPhases } from "@/api/phases";
import { getStandings } from "@/api/standings";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function StandingsPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();

  const { data, isLoading: phasesLoading } = useQuery({
    queryKey: ["phases", tournamentId],
    queryFn: () => getPhases(tournamentId!),
    enabled: !!tournamentId,
  });

  const phases = data?.phases ?? [];

  if (phasesLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (phases.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        Noch keine Phasen vorhanden.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Tabellen</h2>
      <Tabs defaultValue={phases[0]!.id}>
        <TabsList>
          {phases.map((phase) => (
            <TabsTrigger key={phase.id} value={phase.id}>
              {phase.name}
            </TabsTrigger>
          ))}
        </TabsList>
        {phases.map((phase) => (
          <TabsContent key={phase.id} value={phase.id}>
            <PhaseStandings
              tournamentId={tournamentId!}
              phaseId={phase.id}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function PhaseStandings({
  tournamentId,
  phaseId,
}: {
  tournamentId: string;
  phaseId: string;
}) {
  const { data: standings, isLoading } = useQuery({
    queryKey: ["standings", tournamentId, phaseId],
    queryFn: () => getStandings(tournamentId, phaseId),
  });

  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (!standings?.groups || standings.groups.length === 0) {
    return (
      <p className="py-4 text-center text-muted-foreground">
        Noch keine Tabellendaten vorhanden.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {standings.groups.map((group) => (
        <Card key={group.groupName}>
          <CardHeader>
            <CardTitle className="text-base">{group.groupName}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead className="text-center">Sp</TableHead>
                  <TableHead className="text-center">S</TableHead>
                  <TableHead className="text-center">U</TableHead>
                  <TableHead className="text-center">N</TableHead>
                  <TableHead className="text-center">Tore</TableHead>
                  <TableHead className="text-center">Diff</TableHead>
                  <TableHead className="text-center font-bold">Pkt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.entries.map((entry) => (
                  <TableRow key={entry.participantId}>
                    <TableCell className="font-medium">{entry.rank}</TableCell>
                    <TableCell className="font-medium">
                      {entry.participantName}
                    </TableCell>
                    <TableCell className="text-center">
                      {entry.played}
                    </TableCell>
                    <TableCell className="text-center">{entry.won}</TableCell>
                    <TableCell className="text-center">{entry.drawn}</TableCell>
                    <TableCell className="text-center">{entry.lost}</TableCell>
                    <TableCell className="text-center">
                      {entry.goalsFor}:{entry.goalsAgainst}
                    </TableCell>
                    <TableCell className="text-center">
                      {entry.goalDifference > 0
                        ? `+${entry.goalDifference}`
                        : entry.goalDifference}
                    </TableCell>
                    <TableCell className="text-center font-bold">
                      {entry.points}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
