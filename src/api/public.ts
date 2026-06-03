import { publicApiClient } from "./client";
import type {
  PublicTournamentListItem,
  PublicTournamentListResponse,
} from "@/types/public";

export async function getPublicTournamentList(params?: {
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<PublicTournamentListResponse> {
  const response = await publicApiClient.get<PublicTournamentListResponse>(
    "/api/public/tournaments",
    { params },
  );
  return response.data;
}

export type { PublicTournamentListItem };
