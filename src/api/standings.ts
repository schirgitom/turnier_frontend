import { apiClient } from "./client";
import type { PhaseStandingsResponse } from "@/types/standings";

export async function getStandings(
  tournamentId: string,
  phaseId: string,
): Promise<PhaseStandingsResponse> {
  const response = await apiClient.get<PhaseStandingsResponse>(
    `/tournaments/${tournamentId}/phases/${phaseId}/standings`,
  );
  return response.data;
}

export async function recalculateStandings(
  tournamentId: string,
  phaseId: string,
): Promise<PhaseStandingsResponse> {
  const response = await apiClient.post<PhaseStandingsResponse>(
    `/tournaments/${tournamentId}/phases/${phaseId}/standings/recalculate`,
  );
  return response.data;
}
