import { apiClient } from "./client";
import type {
  TournamentVenueConfig,
  UpdateTournamentVenueConfig,
} from "@/types/venue";

export async function getTournamentVenue(
  tournamentId: string,
): Promise<TournamentVenueConfig> {
  const response = await apiClient.get<TournamentVenueConfig>(
    `/tournaments/${tournamentId}/venue`,
  );
  return response.data;
}

export async function configureTournamentVenue(
  tournamentId: string,
  data: TournamentVenueConfig,
): Promise<TournamentVenueConfig> {
  const response = await apiClient.post<TournamentVenueConfig>(
    `/tournaments/${tournamentId}/venue`,
    data,
  );
  return response.data;
}

export async function updateTournamentVenue(
  tournamentId: string,
  data: UpdateTournamentVenueConfig,
): Promise<TournamentVenueConfig> {
  const response = await apiClient.put<TournamentVenueConfig>(
    `/tournaments/${tournamentId}/venue`,
    data,
  );
  return response.data;
}
