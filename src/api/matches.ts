import { apiClient } from "./client";
import type { MatchDto, RecordMatchResultRequest } from "@/types/match";

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

export async function getMatches(
  tournamentId: string,
  round?: number,
): Promise<MatchDto[]> {
  const response = await apiClient.get<unknown>(
    `/tournaments/${tournamentId}/matches`,
    { params: round != null ? { round } : undefined },
  );
  return normalizeMatchesResponse(response.data);
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
  data: RecordMatchResultRequest,
): Promise<void> {
  await apiClient.post(
    `/tournaments/${tournamentId}/matches/${matchId}/result`,
    data,
  );
}
