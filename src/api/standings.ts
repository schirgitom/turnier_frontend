import { apiClient } from "./client";
import type { StandingsDto } from "@/types/standings";

export async function getStandings(
  tournamentId: string,
  phaseId: string,
): Promise<StandingsDto> {
  const response = await apiClient.get<StandingsDto>(
    `/tournaments/${tournamentId}/phases/${phaseId}/standings`,
  );
  return response.data;
}
