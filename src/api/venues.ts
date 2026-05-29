import { apiClient } from "./client";
import type {
  VenueListItemDto,
  VenueDto,
  CreateVenueRequest,
  UpdateVenueRequest,
  CreateCourtRequest,
  CourtDto,
} from "@/types/venue";
import type { PaginatedResponse } from "@/types/participant";

export async function getVenues(params?: {
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResponse<VenueListItemDto>> {
  const response = await apiClient.get<PaginatedResponse<VenueListItemDto>>(
    "/venues",
    { params },
  );
  return response.data;
}

export async function getVenue(id: string): Promise<VenueDto> {
  const response = await apiClient.get<VenueDto>(`/venues/${id}`);
  return response.data;
}

export async function createVenue(data: CreateVenueRequest): Promise<VenueDto> {
  const response = await apiClient.post<VenueDto>("/venues", data);
  return response.data;
}

export async function updateVenue(
  id: string,
  data: UpdateVenueRequest,
): Promise<VenueDto> {
  const response = await apiClient.put<VenueDto>(`/venues/${id}`, data);
  return response.data;
}

export async function deleteVenue(id: string): Promise<void> {
  await apiClient.delete(`/venues/${id}`);
}

export async function createCourt(
  venueId: string,
  data: CreateCourtRequest,
): Promise<CourtDto> {
  const response = await apiClient.post<CourtDto>(
    `/venues/${venueId}/courts`,
    data,
  );
  return response.data;
}

export async function deleteCourt(
  venueId: string,
  courtId: string,
): Promise<void> {
  await apiClient.delete(`/venues/${venueId}/courts/${courtId}`);
}

export async function renameCourt(
  venueId: string,
  courtId: string,
  name: string,
): Promise<void> {
  await apiClient.patch(`/venues/${venueId}/courts/${courtId}/rename`, {
    name,
  });
}
