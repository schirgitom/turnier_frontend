import { Outlet } from "react-router";

export function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2">
          <img src="/logo.png" alt="Victora" style={{ height: 48, width: "auto" }} />
        </div>
        <Outlet />
      </div>
    </div>
  );
}
