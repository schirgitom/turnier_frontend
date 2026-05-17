export interface VenueDto {
  id: string;
  name: string;
  address: string;
  description: string;
  courts: CourtDto[];
}

export interface CourtDto {
  id: string;
  venueId: string;
  name: string;
  sportId: string | null;
}

export interface CreateVenueRequest {
  name: string;
  address?: string;
  description?: string;
}

export interface UpdateVenueRequest {
  name?: string;
  address?: string;
  description?: string;
}

export interface CreateCourtRequest {
  name: string;
  sportId?: string;
}

export interface TournamentVenueConfig {
  venueId: string;
  availableFrom: string;
  availableUntil: string;
  matchDurationMinutes: number;
  breakBetweenMatchesMinutes: number;
  schedulingStrategy: string;
  activeCourtIds: string[];
}

export interface UpdateTournamentVenueConfig {
  availableFrom?: string;
  availableUntil?: string;
  matchDurationMinutes?: number;
  breakBetweenMatchesMinutes?: number;
  schedulingStrategy?: string;
  activeCourtIds?: string[];
}
