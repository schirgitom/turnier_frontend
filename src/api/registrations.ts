import { apiClient } from "./client";

export interface RegistrationDto {
  participantId: string;
  participantDisplayName: string;
  /** Die Person hinter dem Start; mehrere Starts können dieselbe Person teilen. */
  userId: string | null;
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

function normalizeRegistrationsResponse(
  tournamentId: string,
  data: unknown,
): TournamentRegistrationsResponse {
  const fallback: TournamentRegistrationsResponse = {
    tournamentId,
    tournamentName: "",
    registrations: [],
    totalConfirmed: 0,
    totalCheckedIn: 0,
  };

  if (!data || typeof data !== "object") return fallback;

  const obj = data as {
    tournamentId?: unknown;
    tournamentName?: unknown;
    registrations?: unknown;
    items?: unknown;
    totalConfirmed?: unknown;
    totalCheckedIn?: unknown;
  };

  const registrations = Array.isArray(obj.registrations)
    ? (obj.registrations as RegistrationDto[])
    : Array.isArray(obj.items)
      ? (obj.items as RegistrationDto[])
      : [];

  return {
    tournamentId:
      typeof obj.tournamentId === "string" ? obj.tournamentId : tournamentId,
    tournamentName:
      typeof obj.tournamentName === "string" ? obj.tournamentName : "",
    registrations,
    totalConfirmed:
      typeof obj.totalConfirmed === "number"
        ? obj.totalConfirmed
        : registrations.filter((r) => r.status === "Confirmed").length,
    totalCheckedIn:
      typeof obj.totalCheckedIn === "number"
        ? obj.totalCheckedIn
        : registrations.filter((r) => r.isCheckedIn).length,
  };
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
  const response = await apiClient.get<unknown>(
    `/tournaments/${tournamentId}/registrations`,
  );
  return normalizeRegistrationsResponse(tournamentId, response.data);
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

export async function bulkCreateRegistration(
  tournamentId: string,
  data: BulkCreateRegistrationRequest,
): Promise<BulkCreateRegistrationResponse> {
  const response = await apiClient.post<BulkCreateRegistrationResponse>(
    `/tournaments/${tournamentId}/registrations/bulk-create`,
    data,
  );
  return response.data;
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
