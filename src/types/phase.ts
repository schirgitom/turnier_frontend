export enum PhaseType {
  Group = "Group",
  SingleElimination = "SingleElimination",
  DoubleElimination = "DoubleElimination",
  Swiss = "Swiss",
  RoundRobin = "RoundRobin",
}

export interface PhaseDto {
  id: string;
  tournamentId: string;
  name: string;
  type: PhaseType;
  order: number;
  config: GroupPhaseConfig | EliminationPhaseConfig;
  createdAt: string;
}

export interface GroupPhaseConfig {
  type: "Group";
  groupCount: number;
  teamsPerGroup: number;
  advancingPerGroup: number;
  pointsForWin: number;
  pointsForDraw: number;
  pointsForLoss: number;
}

export interface EliminationPhaseConfig {
  type: "SingleElimination" | "DoubleElimination";
  thirdPlaceMatch: boolean;
}

export interface CreatePhaseRequest {
  name: string;
  type: PhaseType;
  order: number;
  config: Record<string, unknown>;
}

export interface UpdatePhaseRequest {
  name?: string;
  order?: number;
  config?: Record<string, unknown>;
}
