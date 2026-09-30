export type ParticipantType = "Single" | "Double" | "Team";

export interface SportRules {
  setsToWin: number;
  pointsToWinSet: number;
  pointsToWinFinalSet: number;
  minPointDifference: number;
  setsToWinMatch: number;
}

export interface SportDto {
  code: string;
  name: string;
  defaultRules: SportRules;
}

export enum TournamentStatus {
  Preparation = "Preparation",
  InProgress = "InProgress",
  Completed = "Completed",
  Cancelled = "Cancelled",
}

export interface TournamentDto {
  id: string;
  name: string;
  slug: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  status: TournamentStatus;
  organizationId: string;
  organizationName: string;
  participantCount: number;
  maxParticipants: number | null;
  minParticipants: number | null;
  /** Maximale Anzahl Starts (Karten) pro Person. Wird im Backend gespeichert. */
  maxStartsPerPerson: number;
  sportCode: string;
  formatType: string;
  participantType: ParticipantType;
  seeding: boolean;
  visibility: string;
  matchSetsToWinOverride: number | null;
  matchPointsToWinOverride?: number | null;
  sport?: SportDto;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTournamentRequest {
  name: string;
  slug: string;
  description?: string;
  location?: string;
  startDate: string;
  endDate: string;
  maxParticipants?: number;
  minParticipants?: number;
  /** Maximale Anzahl Starts pro Person (>= 1). Standard: 3. */
  maxStartsPerPerson?: number;
  sportCode: string;
  formatType: string;
  participantType: string;
  advancingPerGroup?: number;
  seeding: boolean;
  visibility: string;
  matchSetsToWinOverride?: number | null;
  matchPointsToWinOverride?: number | null;
}

export interface UpdateTournamentRequest {
  name?: string;
  description?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  maxParticipants?: number;
  minParticipants?: number;
  /** Maximale Anzahl Starts pro Person (>= 1). */
  maxStartsPerPerson?: number;
  visibility?: string;
  matchSetsToWinOverride?: number | null;
  matchPointsToWinOverride?: number | null;
}
