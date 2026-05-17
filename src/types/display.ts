import type { MatchDto } from "./match";
import type { GroupStandingsDto } from "./standings";

export interface PublicTournamentDto {
  id: string;
  name: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  status: string;
}

export interface ScheduleBoardDto {
  courts: ScheduleCourtDto[];
  timeSlots: string[];
}

export interface ScheduleCourtDto {
  courtId: string;
  courtName: string;
  matches: MatchDto[];
}

export interface PublicStandingsDto {
  phases: PhaseStandingsDto[];
}

export interface PhaseStandingsDto {
  phaseId: string;
  phaseName: string;
  groups: GroupStandingsDto[];
}

export interface PublicBracketDto {
  phaseId: string;
  phaseName: string;
  rounds: BracketRoundDto[];
}

export interface BracketRoundDto {
  roundNumber: number;
  matches: MatchDto[];
}
