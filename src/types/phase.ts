export interface AddGroupPhaseRequest {
  phaseOrder: number;
  name: string;
  numberOfGroups: number;
  qualifiersPerGroup: number;
  groupFormat: string;
}

export interface AddEliminationPhaseRequest {
  phaseOrder: number;
  name: string;
  eliminationFormat: string;
  hasThirdPlaceMatch: boolean;
}

export interface GroupPhaseResponse {
  id: string;
  phaseOrder: number;
  name: string;
  status: string;
  numberOfGroups: number;
  participantsPerGroup: number;
  qualifiersPerGroup: number;
  qualifiersCount: number;
  groupFormat: string;
  participantCount: number;
  totalMatches?: number;
  completedMatches?: number;
  groups: GroupResponse[];
}

export interface GroupParticipant {
  participantId: string;
  displayName: string;
}

export interface GroupResponse {
  id: string;
  name: string;
  participants: GroupParticipant[];
}

export interface EliminationPhaseResponse {
  id: string;
  phaseOrder: number;
  name: string;
  status: string;
  eliminationFormat: string;
  hasThirdPlaceMatch: boolean;
  bracketSize: number;
  byeCount: number;
  participantCount: number;
  rounds: number;
  totalMatches?: number;
  completedMatches?: number;
}

export type PhaseResponse = GroupPhaseResponse | EliminationPhaseResponse;

export function isGroupPhase(p: PhaseResponse): p is GroupPhaseResponse {
  return "numberOfGroups" in p;
}

export interface TournamentPhasesResponse {
  tournamentId: string;
  tournamentName: string;
  phases: PhaseResponse[];
  isConfigurationValid: boolean;
  validationErrors: string[];
}

export interface GenerateMatchesResponse {
  autoScheduled: boolean;
  scheduledMatchCount: number;
  unscheduledMatchCount: number;
  estimatedEndTime: string | null;
  schedulingWarnings: string[] | null;
}

export interface ReorderPhasesRequest {
  phaseIds: string[];
}

export interface ReassignParticipantRequest {
  participantId: string;
  sourceGroupId: string;
  targetGroupId: string;
}
