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
  displayName: string;
  role: string;
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

export interface AuthResponse {
  userId: string;
  email: string;
  displayName: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  hasOrganization: boolean;
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

export interface InviteInfoDto {
  organizationName: string;
  inviterName: string;
  email: string;
}

export interface OrganizationDto {
  id: string;
  name: string;
  slug: string;
}
