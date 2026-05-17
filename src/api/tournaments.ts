import { apiClient } from "./client";
import type {
  TournamentDto,
  CreateTournamentRequest,
  UpdateTournamentRequest,
} from "@/types/tournament";
import type { PaginatedResponse } from "@/types/participant";

export interface TournamentListParams {
  page?: number;
  pageSize?: number;
  organizationId?: string;
  status?: string;
  sportCode?: string;
  search?: string;
}

export async function getTournaments(
  params?: TournamentListParams,
): Promise<PaginatedResponse<TournamentDto>> {
  const response = await apiClient.get<PaginatedResponse<TournamentDto>>(
    "/tournaments",
    { params },
  );
  return response.data;
}

export async function getOrganizationTournaments(
  orgId: string,
): Promise<TournamentDto[]> {
  const response = await apiClient.get<TournamentDto[]>(
    `/tournaments/organization/${orgId}`,
  );
  return response.data;
}

export async function getTournament(id: string): Promise<TournamentDto> {
  const response = await apiClient.get<TournamentDto>(`/tournaments/${id}`);
  return response.data;
}

export async function createTournament(
  data: CreateTournamentRequest,
): Promise<TournamentDto> {
  const response = await apiClient.post<TournamentDto>("/tournaments", data);
  return response.data;
}

export async function updateTournament(
  id: string,
  data: UpdateTournamentRequest,
): Promise<TournamentDto> {
  const response = await apiClient.put<TournamentDto>(
    `/tournaments/${id}`,
    data,
  );
  return response.data;
}

export async function deleteTournament(id: string): Promise<void> {
  await apiClient.delete(`/tournaments/${id}`);
}

export async function updateTournamentStatus(
  id: string,
  action: string,
  cancellationReason?: string,
): Promise<TournamentDto> {
  const response = await apiClient.patch<TournamentDto>(
    `/tournaments/${id}/status`,
    { action, cancellationReason },
  );
  return response.data;
}

export async function updateTournamentVisibility(
  id: string,
  visibility: string,
): Promise<TournamentDto> {
  const response = await apiClient.patch<TournamentDto>(
    `/tournaments/${id}/visibility`,
    { visibility },
  );
  return response.data;
}
