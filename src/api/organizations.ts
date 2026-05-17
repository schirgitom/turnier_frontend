import { apiClient } from "./client";
import type {
  CreateOrganizationRequest,
  OrganizationDto,
} from "@/types/auth";

export async function createOrganization(
  data: CreateOrganizationRequest,
): Promise<OrganizationDto> {
  const response = await apiClient.post<OrganizationDto>(
    "/organizations",
    data,
  );
  return response.data;
}

export async function getOrganizations(): Promise<OrganizationDto[]> {
  const response = await apiClient.get<OrganizationDto[]>("/organizations");
  return response.data;
}

export async function getOrganization(id: string): Promise<OrganizationDto> {
  const response = await apiClient.get<OrganizationDto>(
    `/organizations/${id}`,
  );
  return response.data;
}
