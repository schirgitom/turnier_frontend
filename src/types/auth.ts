export interface RegisterUserRequest {
  email: string;
  password: string;
  displayName: string;
}

export interface RegisterOrganizationRequest {
  organizationName: string;
  organizationSlug: string;
  adminEmail: string;
  adminPassword: string;
  adminDisplayName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  organizationId?: string;
}

export interface AcceptInviteRequest {
  token: string;
  password: string;
  displayName: string;
}

export interface InviteUserRequest {
  email: string;
  /** Nur für neue Konten erforderlich (sonst 422). */
  displayName?: string;
  role: string;
}

/** Antwort auf POST /api/auth/invite. Bereits Mitglied → 409. */
export interface InviteUserResponse {
  status: string;
  existingUser: boolean;
  email: string;
  invitationId: string;
  expiresAt: string;
  /** Nur in Development/Testing befüllt, sonst null. */
  token: string | null;
}

export interface AcceptInviteExistingRequest {
  token: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RevokeTokenRequest {
  refreshToken: string;
}

export interface CreateOrganizationRequest {
  name: string;
  slug: string;
}

export interface AuthUserDto {
  id: string;
  email: string;
  displayName: string;
  role: string;
  /** Guid.Empty ("00000000-…"), wenn der Token keiner Organisation zugeordnet ist. */
  organizationId: string;
  organizationName: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  /** Backend-Form: Benutzer inkl. gewählter Organisation. */
  user?: AuthUserDto;
  /** @deprecated Alte flache Form – nur als Fallback. */
  userId?: string;
  /** @deprecated */
  email?: string;
  /** @deprecated */
  displayName?: string;
  /** @deprecated */
  hasOrganization?: boolean;
}

/** Antwort von /auth/login, wenn der Benutzer mehreren Organisationen angehört. */
export interface OrganizationChoiceResponse {
  requiresOrganizationChoice: true;
  organizations: OrgMembershipDto[];
}

export function isOrganizationChoice(
  data: AuthResponse | OrganizationChoiceResponse,
): data is OrganizationChoiceResponse {
  return (
    (data as OrganizationChoiceResponse).requiresOrganizationChoice === true
  );
}

const EMPTY_GUID = "00000000-0000-0000-0000-000000000000";

/** Liefert die im Token gewählte Organisation – null, wenn keine. */
export function orgFromAuthResponse(
  response: AuthResponse,
): OrgMembershipDto | null {
  const u = response.user;
  if (!u?.organizationId || u.organizationId === EMPTY_GUID) return null;
  return {
    organizationId: u.organizationId,
    organizationName: u.organizationName,
    role: u.role,
  };
}

export interface UserDto {
  id: string;
  email: string;
  displayName: string;
}

export interface OrgMembershipDto {
  organizationId: string;
  organizationName: string;
  role: string;
}

/** Rollen laut Backend: Admin, TournamentDirector, Referee, Viewer. */
export const ROLE_LABELS: Record<string, string> = {
  Admin: "Admin",
  TournamentDirector: "Turnierleitung",
  Referee: "Schiedsrichter",
  Viewer: "Zuschauer",
  // Altlasten
  Owner: "Inhaber",
  Member: "Mitglied",
};

export function roleLabel(role: string | null | undefined): string {
  if (!role) return "";
  return ROLE_LABELS[role] ?? role;
}

/** Antwort auf GET /api/auth/invite/{token}. 404 = unbekannt, 410 = abgelaufen/verwendet. */
export interface InviteInfoDto {
  organizationName: string;
  inviterName: string;
  email: string;
  role: string;
  existingUser: boolean;
  expiresAt: string;
}

export interface OrganizationMemberDto {
  userId: string;
  displayName: string;
  email: string;
  role: string;
  joinedAt: string;
}

export interface OrganizationInvitationDto {
  id: string;
  email: string;
  role: string;
  invitedBy: string;
  expiresAt: string;
}

/** Rollen, die vergeben werden können (Reihenfolge = Anzeige). */
export const ASSIGNABLE_ROLES = [
  "Admin",
  "TournamentDirector",
  "Referee",
  "Viewer",
] as const;

/** Rollen mit Verwaltungsrechten für die Organisation. */
export const ADMIN_ROLES = ["Admin", "Owner"];

export function isAdminRole(role: string | null | undefined): boolean {
  return !!role && ADMIN_ROLES.includes(role);
}

export interface OrganizationDto {
  id: string;
  name: string;
  slug: string;
}
