import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import axios from "axios";
import { useAuthStore } from "@/store/authStore";
import * as authApi from "@/api/auth";
import type {
  LoginRequest,
  RegisterUserRequest,
  RegisterOrganizationRequest,
  OrgMembershipDto,
} from "@/types/auth";

export function useLogin() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: LoginRequest) => authApi.login(data),
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
    onError: (error) => {
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        navigate("/onboarding");
      }
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

      navigate(orgs.length > 0 ? "/tournaments" : "/onboarding");
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
  const { refreshToken, logout } = useAuthStore();

  return useMutation({
    mutationFn: async () => {
      if (refreshToken) {
        await authApi.revoke(refreshToken).catch(() => {});
      }
    },
    onSettled: () => {
      logout();
      navigate("/login");
    },
  });
}
