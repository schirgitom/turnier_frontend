export enum MatchStatus {
  Scheduled = "Scheduled",
  InProgress = "InProgress",
  Completed = "Completed",
  Cancelled = "Cancelled",
}

export interface MatchDto {
  id: string;
  tournamentId: string;
  roundNumber: number;
  matchNumber: number;
  homeParticipantId: string | null;
  homeParticipantName: string | null;
  awayParticipantId: string | null;
  awayParticipantName: string | null;
  homePoints: number | null;
  awayPoints: number | null;
  status: MatchStatus;
  courtId: string | null;
  courtName: string | null;
  scheduledTime: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface SubmitResultRequest {
  homePoints: number;
  awayPoints: number;
}
