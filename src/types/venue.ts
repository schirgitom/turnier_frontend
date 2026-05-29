export interface VenueListItemDto {
  id: string;
  name: string;
  address: string;
  description: string;
  isActive: boolean;
  courtCount: number;
}

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

