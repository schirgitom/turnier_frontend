import { Outlet, NavLink, useNavigate, Navigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  LogOut,
  User,
  ChevronDown,
  LayoutDashboard,
  ArrowLeftRight,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useLogout } from "@/hooks/useAuth";
import { getMyOrganizations } from "@/api/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function AppLayout() {
  const navigate = useNavigate();
  const { user, activeOrg, setActiveOrg } = useAuthStore();
  const logoutMutation = useLogout();

  const { data: memberships } = useQuery({
    queryKey: ["my-organizations"],
    queryFn: () => getMyOrganizations(),
  });

  if (!activeOrg) {
    return <Navigate to="/onboarding" replace />;
  }

  const initials = user?.displayName
    ? user.displayName
        .split(/\s+/)
        .map((w) => w.charAt(0))
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  return (
    <div className="flex h-screen">
      <aside className="flex w-64 flex-col border-r border-sidebar-border bg-sidebar-background text-sidebar-foreground">
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/95 p-1.5 shadow-sm ring-1 ring-white/15">
            <img
              src="/logo.png"
              alt="Victora"
              className="h-full w-full object-contain"
            />
          </div>
          {activeOrg && (
            <span className="ml-auto text-xs text-[rgba(255,255,255,0.4)]">
              {activeOrg.organizationName}
            </span>
          )}
        </div>

        {memberships && memberships.length > 1 && (
          <div className="border-b border-sidebar-border p-3">
            <Select
              value={activeOrg?.organizationId ?? ""}
              onValueChange={(value) => {
                const org = memberships.find(
                  (m) => m.organizationId === value,
                );
                if (org) setActiveOrg(org);
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Organisation" />
              </SelectTrigger>
              <SelectContent>
                {memberships.map((m) => (
                  <SelectItem
                    key={m.organizationId}
                    value={m.organizationId}
                  >
                    {m.organizationName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <nav className="flex-1 space-y-1 p-3">
          <NavLink
            to="/tournaments"
            end
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-[#AF5574] text-white"
                  : "text-[rgba(255,255,255,0.65)] hover:bg-[rgba(175,85,116,0.3)]",
              )
            }
          >
            <LayoutDashboard className="h-4 w-4" />
            Turniere
          </NavLink>
        </nav>

        <div className="border-t border-[rgba(255,255,255,0.1)]" />

        <div className="p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 px-2 text-[rgba(255,255,255,0.65)] hover:bg-[rgba(175,85,116,0.3)] hover:text-white"
              >
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-[#AF5574] text-xs text-white">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex flex-1 flex-col truncate text-left">
                  <span className="truncate text-sm">{user?.displayName}</span>
                  <span className="truncate text-xs text-[rgba(255,255,255,0.4)]">
                    {user?.email}
                  </span>
                </div>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{user?.displayName}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                  {activeOrg && (
                    <p className="text-xs text-muted-foreground">
                      Org: {activeOrg.organizationName}
                    </p>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/account")}>
                <User className="mr-2 h-4 w-4" />
                Konto bearbeiten
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/onboarding")}>
                <ArrowLeftRight className="mr-2 h-4 w-4" />
                Organisation wechseln
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => logoutMutation.mutate()}
                className="text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Abmelden
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
