import { anonymousApiClient, apiClient } from "./client";
import type {
  TournamentPhasesResponse,
  PhaseResponse,
  GroupPhaseResponse,
  GroupResponse,
  AddGroupPhaseRequest,
  AddEliminationPhaseRequest,
  GenerateMatchesResponse,
  ReorderPhasesRequest,
  ReassignParticipantRequest,
} from "@/types/phase";
import type { PhaseMatchesResponse } from "@/types/bracket";

export interface AdvancePhaseResponse {
  wiredLinks: number;
  updatedSlots: number;
}

const base = (tournamentId: string) => `/tournaments/${tournamentId}/phases`;

export function normalizePhasesResponse(data: unknown): TournamentPhasesResponse {
  const fallback: TournamentPhasesResponse = {
    tournamentId: "",
    tournamentName: "",
    phases: [],
    isConfigurationValid: true,
    validationErrors: [],
  };

  if (!data || typeof data !== "object") return fallback;

  const obj = data as {
    tournamentId?: unknown;
    tournamentName?: unknown;
    phases?: unknown;
    items?: unknown;
    isConfigurationValid?: unknown;
    validationErrors?: unknown;
  };

  const phases = Array.isArray(obj.phases)
    ? (obj.phases as PhaseResponse[])
    : Array.isArray(obj.items)
      ? (obj.items as PhaseResponse[])
      : [];

  return {
    tournamentId:
      typeof obj.tournamentId === "string" ? obj.tournamentId : "",
    tournamentName:
      typeof obj.tournamentName === "string" ? obj.tournamentName : "",
    phases,
    isConfigurationValid:
      typeof obj.isConfigurationValid === "boolean"
        ? obj.isConfigurationValid
        : true,
    validationErrors: Array.isArray(obj.validationErrors)
      ? (obj.validationErrors as string[])
      : [],
  };
}

export async function getPhases(
  tournamentId: string,
): Promise<TournamentPhasesResponse> {
  const response = await apiClient.get<unknown>(
    base(tournamentId),
  );
  return normalizePhasesResponse(response.data);
}

/**
 * Anonyme Variante für Beamer/Info-Seite: kein Token, kein Login-Redirect.
 * Der Endpunkt ist im Backend ohne [Authorize] erreichbar.
 */
export async function getDisplayPhases(
  tournamentId: string,
): Promise<TournamentPhasesResponse> {
  const response = await anonymousApiClient.get<unknown>(base(tournamentId));
  return normalizePhasesResponse(response.data);
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

export async function generatePhase(
  tournamentId: string,
  phaseId: string,
): Promise<GenerateMatchesResponse> {
  const response = await apiClient.post<GenerateMatchesResponse>(
    `${base(tournamentId)}/${phaseId}/generate`,
  );
  return response.data;
}

export async function generateAllPhases(
  tournamentId: string,
): Promise<GenerateMatchesResponse> {
  const response = await apiClient.post<GenerateMatchesResponse>(
    `${base(tournamentId)}/generate-all`,
  );
  return response.data;
}

export async function getGroups(
  tournamentId: string,
  phaseId: string,
): Promise<GroupResponse[]> {
  const response = await apiClient.get<GroupResponse[]>(
    `${base(tournamentId)}/${phaseId}/groups`,
  );
  return response.data;
}

export async function createGroup(
  tournamentId: string,
  phaseId: string,
  name: string,
): Promise<GroupResponse> {
  const response = await apiClient.post<GroupResponse>(
    `${base(tournamentId)}/${phaseId}/groups`,
    { name },
  );
  return response.data;
}

export async function renameGroup(
  tournamentId: string,
  phaseId: string,
  groupId: string,
  name: string,
): Promise<void> {
  await apiClient.put(`${base(tournamentId)}/${phaseId}/groups/${groupId}`, {
    name,
  });
}

export async function deleteGroup(
  tournamentId: string,
  phaseId: string,
  groupId: string,
): Promise<void> {
  await apiClient.delete(
    `${base(tournamentId)}/${phaseId}/groups/${groupId}`,
  );
}

export async function addParticipantToGroup(
  tournamentId: string,
  phaseId: string,
  groupId: string,
  participantId: string,
): Promise<void> {
  await apiClient.post(
    `${base(tournamentId)}/${phaseId}/groups/${groupId}/participants`,
    { participantId },
  );
}

export async function removeParticipantFromGroup(
  tournamentId: string,
  phaseId: string,
  groupId: string,
  participantId: string,
): Promise<void> {
  await apiClient.delete(
    `${base(tournamentId)}/${phaseId}/groups/${groupId}/participants/${participantId}`,
  );
}

export async function resetPhase(
  tournamentId: string,
  phaseId: string,
): Promise<PhaseResponse> {
  const response = await apiClient.post<PhaseResponse>(
    `${base(tournamentId)}/${phaseId}/reset`,
  );
  return response.data;
}

export async function getPhaseMatches(
  tournamentId: string,
  phaseId: string,
): Promise<PhaseMatchesResponse> {
  const response = await apiClient.get<PhaseMatchesResponse>(
    `${base(tournamentId)}/${phaseId}/matches`,
  );
  return response.data;
}

/** Anonyme Variante von getPhaseMatches (nur Gruppen-/K.O.-Phasen, nicht Paschen). */
export async function getDisplayPhaseMatches(
  tournamentId: string,
  phaseId: string,
): Promise<PhaseMatchesResponse> {
  const response = await anonymousApiClient.get<PhaseMatchesResponse>(
    `${base(tournamentId)}/${phaseId}/matches`,
  );
  return response.data;
}

export async function reassignParticipant(
  tournamentId: string,
  phaseId: string,
  data: ReassignParticipantRequest,
): Promise<GroupPhaseResponse> {
  const response = await apiClient.patch<GroupPhaseResponse>(
    `${base(tournamentId)}/${phaseId}/groups/reassign`,
    data,
  );
  return response.data;
}

export async function advancePhase(
  tournamentId: string,
  phaseId: string,
): Promise<AdvancePhaseResponse> {
  const response = await apiClient.post<AdvancePhaseResponse>(
    `${base(tournamentId)}/${phaseId}/advance`,
  );
  return response.data;
}
