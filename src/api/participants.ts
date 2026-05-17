import { apiClient } from "./client";
import type {
  ParticipantDto,
  CreateParticipantRequest,
  UpdateParticipantRequest,
  PaginatedResponse,
} from "@/types/participant";

export async function getParticipants(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
}): Promise<PaginatedResponse<ParticipantDto>> {
  const response = await apiClient.get<PaginatedResponse<ParticipantDto>>(
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
  data: CreateParticipantRequest,
): Promise<ParticipantDto> {
  const response = await apiClient.post<ParticipantDto>("/participants", data);
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
