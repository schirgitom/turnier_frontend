import { apiClient } from "./client";
import type {
  PublicTournamentDto,
  ScheduleBoardDto,
  PublicStandingsDto,
  PublicBracketDto,
} from "@/types/display";
import type { MatchDto } from "@/types/match";

export async function getPublicTournament(
  tournamentId: string,
): Promise<PublicTournamentDto> {
  const response = await apiClient.get<PublicTournamentDto>(
    `/display/${tournamentId}`,
  );
  return response.data;
}

export async function getPublicSchedule(
  tournamentId: string,
): Promise<ScheduleBoardDto> {
  const response = await apiClient.get<ScheduleBoardDto>(
    `/display/${tournamentId}/schedule`,
  );
  return response.data;
}

export async function getPublicStandings(
  tournamentId: string,
): Promise<PublicStandingsDto> {
  const response = await apiClient.get<PublicStandingsDto>(
    `/display/${tournamentId}/standings`,
  );
  return response.data;
}

export async function getPublicBracket(
  tournamentId: string,
): Promise<PublicBracketDto> {
  const response = await apiClient.get<PublicBracketDto>(
    `/display/${tournamentId}/bracket`,
  );
  return response.data;
}

export async function getPublicMatches(
  tournamentId: string,
): Promise<MatchDto[]> {
  const response = await apiClient.get<MatchDto[]>(
    `/display/${tournamentId}/matches`,
  );
  return response.data;
}
