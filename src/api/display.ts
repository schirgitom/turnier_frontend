import { publicApiClient } from "./client";
import type { PublicTournamentDto } from "@/types/display";
import type { MatchDto } from "@/types/match";
import type { PhaseStandingsResponse } from "@/types/standings";

function normalizeMatchesResponse(data: unknown): MatchDto[] {
  if (Array.isArray(data)) return data as MatchDto[];

  if (data && typeof data === "object") {
    const obj = data as {
      items?: unknown;
      matches?: unknown;
      data?: unknown;
    };

    if (Array.isArray(obj.items)) return obj.items as MatchDto[];
    if (Array.isArray(obj.matches)) return obj.matches as MatchDto[];
    if (Array.isArray(obj.data)) return obj.data as MatchDto[];
  }

  return [];
}

export async function getPublicTournament(
  tournamentId: string,
): Promise<PublicTournamentDto> {
  const response = await publicApiClient.get<PublicTournamentDto>(
    `/public/tournaments/${tournamentId}`,
  );
  return response.data;
}

export async function getPublicMatches(
  tournamentId: string,
): Promise<MatchDto[]> {
  const response = await publicApiClient.get<unknown>(
    `/public/tournaments/${tournamentId}/matches`,
  );
  return normalizeMatchesResponse(response.data);
}

export async function getPublicStandings(
  tournamentId: string,
  phaseId: string,
): Promise<PhaseStandingsResponse> {
  const response = await publicApiClient.get<PhaseStandingsResponse>(
    `/public/tournaments/${tournamentId}/phases/${phaseId}/standings`,
  );
  return response.data;
}
