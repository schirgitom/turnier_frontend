import { apiClient } from "./client";
import type { MatchDto, SubmitResultRequest } from "@/types/match";

export async function getMatches(
  tournamentId: string,
  round?: number,
): Promise<MatchDto[]> {
  const response = await apiClient.get<MatchDto[]>(
    `/tournaments/${tournamentId}/matches`,
    { params: round != null ? { round } : undefined },
  );
  return response.data;
}

export async function startMatch(
  tournamentId: string,
  matchId: string,
): Promise<void> {
  await apiClient.post(
    `/tournaments/${tournamentId}/matches/${matchId}/start`,
  );
}

export async function submitResult(
  tournamentId: string,
  matchId: string,
  data: SubmitResultRequest,
): Promise<void> {
  await apiClient.post(
    `/tournaments/${tournamentId}/matches/${matchId}/result`,
    data,
  );
}
