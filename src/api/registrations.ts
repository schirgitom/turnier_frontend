import { apiClient } from "./client";

export interface RegistrationDto {
  participantId: string;
  participantName: string;
  participantEmail: string;
  status: string;
  seed: number | null;
  registeredAt: string;
}

export interface RegistrationsResponse {
  items: RegistrationDto[];
  totalCount: number;
}

export async function getRegistrations(
  tournamentId: string,
): Promise<RegistrationDto[]> {
  const response = await apiClient.get<RegistrationDto[] | RegistrationsResponse>(
    `/tournaments/${tournamentId}/registrations`,
  );
  if (Array.isArray(response.data)) return response.data;
  return response.data.items;
}

export async function registerParticipant(
  tournamentId: string,
  participantId: string,
): Promise<void> {
  await apiClient.post(`/tournaments/${tournamentId}/registrations`, {
    participantId,
  });
}

export async function bulkRegister(
  tournamentId: string,
  participantIds: string[],
): Promise<void> {
  await apiClient.post(`/tournaments/${tournamentId}/registrations/bulk`, {
    participantIds,
  });
}

export async function removeRegistration(
  tournamentId: string,
  participantId: string,
): Promise<void> {
  await apiClient.delete(
    `/tournaments/${tournamentId}/registrations/${participantId}`,
  );
}

export async function confirmRegistration(
  tournamentId: string,
  participantId: string,
): Promise<void> {
  await apiClient.patch(
    `/tournaments/${tournamentId}/registrations/${participantId}/confirm`,
  );
}

export async function checkInRegistration(
  tournamentId: string,
  participantId: string,
): Promise<void> {
  await apiClient.patch(
    `/tournaments/${tournamentId}/registrations/${participantId}/checkin`,
  );
}

export async function withdrawRegistration(
  tournamentId: string,
  participantId: string,
): Promise<void> {
  await apiClient.patch(
    `/tournaments/${tournamentId}/registrations/${participantId}/withdraw`,
  );
}

export async function updateSeeds(
  tournamentId: string,
  seeds: Array<{ participantId: string; seedNumber: number }>,
): Promise<void> {
  await apiClient.post(
    `/tournaments/${tournamentId}/registrations/seeds`,
    { seeds },
  );
}
