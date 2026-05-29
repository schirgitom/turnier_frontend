export interface ActiveCourt {
  id: string;
  name: string;
  isActive: boolean;
}

export interface PhaseVenueDto {
  id: string;
  phaseId: string;
  venueId: string;
  venueName: string;
  availableFrom: string;
  matchDurationMinutes: number;
  breakBetweenMatchesMinutes: number;
  schedulingStrategy: "EarliestFirst" | "Distributed";
  activeCourts: ActiveCourt[];
  slotDurationMinutes: number;
  totalActiveCourts: number;
}

export interface PhaseVenueListResponse {
  phaseId: string;
  phaseName: string;
  venues: PhaseVenueDto[];
  totalActiveCourts: number;
}

export interface AddPhaseVenueRequest {
  venueId: string;
  availableFrom: string;
  matchDurationMinutes: number;
  breakBetweenMatchesMinutes: number;
  schedulingStrategy: "EarliestFirst" | "Distributed";
  activeCourtIds: string[];
}
