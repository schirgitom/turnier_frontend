import { apiClient } from "./client";
import type {
  AddPaschenPhaseRequest,
  AssignRandomPaschenRequest,
  AssignRandomPaschenResponse,
  PaschenPhaseResponse,
  PaschenFinalRankingResponse,
  RecordPaschenResultRequest,
} from "@/types/paschen";

const base = (tournamentId: string) => `/tournaments/${tournamentId}/paschen`;

export async function addPaschenPhase(
  tournamentId: string,
  data: AddPaschenPhaseRequest,
): Promise<PaschenPhaseResponse> {
  const response = await apiClient.post<PaschenPhaseResponse>(
    `${base(tournamentId)}/phases`,
    data,
  );
  return response.data;
}

export async function getPaschenPhase(
  tournamentId: string,
  phaseId: string,
): Promise<PaschenPhaseResponse> {
  const response = await apiClient.get<PaschenPhaseResponse>(
    `${base(tournamentId)}/phases/${phaseId}`,
  );
  return response.data;
}

/**
 * Baut die Bäume und besetzt Runde 1. Die Reihenfolge der IDs bestimmt die
 * Setzung – die Spieler werden reihum auf die Bäume verteilt.
 */
export async function generatePaschenPhase(
  tournamentId: string,
  phaseId: string,
  participantIds: string[],
): Promise<PaschenPhaseResponse> {
  const response = await apiClient.post<PaschenPhaseResponse>(
    `${base(tournamentId)}/phases/${phaseId}/generate`,
    { participantIds },
  );
  return response.data;
}

/**
 * Lost die Spieler zufällig auf die Bäume aus und besetzt Runde 1. Alternative
 * zu `generatePaschenPhase`, wenn nicht manuell gesetzt werden soll.
 *
 * Voraussetzung: Phase im Status "Pending" und noch ohne Bäume.
 *
 * @param data Optional. Leerer Body ({}) lost alle bestätigten Registrierungen
 *   mit serverseitig erzeugtem Seed aus. `participantIds` schränkt das Feld ein,
 *   `seed` macht die Auslosung reproduzierbar.
 * @returns Verwendeter Seed, ausgeloste Bäume und die vollständige Phase.
 */
export async function assignRandomPaschenPhase(
  tournamentId: string,
  phaseId: string,
  data: AssignRandomPaschenRequest = {},
): Promise<AssignRandomPaschenResponse> {
  const response = await apiClient.post<AssignRandomPaschenResponse>(
    `${base(tournamentId)}/phases/${phaseId}/assign-random`,
    data,
  );
  return response.data;
}

/** Erst möglich, wenn allBracketsComplete === true. */
export async function mergePaschenPhase(
  tournamentId: string,
  phaseId: string,
): Promise<PaschenPhaseResponse> {
  const response = await apiClient.post<PaschenPhaseResponse>(
    `${base(tournamentId)}/phases/${phaseId}/merge`,
  );
  return response.data;
}

export async function getPaschenRanking(
  tournamentId: string,
  phaseId: string,
  topN?: number,
): Promise<PaschenFinalRankingResponse> {
  const response = await apiClient.get<PaschenFinalRankingResponse>(
    `${base(tournamentId)}/phases/${phaseId}/ranking`,
    { params: topN != null ? { topN } : undefined },
  );
  return response.data;
}

/**
 * Erfasst das Ergebnis und liefert die komplette Phase zurück – ein
 * anschließendes Nachladen entfällt. Spielernamen sind bereits aufgelöst.
 */
export async function recordPaschenResult(
  tournamentId: string,
  matchId: string,
  data: RecordPaschenResultRequest,
): Promise<PaschenPhaseResponse> {
  const response = await apiClient.post<PaschenPhaseResponse>(
    `${base(tournamentId)}/matches/${matchId}/result`,
    data,
  );
  return response.data;
}
