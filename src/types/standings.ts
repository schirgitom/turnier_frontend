export interface StandingsDto {
  phaseId: string;
  phaseName: string;
  groups: GroupStandingsDto[];
}

export interface GroupStandingsDto {
  groupName: string;
  entries: StandingsEntryDto[];
}

export interface StandingsEntryDto {
  rank: number;
  participantId: string;
  participantName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}
