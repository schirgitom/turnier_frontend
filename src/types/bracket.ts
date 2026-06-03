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
  score: {
    homePoints: number;
    awayPoints: number;
    sets?: {
      setNumber: number;
      homeScore: number;
      awayScore: number;
    }[];
  } | null;
  scheduledAt: string | null;
}

export interface GroupMatchesResponse {
  groupId: string;
  groupName: string;
  matches: GroupMatchDto[];
}

// Elimination bracket data

export interface BracketMatchDto {
  // Optional set-level details if backend provides them.
  // Used for richer display output (e.g. 11:8 | 8:11 | Gesamt 2:1).
  sets?: {
    setNumber: number;
    homeScore: number;
    awayScore: number;
  }[];
  matchId: string;
  matchNumber: number;
  homeParticipantId: string | null;
  homeParticipantName: string | null;
  awayParticipantId: string | null;
  awayParticipantName: string | null;
  score: {
    homePoints: number;
    awayPoints: number;
    sets?: {
      setNumber: number;
      homeScore: number;
      awayScore: number;
    }[];
  } | null;
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
