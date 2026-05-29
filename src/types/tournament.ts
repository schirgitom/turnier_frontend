export type ParticipantType = "Single" | "Double" | "Team";

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
  sportCode: string;
  formatType: string;
  participantType: ParticipantType;
  seeding: boolean;
  visibility: string;
  matchSetsToWinOverride: number | null;
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
  maxParticipants?: number | null;
  minParticipants?: number | null;
  sportCode: string;
  formatType: string;
  participantType: string;
  advancingPerGroup?: number;
  seeding: boolean;
  visibility: string;
  matchSetsToWinOverride?: number | null;
}

export interface UpdateTournamentRequest {
  name?: string;
  slug?: string;
  description?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  maxParticipants?: number | null;
  minParticipants?: number | null;
  sportCode?: string;
  formatType?: string;
  seeding?: boolean;
  visibility?: string;
  matchSetsToWinOverride?: number | null;
}
