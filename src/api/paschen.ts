import { apiClient } from "./client";
import type {
  AddPaschenPhaseRequest,
  AssignPaschenParticipantRandomlyRequest,
  AssignRandomPaschenRequest,
  AssignRandomPaschenResponse,
  FinalizePaschenDrawRequest,
  FinalizePaschenDrawResponse,
  InitializePaschenBracketsResponse,
  PaschenFinalist,
  PaschenPhaseResponse,
  PaschenFinalRankingResponse,
  PaschenSingleAssignmentResponse,
  RecordPaschenResultRequest,
} from "@/types/paschen";

const base = (tournamentId: string) => `/tournaments/${tournamentId}/paschen`;

/**
 * Laut Swagger sind `finalists` reine UUIDs, ältere Backends liefern Objekte
 * mit Namen. Außerdem können `players`/`matches` null sein (leere Struktur
 * nach `brackets/initialize`). Wir bringen alles auf eine einheitliche Form.
 */
function normalizeFinalist(value: unknown): PaschenFinalist | null {
  if (typeof value === "string") {
    return { participantId: value, participantName: "" };
  }
  if (value && typeof value === "object") {
    const obj = value as { participantId?: unknown; participantName?: unknown };
    if (typeof obj.participantId === "string") {
      return {
        participantId: obj.participantId,
        participantName:
          typeof obj.participantName === "string" ? obj.participantName : "",
      };
    }
  }
  return null;
}

export function normalizePaschenPhase(
  phase: PaschenPhaseResponse,
): PaschenPhaseResponse {
  const normalizeMatches = (matches: PaschenPhaseResponse["finalMatches"] | null | undefined) =>
    (matches ?? []).map((match) => ({ ...match, players: match.players ?? [] }));

  return {
    ...phase,
    brackets: (phase.brackets ?? []).map((bracket) => ({
      ...bracket,
      finalists: ((bracket.finalists ?? []) as unknown[])
        .map(normalizeFinalist)
        .filter((f): f is PaschenFinalist => f !== null),
      matches: normalizeMatches(bracket.matches),
    })),
    finalMatches: normalizeMatches(phase.finalMatches),
  };
}

export async function addPaschenPhase(
  tournamentId: string,
  data: AddPaschenPhaseRequest,
): Promise<PaschenPhaseResponse> {
  const response = await apiClient.post<PaschenPhaseResponse>(
    `${base(tournamentId)}/phases`,
    data,
  );
  return normalizePaschenPhase(response.data);
}

export async function getPaschenPhase(
  tournamentId: string,
  phaseId: string,
): Promise<PaschenPhaseResponse> {
  const response = await apiClient.get<PaschenPhaseResponse>(
    `${base(tournamentId)}/phases/${phaseId}`,
  );
  return normalizePaschenPhase(response.data);
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
  return normalizePaschenPhase(response.data);
}

/**
 * Legacy-Einmal-Auslosung: lost alle (bzw. die angegebenen) bestätigten Starts
 * aus und legt dabei die komplette Baumstruktur an.
 *
 * Voraussetzung: Phase im Status "Pending" und noch ohne Bäume. Für den
 * gestaffelten Ablauf stattdessen `initializePaschenBrackets` +
 * `assignPaschenParticipantRandomly` verwenden.
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
  return { ...response.data, phase: normalizePaschenPhase(response.data.phase) };
}

/**
 * Legt die leere Baum-/Runden-/Match-/Slot-Struktur an, ohne Spieler zu
 * verteilen. Idempotent: `created === false`, wenn die Struktur schon existierte.
 */
export async function initializePaschenBrackets(
  tournamentId: string,
  phaseId: string,
): Promise<InitializePaschenBracketsResponse> {
  const response = await apiClient.post<InitializePaschenBracketsResponse>(
    `${base(tournamentId)}/phases/${phaseId}/brackets/initialize`,
    {},
  );
  return { ...response.data, phase: normalizePaschenPhase(response.data.phase) };
}

/**
 * Lost genau einen Start zufällig in einen freien Slot eines passenden Baums.
 * Mehrere Starts derselben Person landen immer in unterschiedlichen Bäumen.
 * 409 bei: Phase nicht "Pending", Bäume nicht initialisiert, Start bereits
 * ausgelost, Phase voll, Start nicht "Confirmed" oder kein passender Baum frei.
 */
export async function assignPaschenParticipantRandomly(
  tournamentId: string,
  phaseId: string,
  participantId: string,
  data: AssignPaschenParticipantRandomlyRequest = {},
): Promise<PaschenSingleAssignmentResponse> {
  const response = await apiClient.post<PaschenSingleAssignmentResponse>(
    `${base(tournamentId)}/phases/${phaseId}/participants/${participantId}/assign-random`,
    data,
  );
  return { ...response.data, phase: normalizePaschenPhase(response.data.phase) };
}

/**
 * Schließt die Auslosung ab: Phase wechselt auf "InProgress", danach ist keine
 * Auslosung mehr möglich. 409 bei: Phase nicht "Pending", keine Bäume, Match
 * bereits begonnen, Baum ohne Spieler oder Turnier weder in Vorbereitung noch laufend.
 */
export async function finalizePaschenDraw(
  tournamentId: string,
  phaseId: string,
  data: FinalizePaschenDrawRequest = {},
): Promise<FinalizePaschenDrawResponse> {
  const response = await apiClient.post<FinalizePaschenDrawResponse>(
    `${base(tournamentId)}/phases/${phaseId}/draw/finalize`,
    data,
  );
  return { ...response.data, phase: normalizePaschenPhase(response.data.phase) };
}

/** Erst möglich, wenn allBracketsComplete === true. */
export async function mergePaschenPhase(
  tournamentId: string,
  phaseId: string,
): Promise<PaschenPhaseResponse> {
  const response = await apiClient.post<PaschenPhaseResponse>(
    `${base(tournamentId)}/phases/${phaseId}/merge`,
  );
  return normalizePaschenPhase(response.data);
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
  return normalizePaschenPhase(response.data);
}
