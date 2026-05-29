// Group phase match data

export interface GroupMatchDto {
  id: string;
  round: number;
  matchNumber: number;
  status: string;
  homeParticipantId: string | null;
  homeParticipantName: string | null;
  awayParticipantId: string | null;
  awayParticipantName: string | null;
  score: { homePoints: number; awayPoints: number } | null;
  scheduledAt: string | null;
}

export interface GroupMatchesResponse {
  groupId: string;
  groupName: string;
  matches: GroupMatchDto[];
}

// Elimination bracket data

export interface BracketMatchDto {
  matchId: string;
  matchNumber: number;
  homeParticipantId: string | null;
  homeParticipantName: string | null;
  awayParticipantId: string | null;
  awayParticipantName: string | null;
  score: { homePoints: number; awayPoints: number } | null;
  status: string;
  winnerId: string | null;
  isBye: boolean;
}

export interface BracketRound {
  roundNumber: number;
  roundName: string;
  matches: BracketMatchDto[];
}

export interface EliminationBracketResponse {
  phaseId: string;
  phaseName: string;
  rounds: BracketRound[];
  thirdPlaceMatch: BracketMatchDto | null;
  winner: { participantId: string; participantName: string } | null;
}

// Union and discriminator

export type PhaseMatchesResponse = GroupMatchesResponse[] | EliminationBracketResponse;

export function isEliminationBracket(
  r: PhaseMatchesResponse,
): r is EliminationBracketResponse {
  return "rounds" in r;
}
