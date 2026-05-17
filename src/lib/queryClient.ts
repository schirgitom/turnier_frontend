import { QueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30 * 1000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (error) => {
        if (
          typeof error === "object" &&
          error !== null &&
          "response" in error
        ) {
          const res = (error as { response?: { status?: number } }).response;
          if (res?.status === 401) {
            useAuthStore.getState().logout();
          }
        }
      },
    },
  },
});
