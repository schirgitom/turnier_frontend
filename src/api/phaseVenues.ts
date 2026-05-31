import { apiClient } from "./client";
import type {
  PhaseVenueListResponse,
  PhaseVenueDto,
  AddPhaseVenueRequest,
} from "@/types/phaseVenue";

const base = (tournamentId: string, phaseId: string) =>
  `/tournaments/${tournamentId}/phases/${phaseId}/venues`;

export async function getPhaseVenues(
  tournamentId: string,
  phaseId: string,
): Promise<PhaseVenueListResponse> {
  const response = await apiClient.get<PhaseVenueListResponse>(
    base(tournamentId, phaseId),
  );
  return response.data;
}

export async function addPhaseVenue(
  tournamentId: string,
  phaseId: string,
  data: AddPhaseVenueRequest,
): Promise<PhaseVenueDto> {
  const response = await apiClient.post<PhaseVenueDto>(
    base(tournamentId, phaseId),
    data,
  );
  return response.data;
}

export async function updatePhaseVenue(
  tournamentId: string,
  phaseId: string,
  id: string,
  data: AddPhaseVenueRequest,
): Promise<PhaseVenueDto> {
  const response = await apiClient.put<PhaseVenueDto>(
    `${base(tournamentId, phaseId)}/${id}`,
    data,
  );
  return response.data;
}

export async function removePhaseVenue(
  tournamentId: string,
  phaseId: string,
  id: string,
): Promise<void> {
  await apiClient.delete(`${base(tournamentId, phaseId)}/${id}`);
}
