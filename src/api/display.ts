import { anonymousApiClient, publicApiClient } from "./client";
import { normalizePaschenPhase } from "./paschen";
import type { PublicTournamentDto } from "@/types/display";
import type { MatchDto } from "@/types/match";
import type { PhaseStandingsResponse } from "@/types/standings";
import type {
  PaschenFinalRankingResponse,
  PaschenPhaseResponse,
} from "@/types/paschen";

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

/** Paschen-Phase mit Bäumen und Spielernamen – anonym, für Beamer/Info-Seite. */
export async function getDisplayPaschenPhase(
  tournamentId: string,
  phaseId: string,
): Promise<PaschenPhaseResponse> {
  const response = await anonymousApiClient.get<PaschenPhaseResponse>(
    `/tournaments/${tournamentId}/paschen/phases/${phaseId}`,
  );
  return normalizePaschenPhase(response.data);
}

export async function getDisplayPaschenRanking(
  tournamentId: string,
  phaseId: string,
): Promise<PaschenFinalRankingResponse> {
  const response = await anonymousApiClient.get<PaschenFinalRankingResponse>(
    `/tournaments/${tournamentId}/paschen/phases/${phaseId}/ranking`,
  );
  return response.data;
}
