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
