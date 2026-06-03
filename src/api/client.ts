import axios from "axios";
import { useAuthStore } from "@/store/authStore";
import { getAppConfig } from "@/lib/runtimeConfig";

const appConfig = getAppConfig();
const apiPrefix = appConfig.apiPrefix;
const publicApiPrefix = appConfig.publicApiPrefix;

export const apiClient = axios.create({
  baseURL: apiPrefix,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

function onRefreshFailed() {
  refreshSubscribers = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status !== 401 ||
      originalRequest._retry ||
      originalRequest.url?.includes("/auth/refresh") ||
      originalRequest.url?.includes("/auth/login")
    ) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve) => {
        subscribeTokenRefresh((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          resolve(apiClient(originalRequest));
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    const { refreshToken } = useAuthStore.getState();

    if (!refreshToken) {
      isRefreshing = false;
      useAuthStore.getState().logout();
      window.location.href = "/login";
      return Promise.reject(error);
    }

    try {
      const response = await axios.post(`${apiPrefix}/auth/refresh`, {
        refreshToken,
      });
      const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
        response.data;

      useAuthStore.getState().setTokens(newAccessToken, newRefreshToken);

      isRefreshing = false;
      onTokenRefreshed(newAccessToken);

      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return apiClient(originalRequest);
    } catch {
      isRefreshing = false;
      onRefreshFailed();
      useAuthStore.getState().logout();
      window.location.href = "/login";
      return Promise.reject(error);
    }
  },
);

/**
 * Unauthenticated client for public endpoints (no /api prefix, no Bearer token).
 */
export const publicApiClient = axios.create({
  baseURL: publicApiPrefix,
  headers: {
    "Content-Type": "application/json",
  },
});

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (data?.detail) return data.detail;
    if (data?.message) return data.message;
    if (data?.title) return data.title;
    if (typeof data === "string") return data;
  }
  return "Ein unbekannter Fehler ist aufgetreten.";
}
