import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useAuthStore } from "@/store/authStore";
import * as authApi from "@/api/auth";
import { getApiErrorMessage } from "@/api/client";
import { broadcastAuthEvent } from "@/lib/authSync";
import {
  isOrganizationChoice,
  orgFromAuthResponse,
  type LoginRequest,
  type RegisterUserRequest,
  type RegisterOrganizationRequest,
  type OrgMembershipDto,
} from "@/types/auth";

export type LoginResult =
  | { kind: "done" }
  | { kind: "choice"; organizations: OrgMembershipDto[] };

/** Nur interne Pfade zulassen (kein Open Redirect). */
export function safeRedirect(target: string | null | undefined): string | null {
  if (!target || !target.startsWith("/") || target.startsWith("//")) {
    return null;
  }
  return target;
}

/**
 * Login-Flow:
 * - 1 Organisation → Backend liefert direkt Token mit Org-Claim.
 * - mehrere Organisationen → Backend liefert `requiresOrganizationChoice`;
 *   die Login-Seite zeigt dann eine Auswahl und ruft erneut mit `organizationId` auf.
 * - keine Organisation → Onboarding.
 * - `redirectTo` (z. B. Einladungslink) hat Vorrang vor dem Standardziel.
 */
export function useLogin(redirectTo?: string | null) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: LoginRequest): Promise<LoginResult> => {
      const result = await authApi.login(data);

      if (isOrganizationChoice(result)) {
        return { kind: "choice", organizations: result.organizations };
      }

      const org = orgFromAuthResponse(result);
      // Daten der zuvor aktiven Organisation verwerfen.
      queryClient.clear();
      useAuthStore.getState().setAuthWithOrg(result, org);
      navigate(
        safeRedirect(redirectTo) ?? (org ? "/tournaments" : "/onboarding"),
        { replace: true },
      );
      return { kind: "done" };
    },
  });
}

export function useRegister() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: RegisterUserRequest) => authApi.register(data),
    onSuccess: async (response) => {
      let orgs: OrgMembershipDto[] = [];
      try {
        orgs = await authApi.getMyOrganizations(response.accessToken);
      } catch {
        // ignore, orgs stays empty
      }

      useAuthStore.getState().setAuthWithOrg(
        response,
        orgs.length > 0 ? orgs[0]! : null,
      );

      if (orgs.length > 0) {
        navigate("/tournaments");
      } else {
        navigate("/onboarding");
      }
    },
  });
}

export function useRegisterOrganization() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: RegisterOrganizationRequest) =>
      authApi.registerOrganization(data),
    onSuccess: async (response) => {
      let orgs: OrgMembershipDto[] = [];
      try {
        orgs = await authApi.getMyOrganizations(response.accessToken);
      } catch {
        // ignore, orgs stays empty
      }

      useAuthStore.getState().setAuthWithOrg(
        response,
        orgs.length > 0 ? orgs[0]! : null,
      );

      navigate(orgs.length > 0 ? "/tournaments" : "/onboarding");
    },
  });
}

export function useLogout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { refreshToken, logout } = useAuthStore();

  return useMutation({
    mutationFn: async () => {
      if (refreshToken) {
        await authApi.revoke(refreshToken).catch(() => {});
      }
    },
    onSettled: () => {
      logout();
      queryClient.clear();
      broadcastAuthEvent({ type: "logout" });
      navigate("/login");
    },
  });
}

/**
 * Wechselt die aktive Organisation über `POST /auth/switch-organization`.
 * - ersetzt Access- und Refresh-Token (alte Refresh-Tokens sind serverseitig widerrufen)
 * - übernimmt Organisation + Rolle aus `user`
 * - leert den Query-Cache und navigiert zur Turnierliste
 * - SignalR baut sich über den geänderten Access-Token neu auf
 * - andere Tabs werden benachrichtigt und laden neu
 */
export function useSwitchOrganization() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (organizationId: string) =>
      authApi.switchOrganization(organizationId),
    onSuccess: (response, organizationId) => {
      const org = orgFromAuthResponse(response);
      queryClient.clear();
      useAuthStore.getState().setAuthWithOrg(response, org);
      broadcastAuthEvent({
        type: "org-switched",
        organizationId: org?.organizationId ?? organizationId,
      });
      navigate("/tournaments", { replace: true });
      if (org) toast.success(`Gewechselt zu ${org.organizationName}`);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });
}

/**
 * Nimmt eine Einladung mit dem angemeldeten (bestehenden) Konto an.
 * Die Antwort enthält bereits Tokens für die neue Organisation → wie ein
 * Organisationswechsel behandeln.
 */
export function useAcceptInviteExisting() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (token: string) => authApi.acceptInviteExisting(token),
    onSuccess: (response) => {
      const org = orgFromAuthResponse(response);
      queryClient.clear();
      useAuthStore.getState().setAuthWithOrg(response, org);
      if (org) {
        broadcastAuthEvent({
          type: "org-switched",
          organizationId: org.organizationId,
        });
        toast.success(`Willkommen bei ${org.organizationName}`);
      }
      navigate(org ? "/tournaments" : "/onboarding", { replace: true });
    },
  });
}
