import { apiClient, anonymousApiClient } from "./client";
import type {
  LoginRequest,
  RegisterUserRequest,
  RegisterOrganizationRequest,
  AuthResponse,
  InviteInfoDto,
  AcceptInviteRequest,
  InviteUserRequest,
  InviteUserResponse,
  OrgMembershipDto,
  OrganizationChoiceResponse,
} from "@/types/auth";

/**
 * Bei mehreren Organisationen ohne `organizationId` antwortet das Backend mit
 * HTTP 200 und `{ requiresOrganizationChoice: true, organizations }` – ohne Token.
 */
export async function login(
  data: LoginRequest,
): Promise<AuthResponse | OrganizationChoiceResponse> {
  const response = await apiClient.post<AuthResponse | OrganizationChoiceResponse>(
    "/auth/login",
    data,
  );
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

/** 404 = unbekannter Token, 410 = abgelaufen oder bereits verwendet. */
export async function getInviteInfo(token: string): Promise<InviteInfoDto> {
  const response = await anonymousApiClient.get<InviteInfoDto>(
    `/auth/invite/${encodeURIComponent(token)}`,
  );
  return response.data;
}

/** Nur für neue Konten. 409, wenn es zur E-Mail bereits ein Konto gibt. */
export async function acceptInvite(
  data: AcceptInviteRequest,
): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>(
    "/auth/accept-invite",
    data,
  );
  return response.data;
}

/**
 * Für angemeldete Benutzer mit bestehendem Konto. Liefert Tokens, die bereits
 * für die neue Organisation gelten. 403 = E-Mail passt nicht, 409 = schon Mitglied.
 */
export async function acceptInviteExisting(
  token: string,
): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>(
    "/auth/accept-invite/existing",
    { token },
  );
  return response.data;
}

/** 403 = kein Admin, 409 = bereits Mitglied, 422 = displayName fehlt (neues Konto). */
export async function inviteUser(
  data: InviteUserRequest,
): Promise<InviteUserResponse> {
  const response = await apiClient.post<InviteUserResponse>(
    "/auth/invite",
    data,
  );
  return response.data;
}

export async function getMyOrganizations(
  accessToken?: string,
): Promise<OrgMembershipDto[]> {
  const response = await apiClient.get<OrgMembershipDto[]>(
    "/auth/my-organizations",
    accessToken
      ? { headers: { Authorization: `Bearer ${accessToken}` } }
      : undefined,
  );
  return response.data;
}

/**
 * Stellt für den angemeldeten Benutzer neue Tokens für eine andere seiner
 * Organisationen aus. Serverseitig werden dabei ALLE bisherigen
 * Refresh-Tokens des Benutzers widerrufen.
 *
 * Fehler: 401 (Token abgelaufen → Interceptor refresht), 403 (kein aktives
 * Mitglied / Org deaktiviert), 404 (Org existiert nicht), 422 (ungültige ID).
 */
export async function switchOrganization(
  organizationId: string,
): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>(
    "/auth/switch-organization",
    { organizationId },
  );
  return response.data;
}
