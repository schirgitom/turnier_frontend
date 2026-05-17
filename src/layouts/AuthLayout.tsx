import { Outlet } from "react-router";
import { Trophy } from "lucide-react";

export function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <Trophy className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Turnierplaner</h1>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
