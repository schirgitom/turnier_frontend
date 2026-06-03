import { publicApiClient } from "./client";
import type { PublicTournamentDto } from "@/types/display";
import type { MatchDto } from "@/types/match";
import type { PhaseStandingsResponse } from "@/types/standings";

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
  const response = await publicApiClient.get<MatchDto[]>(
    `/public/tournaments/${tournamentId}/matches`,
  );
  return response.data;
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
