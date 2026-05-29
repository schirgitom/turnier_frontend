export enum MatchStatus {
  Scheduled = "Scheduled",
  InProgress = "InProgress",
  Completed = "Completed",
  Cancelled = "Cancelled",
}

export interface SetResult {
  setNumber: number;
  homeScore: number;
  awayScore: number;
}

export interface MatchScore {
  homePoints: number; // sets won by home
  awayPoints: number; // sets won by away
  // TODO: Backend should include sets array in match response
  sets?: SetResult[];
}

export interface MatchDto {
  id: string;
  tournamentId: string;
  round: number;
  matchNumber: string;
  status: MatchStatus;
  homeParticipantId: string;
  homeParticipantName: string | null;
  awayParticipantId: string;
  awayParticipantName: string | null;
  score: MatchScore | null;
  scheduledAt: string | null;
  // TODO: backend should include courtName in match response
  courtId: string | null;
  courtName: string | null;
  startedAt: string | null;
  completedAt: string | null;
  // TODO: backend should include phaseId in match response
  phaseId?: string | null;
  // TODO: backend should include groupId in match response
  groupId?: string | null;
}

export interface SetScore {
  homeScore: number;
  awayScore: number;
}

export interface RecordMatchResultRequest {
  setsToWinOverride?: number;
  sets: SetScore[];
}
