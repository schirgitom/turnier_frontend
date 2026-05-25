import { apiClient } from "./client";
import type {
  TournamentPhasesResponse,
  PhaseResponse,
  AddGroupPhaseRequest,
  AddEliminationPhaseRequest,
  ReorderPhasesRequest,
} from "@/types/phase";

const base = (tournamentId: string) => `/tournaments/${tournamentId}/phases`;

export async function getPhases(
  tournamentId: string,
): Promise<TournamentPhasesResponse> {
  const response = await apiClient.get<TournamentPhasesResponse>(
    base(tournamentId),
  );
  return response.data;
}

export async function getPhase(
  tournamentId: string,
  phaseId: string,
): Promise<PhaseResponse> {
  const response = await apiClient.get<PhaseResponse>(
    `${base(tournamentId)}/${phaseId}`,
  );
  return response.data;
}

export async function addGroupPhase(
  tournamentId: string,
  data: AddGroupPhaseRequest,
): Promise<PhaseResponse> {
  const response = await apiClient.post<PhaseResponse>(
    `${base(tournamentId)}/group`,
    data,
  );
  return response.data;
}

export async function addEliminationPhase(
  tournamentId: string,
  data: AddEliminationPhaseRequest,
): Promise<PhaseResponse> {
  const response = await apiClient.post<PhaseResponse>(
    `${base(tournamentId)}/elimination`,
    data,
  );
  return response.data;
}

export async function updateGroupPhase(
  tournamentId: string,
  phaseId: string,
  data: Partial<AddGroupPhaseRequest>,
): Promise<PhaseResponse> {
  const response = await apiClient.put<PhaseResponse>(
    `${base(tournamentId)}/${phaseId}/group`,
    data,
  );
  return response.data;
}

export async function updateEliminationPhase(
  tournamentId: string,
  phaseId: string,
  data: Partial<AddEliminationPhaseRequest>,
): Promise<PhaseResponse> {
  const response = await apiClient.put<PhaseResponse>(
    `${base(tournamentId)}/${phaseId}/elimination`,
    data,
  );
  return response.data;
}

export async function removePhase(
  tournamentId: string,
  phaseId: string,
): Promise<void> {
  await apiClient.delete(`${base(tournamentId)}/${phaseId}`);
}

export async function reorderPhases(
  tournamentId: string,
  data: ReorderPhasesRequest,
): Promise<void> {
  await apiClient.patch(`${base(tournamentId)}/reorder`, data);
}

export async function validateConfiguration(
  tournamentId: string,
): Promise<void> {
  await apiClient.post(`${base(tournamentId)}/validate`);
}
