export interface StandingEntry {
  rank: number;
  participantId: string;
  participantName: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  setsWon: number;
  setsLost: number;
  setDifference: number;
  pointsScored: number;
  pointsConceded: number;
  pointDifference: number;
  points: number;
  isQualified: boolean;
}

// DTO shape returned by the public display standings endpoint
export interface DisplayStandingEntry {
  participantId: string;
  participantName: string;
  rank: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalDifference: number;
  points: number;
}

export interface GroupStandingsDto {
  groupName: string;
  entries: DisplayStandingEntry[];
}

export interface GroupStandings {
  groupId: string;
  groupName: string;
  standings: StandingEntry[];
}

export interface PhaseStandingsResponse {
  tournamentId: string;
  phaseId: string;
  groups: GroupStandings[];
}
