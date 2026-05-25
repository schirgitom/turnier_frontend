import { apiClient } from "./client";
import type {
  ParticipantDto,
  ParticipantListResponse,
  CreateParticipantRequest,
  UpdateParticipantRequest,
} from "@/types/participant";
import type { ParticipantType } from "@/types/tournament";

export async function getParticipants(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
}): Promise<ParticipantListResponse> {
  const response = await apiClient.get<ParticipantListResponse>(
    "/participants",
    { params },
  );
  return response.data;
}

export async function getParticipant(id: string): Promise<ParticipantDto> {
  const response = await apiClient.get<ParticipantDto>(`/participants/${id}`);
  return response.data;
}

export async function createParticipant(
  type: ParticipantType,
  data: CreateParticipantRequest,
): Promise<ParticipantDto> {
  const endpoint =
    type === "Double" ? "/participants/double"
    : type === "Team"   ? "/participants/team"
    :                     "/participants/single";
  const response = await apiClient.post<ParticipantDto>(endpoint, data);
  return response.data;
}

export async function updateParticipant(
  id: string,
  data: UpdateParticipantRequest,
): Promise<ParticipantDto> {
  const response = await apiClient.put<ParticipantDto>(
    `/participants/${id}`,
    data,
  );
  return response.data;
}

export async function deleteParticipant(id: string): Promise<void> {
  await apiClient.delete(`/participants/${id}`);
}
