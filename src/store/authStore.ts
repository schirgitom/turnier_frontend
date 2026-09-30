import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthResponse, UserDto, OrgMembershipDto } from "@/types/auth";
import { orgFromAuthResponse } from "@/types/auth";

function userFromResponse(response: AuthResponse, fallback: UserDto | null): UserDto | null {
  if (response.user) {
    return {
      id: response.user.id,
      email: response.user.email,
      displayName: response.user.displayName,
    };
  }
  if (response.userId) {
    return {
      id: response.userId,
      email: response.email ?? "",
      displayName: response.displayName ?? "",
    };
  }
  return fallback;
}

interface AuthState {
  user: UserDto | null;
  accessToken: string | null;
  refreshToken: string | null;
  activeOrg: OrgMembershipDto | null;
  /** Zuletzt verwendete Organisation – bleibt nach Logout erhalten (Vorauswahl beim Login). */
  lastOrgId: string | null;

  setAuth: (response: AuthResponse) => void;
  setAuthWithOrg: (response: AuthResponse, org: OrgMembershipDto | null) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setActiveOrg: (org: OrgMembershipDto | null) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      activeOrg: null,
      lastOrgId: null,

      setAuth: (response) => {
        // Org + Rolle aus dem Token übernehmen (Quelle der Wahrheit), sonst beibehalten.
        const org = orgFromAuthResponse(response) ?? get().activeOrg;
        set({
          user: userFromResponse(response, get().user),
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
          activeOrg: org,
        });
      },

      setAuthWithOrg: (response, org) => {
        set({
          user: userFromResponse(response, get().user),
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
          activeOrg: org,
          lastOrgId: org?.organizationId ?? get().lastOrgId,
        });
      },

      setTokens: (accessToken, refreshToken) => {
        set({ accessToken, refreshToken });
      },

      setActiveOrg: (org) => {
        set({ activeOrg: org, lastOrgId: org?.organizationId ?? get().lastOrgId });
      },

      logout: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          activeOrg: null,
        });
      },

      isAuthenticated: () => {
        return get().refreshToken !== null;
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        refreshToken: state.refreshToken,
        user: state.user,
        activeOrg: state.activeOrg,
        lastOrgId: state.lastOrgId,
      }),
    },
  ),
);
