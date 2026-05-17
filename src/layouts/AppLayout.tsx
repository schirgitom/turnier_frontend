import { Outlet, NavLink, useNavigate, Navigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Trophy,
  LogOut,
  User,
  ChevronDown,
  LayoutDashboard,
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
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export function AppLayout() {
  const navigate = useNavigate();
  const { user, activeOrg, setActiveOrg } = useAuthStore();
  const logoutMutation = useLogout();

  const { data: memberships } = useQuery({
    queryKey: ["my-organizations"],
    queryFn: getMyOrganizations,
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
      <aside className="flex w-64 flex-col border-r bg-sidebar-background">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Trophy className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold">Turnierplaner</span>
        </div>

        {memberships && memberships.length > 1 && (
          <div className="border-b p-3">
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
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground",
              )
            }
          >
            <LayoutDashboard className="h-4 w-4" />
            Turniere
          </NavLink>
        </nav>

        <Separator />

        <div className="p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 px-2"
              >
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <span className="flex-1 truncate text-left text-sm">
                  {user?.displayName}
                </span>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{user?.displayName}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/account")}>
                <User className="mr-2 h-4 w-4" />
                Konto bearbeiten
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
