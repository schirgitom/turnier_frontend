export interface ActiveCourt {
  id: string;
  name: string;
  isActive: boolean;
}

export interface GroupAssignment {
  groupIndex: number;
  startVenueIndex: number;
}

export interface VenueRotationConfig {
  enabled: boolean;
  rotateAfterRounds: number;
  groupAssignments: GroupAssignment[];
}

export interface PhaseVenueDto {
  id: string;
  phaseId: string;
  venueId: string;
  venueName: string;
  availableFrom: string | null;
  matchDurationMinutes: number;
  breakBetweenMatchesMinutes: number;
  schedulingStrategy: "EarliestFirst" | "Distributed";
  activeCourts: ActiveCourt[];
  slotDurationMinutes: number;
  totalActiveCourts: number;
  venueRotation?: VenueRotationConfig | null;
}

export interface PhaseVenueListResponse {
  phaseId: string;
  phaseName: string;
  venues: PhaseVenueDto[];
  totalActiveCourts: number;
}

export interface AddPhaseVenueRequest {
  venueId: string;
  availableFrom: string | null;
  matchDurationMinutes: number;
  breakBetweenMatchesMinutes: number;
  schedulingStrategy: "EarliestFirst" | "Distributed";
  activeCourtIds: string[];
  venueRotation?: VenueRotationConfig | null;
}
