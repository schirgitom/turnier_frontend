declare global {
  interface Window {
    __APP_CONFIG__?: {
      VITE_API_BASE_URL?: string;
      VITE_API_PREFIX?: string;
      VITE_PUBLIC_API_PREFIX?: string;
      VITE_HUB_URL?: string;
    };
  }
}

function getRuntimeValue(key: keyof NonNullable<Window["__APP_CONFIG__"]>): string | undefined {
  if (typeof window === "undefined") return undefined;
  const value = window.__APP_CONFIG__?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function getAppConfig() {
  return {
    apiBaseUrl: getRuntimeValue("VITE_API_BASE_URL") ?? import.meta.env.VITE_API_BASE_URL,
    apiPrefix: getRuntimeValue("VITE_API_PREFIX") ?? import.meta.env.VITE_API_PREFIX ?? "/api",
    publicApiPrefix:
      getRuntimeValue("VITE_PUBLIC_API_PREFIX") ?? import.meta.env.VITE_PUBLIC_API_PREFIX ?? "",
    hubUrl: getRuntimeValue("VITE_HUB_URL") ?? import.meta.env.VITE_HUB_URL ?? "/hubs/tournament",
  };
}

