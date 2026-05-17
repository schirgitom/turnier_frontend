import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { useAuthStore } from "@/store/authStore";
import { refreshTokens } from "@/api/auth";
import { router } from "@/router";
import "@/app.css";

async function initAuth() {
  const { refreshToken, accessToken } = useAuthStore.getState();
  if (refreshToken && !accessToken) {
    try {
      const response = await refreshTokens(refreshToken);
      useAuthStore.getState().setAuth(response);
    } catch {
      useAuthStore.getState().logout();
    }
  }
}

initAuth().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
});
