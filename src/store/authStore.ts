import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthResponse, UserDto, OrgMembershipDto } from "@/types/auth";

interface AuthState {
  user: UserDto | null;
  accessToken: string | null;
  refreshToken: string | null;
  activeOrg: OrgMembershipDto | null;

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

      setAuth: (response) => {
        const user: UserDto = {
          id: response.userId,
          email: response.email,
          displayName: response.displayName,
        };
        set({
          user,
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
          activeOrg: get().activeOrg,
        });
      },

      setAuthWithOrg: (response, org) => {
        const user: UserDto = {
          id: response.userId,
          email: response.email,
          displayName: response.displayName,
        };
        set({
          user,
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
          activeOrg: org,
        });
      },

      setTokens: (accessToken, refreshToken) => {
        set({ accessToken, refreshToken });
      },

      setActiveOrg: (org) => {
        set({ activeOrg: org });
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
      }),
    },
  ),
);
