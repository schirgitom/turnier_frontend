import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  MapPin,
  Users,
  Trophy,
  Volleyball,
  CircleDot,
  Feather,
  Dumbbell,
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { getPublicTournamentList } from "@/api/public";
import type { PublicTournamentListItem } from "@/types/public";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_LABELS: Record<string, string> = {
  Preparation: "In Vorbereitung",
  InProgress: "Laufend",
  Completed: "Abgeschlossen",
  Cancelled: "Abgesagt",
};

const STATUS_CLASSES: Record<string, string> = {
  Preparation: "bg-[rgba(87,25,75,0.1)] text-[#57194B] border-transparent",
  InProgress: "bg-[#AF5574] text-white border-transparent",
  Completed: "bg-[#3FA97B] text-white border-transparent",
  Cancelled: "bg-[#D94E5F] text-white border-transparent",
};

function sportIcon(sportCode?: string) {
  switch (sportCode) {
    case "table_tennis":
      return Dumbbell;
    case "tennis":
      return CircleDot;
    case "badminton":
      return Feather;
    case "volleyball":
      return Volleyball;
    default:
      return Trophy;
  }
}

function TournamentCard({ tournament }: { tournament: PublicTournamentListItem }) {
  const Icon = sportIcon(tournament.sportCode);
  return (
    <Link to={`/public/${tournament.id}`}>
      <Card className="border-l-[3px] border-l-[#57194B] transition-shadow hover:bg-[rgba(87,25,75,0.03)] hover:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
              <CardTitle className="text-lg">{tournament.name}</CardTitle>
            </div>
            <Badge className={STATUS_CLASSES[tournament.status] ?? STATUS_CLASSES.Preparation}>
              {STATUS_LABELS[tournament.status] ?? tournament.status}
            </Badge>
          </div>
          {tournament.organizationName && (
            <CardDescription>{tournament.organizationName}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>
              {format(new Date(tournament.startDate), "dd. MMM yyyy", {
                locale: de,
              })}
            </span>
          </div>
          {tournament.location && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span>{tournament.location}</span>
            </div>
          )}
          {tournament.participantCount != null && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>{tournament.participantCount} Teilnehmer</span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function CardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-2/3" />
      </CardContent>
    </Card>
  );
}

function TournamentSection({
  title,
  status,
  pageSize,
}: {
  title: string;
  status: string;
  pageSize: number;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["public-tournaments", status],
    queryFn: () => getPublicTournamentList({ status, pageSize }),
    refetchInterval: 60000,
  });

  const tournaments = data?.items ?? [];

  return (
    <section>
      <h2 className="mb-4 text-xl font-semibold">{title}</h2>
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : tournaments.length === 0 ? (
        <p className="py-6 text-center text-muted-foreground">
          Keine Turniere vorhanden.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((t) => (
            <TournamentCard key={t.id} tournament={t} />
          ))}
        </div>
      )}
    </section>
  );
}

export function PublicHomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-12 text-center">
        <h1 className="text-3xl font-bold text-[#57194B]">
          Turniere live verfolgen
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Verfolge laufende Turniere, Ergebnisse und Tabellen in Echtzeit.
        </p>
      </div>

      <div className="space-y-12">
        <TournamentSection
          title="Laufende Turniere"
          status="InProgress"
          pageSize={12}
        />
        <TournamentSection
          title="Kürzlich abgeschlossen"
          status="Completed"
          pageSize={6}
        />
      </div>
    </div>
  );
}
