import { apiClient } from "./client";
import type {
  LoginRequest,
  RegisterUserRequest,
  RegisterOrganizationRequest,
  AuthResponse,
  InviteInfoDto,
  AcceptInviteRequest,
  InviteUserRequest,
  OrgMembershipDto,
} from "@/types/auth";

export async function login(data: LoginRequest): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>("/auth/login", data);
  return response.data;
}

export async function register(
  data: RegisterUserRequest,
): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>("/auth/register", data);
  return response.data;
}

export async function registerOrganization(
  data: RegisterOrganizationRequest,
): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>(
    "/auth/register-organization",
    data,
  );
  return response.data;
}

export async function refreshTokens(
  refreshToken: string,
): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>("/auth/refresh", {
    refreshToken,
  });
  return response.data;
}

export async function revoke(refreshToken: string): Promise<void> {
  await apiClient.post("/auth/revoke", { refreshToken });
}

export async function getInviteInfo(token: string): Promise<InviteInfoDto> {
  const response = await apiClient.get<InviteInfoDto>(
    `/auth/invite/${token}`,
  );
  return response.data;
}

export async function acceptInvite(
  data: AcceptInviteRequest,
): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>(
    "/auth/accept-invite",
    data,
  );
  return response.data;
}

export async function inviteUser(data: InviteUserRequest): Promise<void> {
  await apiClient.post("/auth/invite", data);
}

export async function getMyOrganizations(): Promise<OrgMembershipDto[]> {
  const response =
    await apiClient.get<OrgMembershipDto[]>("/auth/my-organizations");
  return response.data;
}
