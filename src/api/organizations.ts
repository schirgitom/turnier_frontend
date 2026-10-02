import { apiClient } from "./client";
import type {
  CreateOrganizationRequest,
  AddOrganizationMemberRequest,
  OrganizationDto,
  OrganizationMemberDto,
  OrganizationInvitationDto,
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

// ── Mitgliederverwaltung der aktiven Organisation (nur Admins) ──

export async function getCurrentMembers(): Promise<OrganizationMemberDto[]> {
  const response = await apiClient.get<OrganizationMemberDto[]>(
    "/organizations/current/members",
  );
  return response.data;
}

/** 403 = kein Admin, 404 = Benutzer nicht gefunden, 422 = ungültige Rolle oder bereits Mitglied. */
export async function addCurrentMember(
  data: AddOrganizationMemberRequest,
): Promise<OrganizationMemberDto> {
  const response = await apiClient.post<OrganizationMemberDto>(
    "/organizations/current/members",
    data,
  );
  return response.data;
}

export async function getCurrentInvitations(): Promise<
  OrganizationInvitationDto[]
> {
  const response = await apiClient.get<OrganizationInvitationDto[]>(
    "/organizations/current/invitations",
  );
  return response.data;
}

export async function revokeInvitation(id: string): Promise<void> {
  await apiClient.delete(`/organizations/current/invitations/${id}`);
}

/** 409 = letzter Admin kann nicht herabgestuft werden. */
export async function changeMemberRole(
  userId: string,
  role: string,
): Promise<OrganizationMemberDto> {
  const response = await apiClient.put<OrganizationMemberDto>(
    `/organizations/current/members/${userId}/role`,
    { role },
  );
  return response.data;
}

/** Deaktiviert die Mitgliedschaft. 409 = letzter Admin. */
export async function removeMember(userId: string): Promise<void> {
  await apiClient.delete(`/organizations/current/members/${userId}`);
}
