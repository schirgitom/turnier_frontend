import { apiClient } from "./client";

export interface RegistrationDto {
  participantId: string;
  participantDisplayName: string;
  status: string;
  seedNumber: number | null;
  registeredAt: string;
  checkedInAt: string | null;
  isCheckedIn: boolean;
}

export interface TournamentRegistrationsResponse {
  tournamentId: string;
  tournamentName: string;
  registrations: RegistrationDto[];
  totalConfirmed: number;
  totalCheckedIn: number;
}

/**
 * Request für das Anlegen einer neuen Person (ohne Account) inkl. aller Starts
 * in einem Schritt. Ersetzt den alten 3-Schritt-Flow
 * (Participant anlegen → registrieren → wiederholen).
 */
export interface BulkCreateRegistrationRequest {
  firstName: string;
  lastName: string;
  /** Anzahl gekaufter Karten, 1–3. Default 1. */
  startCount?: number;
  /** YYYY-MM-DD */
  dateOfBirth?: string | null;
  phoneNumber?: string | null;
  notes?: string | null;
}

export interface BulkCreateStartDto {
  participantId: string;
  displayName: string;
  startNumber: number;
  registeredAt: string;
}

export interface BulkCreateRegistrationResponse {
  tournamentId: string;
  personDisplayName: string;
  starts: BulkCreateStartDto[];
}

export async function getRegistrations(
  tournamentId: string,
): Promise<TournamentRegistrationsResponse> {
  const response = await apiClient.get<TournamentRegistrationsResponse>(
    `/tournaments/${tournamentId}/registrations`,
  );
  return response.data;
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
