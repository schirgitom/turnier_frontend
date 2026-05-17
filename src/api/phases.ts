import { apiClient } from "./client";
import type {
  PhaseDto,
  CreatePhaseRequest,
  UpdatePhaseRequest,
} from "@/types/phase";

export async function getPhases(tournamentId: string): Promise<PhaseDto[]> {
  const response = await apiClient.get<PhaseDto[]>(
    `/tournaments/${tournamentId}/phases`,
  );
  return response.data;
}

export async function getPhase(
  tournamentId: string,
  id: string,
): Promise<PhaseDto> {
  const response = await apiClient.get<PhaseDto>(
    `/tournaments/${tournamentId}/phases/${id}`,
  );
  return response.data;
}

export async function createPhase(
  tournamentId: string,
  data: CreatePhaseRequest,
): Promise<PhaseDto> {
  const response = await apiClient.post<PhaseDto>(
    `/tournaments/${tournamentId}/phases`,
    data,
  );
  return response.data;
}

export async function updatePhase(
  tournamentId: string,
  id: string,
  data: UpdatePhaseRequest,
): Promise<PhaseDto> {
  const response = await apiClient.put<PhaseDto>(
    `/tournaments/${tournamentId}/phases/${id}`,
    data,
  );
  return response.data;
}

export async function deletePhase(
  tournamentId: string,
  id: string,
): Promise<void> {
  await apiClient.delete(`/tournaments/${tournamentId}/phases/${id}`);
}

export async function generateMatches(
  tournamentId: string,
  phaseId: string,
): Promise<void> {
  await apiClient.post(
    `/tournaments/${tournamentId}/phases/${phaseId}/generate`,
  );
}
