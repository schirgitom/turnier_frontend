// Paschen: K.O.-Format mit 4-Spieler-Partien in mehreren parallelen Bäumen,
// die am Ende zu einem Finalbaum verschmelzen.
// ⚠️ Zentrale Umkehrung gegenüber Tischtennis: WENIGER Punkte = besser.

export const PASCHEN_RULE_DEFAULTS = {
  treeCount: 4,
  maxPlayers: 256,
  playersPerMatch: 4,
  advancersPerMatch: 2,
  eliminationScore: 7,
  finalRankingSize: 8,
} as const;

export interface PaschenRules {
  treeCount: number;
  maxPlayers: number;
  playersPerMatch: number;
  advancersPerMatch: number;
  eliminationScore: number;
  finalRankingSize: number;
}

export interface AddPaschenPhaseRequest {
  name: string;
  phaseOrder: number;
  participantCount: number;
  /** Optional – weggelassen gelten die Backend-Defaults. */
  rules?: PaschenRules;
}

export interface GeneratePaschenMatchesRequest {
  /** Reihenfolge bestimmt die Setzung, Spieler werden reihum auf die Bäume verteilt. */
  participantIds: string[];
}

/**
 * Zufällige Auslosung der Spieler auf die Bäume. Alle Felder optional:
 * ein leerer Body ({}) lost alle bestätigten Registrierungen mit einem
 * serverseitig erzeugten Seed aus.
 */
export interface AssignRandomPaschenRequest {
  /**
   * Nur diese Teilnehmer auslosen. null/leer → alle bestätigten
   * Registrierungen. Jede ID darf nur einmal vorkommen.
   */
  participantIds?: string[] | null;
  /**
   * Zufallsseed für Nachvollziehbarkeit. null → Server generiert einen.
   * Gleicher Seed + gleiche Teilnehmer ⇒ identische Reihenfolge.
   */
  seed?: number | null;
}

/** Ein ausgeloster Baum mit den Spielern in Slot-Reihenfolge. */
export interface PaschenAssignedTree {
  bracketId: string;
  bracketIndex: number;
  /** Spieler in Slot-Reihenfolge (Runde 1, Match 1, Slot 1 …). */
  participantIds: string[];
}

export interface AssignRandomPaschenResponse {
  /** Der tatsächlich verwendete Seed – für Protokoll/Wiederholung speichern. */
  seed: number;
  trees: PaschenAssignedTree[];
  /** Vollständiges Phasen-Objekt inkl. aller Bäume und Matches. */
  phase: PaschenPhaseResponse;
}

export interface PaschenPlayerScoreRequest {
  participantId: string;
  points: number;
}

export interface RecordPaschenResultRequest {
  playerScores: PaschenPlayerScoreRequest[];
}

export type PaschenMatchStatus =
  | "Scheduled"
  | "InProgress"
  | "Completed"
  | "Bye"
  | "Cancelled"
  | "Walkover";

export interface PaschenMatchPlayer {
  slotPosition: number;
  /** null = noch unbesetzter Slot (spätere Runde oder Freilos). */
  participantId: string | null;
  participantName: string | null;
  /** null solange kein Ergebnis erfasst ist. */
  points: number | null;
  /** null solange kein Ergebnis erfasst ist. */
  advances: boolean | null;
}

/**
 * Paschen-Variante des MatchDto. Das Backend hängt `players` und `bracketId`
 * optional ans bestehende MatchDto an – für Paschen immer `players` rendern,
 * niemals home/away (die spiegeln nur Slot 1 und 2 für den Zeitplaner).
 */
export interface PaschenMatchDto {
  id: string;
  round: number;
  matchNumber: number;
  status: PaschenMatchStatus;
  matchCode: string;
  bracketId: string | null;
  players: PaschenMatchPlayer[];
  /** Bei Paschen immer null – es gibt keine Sätze. */
  score: null;
  homeParticipantId: string | null;
  awayParticipantId: string | null;
  scheduledAt?: string | null;
  courtId?: string | null;
  courtName?: string | null;
}

export interface PaschenFinalist {
  participantId: string;
  participantName: string;
}

export interface PaschenBracketDto {
  id: string;
  bracketIndex: number;
  startingPlayerCount: number;
  rounds: number;
  isComplete: boolean;
  finalists: PaschenFinalist[];
  matches: PaschenMatchDto[];
}

export type PaschenPhaseStatus = "Pending" | "InProgress" | "Completed";

export interface PaschenPhaseResponse {
  id: string;
  tournamentId: string;
  name: string;
  phaseOrder: number;
  status: PaschenPhaseStatus;
  participantCount: number;
  treeCount: number;
  playersPerMatch: number;
  advancersPerMatch: number;
  eliminationScore: number;
  finalRankingSize: number;
  isMerged: boolean;
  allBracketsComplete: boolean;
  brackets: PaschenBracketDto[];
  /** Leer bis zum Merge. */
  finalMatches: PaschenMatchDto[];
}

/**
 * Schlanke Variante aus GET /tournaments/{id}/phases – ohne matches.
 */
export interface PaschenPhaseSummaryResponse {
  id: string;
  name: string;
  phaseOrder: number;
  status: string;
  participantCount: number;
  treeCount: number;
  bracketCount: number;
  isMerged: boolean;
  allBracketsComplete: boolean;
  playersPerMatch?: number;
  advancersPerMatch?: number;
  eliminationScore?: number;
  finalRankingSize?: number;
  totalMatches?: number;
  completedMatches?: number;
}

export interface PaschenRankingEntry {
  /** Durchgehend 1..N, keine geteilten Plätze. */
  rank: number;
  participantId: string;
  participantName: string;
  /** Bereits auf Deutsch formatiert: "Sieger", "Finale", "Finalrunde {n}", "Baum-Runde {n}". */
  stageLabel: string;
  totalPoints: number;
  matchesPlayed: number;
}

export interface PaschenFinalRankingResponse {
  phaseId: string;
  phaseName: string;
  rankingSize: number;
  /** false = Zwischenstand, die Tabelle ist jederzeit abrufbar. */
  isComplete: boolean;
  entries: PaschenRankingEntry[];
}

/** Erkennt Paschen-Matches in der flachen /matches-Liste (players ist null bei Tischtennis). */
export function isPaschenMatch(match: { players?: unknown }): boolean {
  return Array.isArray(match.players);
}

/** Slots, die tatsächlich mit einem Spieler besetzt sind. */
export function assignedPlayers(match: PaschenMatchDto): PaschenMatchPlayer[] {
  return match.players.filter((p) => p.participantId !== null);
}

/** Ein Ergebnis ist erfasst, sobald mindestens ein Spieler Punkte hat. */
export function hasResult(match: PaschenMatchDto): boolean {
  return match.players.some((p) => p.points !== null);
}

/** Spieler aufsteigend nach Punkten (bestes Ergebnis zuerst), sonst nach Slot. */
export function orderedPlayers(match: PaschenMatchDto): PaschenMatchPlayer[] {
  const players = assignedPlayers(match);
  if (!hasResult(match)) {
    return players.sort((a, b) => a.slotPosition - b.slotPosition);
  }
  return players.sort((a, b) => (a.points ?? 0) - (b.points ?? 0));
}

/** Zählt als erledigt – Freilose bleiben sonst optisch für immer offen. */
export function isMatchDone(match: PaschenMatchDto): boolean {
  return (
    match.status === "Completed" ||
    match.status === "Bye" ||
    match.status === "Walkover"
  );
}

export interface RoundProgress {
  round: number;
  total: number;
  done: number;
  isComplete: boolean;
}

/**
 * Fortschritt pro Runde. Die Aufsteiger rücken erst nach, wenn das letzte
 * Spiel der Runde erfasst ist – ohne diese Anzeige wirkt das wie ein Bug.
 */
export function roundProgress(matches: PaschenMatchDto[]): RoundProgress[] {
  const byRound = new Map<number, PaschenMatchDto[]>();
  for (const match of matches) {
    const bucket = byRound.get(match.round);
    if (bucket) bucket.push(match);
    else byRound.set(match.round, [match]);
  }

  return [...byRound.entries()]
    .sort(([a], [b]) => a - b)
    .map(([round, roundMatches]) => {
      const done = roundMatches.filter(isMatchDone).length;
      return {
        round,
        total: roundMatches.length,
        done,
        isComplete: done === roundMatches.length,
      };
    });
}

/**
 * Prüft die Fachregeln schon im Formular, damit der Organisator keinen
 * 400er kassiert. Gibt null zurück, wenn alles in Ordnung ist.
 */
export function validatePaschenScores(
  scores: PaschenPlayerScoreRequest[],
  advancersPerMatch: number,
  eliminationScore: number,
): string | null {
  if (scores.length === 0) {
    return "Es sind keine Spieler zugewiesen.";
  }

  for (const score of scores) {
    if (!Number.isInteger(score.points)) {
      return "Punkte müssen ganze Zahlen sein.";
    }
    if (score.points < 0 || score.points > eliminationScore) {
      return `Punkte müssen zwischen 0 und ${eliminationScore} liegen.`;
    }
  }

  const uniqueIds = new Set(scores.map((s) => s.participantId));
  if (uniqueIds.size !== scores.length) {
    return "Ein Spieler wurde doppelt eingetragen.";
  }

  // Gleichstand genau an der Aufstiegsgrenze ist verboten – dann ist unklar,
  // wer aufsteigt, und es muss ein Stechen gespielt werden.
  const sorted = [...scores].sort((a, b) => a.points - b.points);
  const lastAdvancing = sorted[advancersPerMatch - 1];
  const firstEliminated = sorted[advancersPerMatch];
  if (
    lastAdvancing &&
    firstEliminated &&
    lastAdvancing.points === firstEliminated.points
  ) {
    return (
      `Gleichstand mit ${lastAdvancing.points} Punkten an der Aufstiegsgrenze. ` +
      `Es muss ein Stechen gespielt werden, bevor das Ergebnis erfasst werden kann.`
    );
  }

  return null;
}

