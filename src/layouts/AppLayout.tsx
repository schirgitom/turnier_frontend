import { useState } from "react";
import { Outlet, NavLink, Link, useNavigate, Navigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  LogOut,
  User,
  ChevronDown,
  LayoutDashboard,
  Building2,
  Check,
  Plus,
  Loader2,
  UserPlus,
  Users,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useLogout, useSwitchOrganization } from "@/hooks/useAuth";
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
import { cn } from "@/lib/utils";
import { roleLabel } from "@/types/auth";
import { InviteUserDialog } from "@/components/organization/InviteUserDialog";
import { AddExistingMemberDialog } from "@/components/organization/AddExistingMemberDialog";

const ADMIN_ROLES = ["Admin", "Owner"];

const navItems = [
  { to: "/tournaments", label: "Turniere", icon: LayoutDashboard },
];

export function AppLayout() {
  const navigate = useNavigate();
  const { user, activeOrg } = useAuthStore();
  const logoutMutation = useLogout();
  const switchMutation = useSwitchOrganization();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);

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

  const canInvite = ADMIN_ROLES.includes(activeOrg.role);
  const visibleNavItems = canInvite
    ? [...navItems, { to: "/members", label: "Mitglieder", icon: Users }]
    : navItems;

  const headerButton =
    "gap-2 text-[rgba(255,255,255,0.8)] hover:bg-sidebar-accent hover:text-white";

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-16 shrink-0 items-center gap-4 border-b border-sidebar-border bg-sidebar-background px-4 text-sidebar-foreground">
        <Link to="/tournaments" className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/95 p-1.5 shadow-sm ring-1 ring-white/15">
            <img
              src="/logo.png"
              alt="Victora"
              className="h-full w-full object-contain"
            />
          </div>
        </Link>

        <nav className="flex items-center gap-1">
          {visibleNavItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[#AF5574] text-white"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white",
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* Organisation */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(headerButton, "max-w-xs")}
                disabled={switchMutation.isPending}
              >
                {switchMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Building2 className="h-4 w-4" />
                )}
                <span className="hidden truncate text-sm sm:inline">
                  {activeOrg.organizationName}
                </span>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                Organisation
              </DropdownMenuLabel>
              {(memberships ?? []).map((m) => {
                const isActive = m.organizationId === activeOrg.organizationId;
                return (
                  <DropdownMenuItem
                    key={m.organizationId}
                    onClick={() => {
                      if (!isActive) switchMutation.mutate(m.organizationId);
                    }}
                  >
                    <Check
                      className={cn(
                        "h-4 w-4",
                        isActive ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="flex-1 truncate">{m.organizationName}</span>
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
              {canInvite && (
                <DropdownMenuItem onClick={() => setInviteOpen(true)}>
                  <UserPlus className="h-4 w-4" />
                  Person einladen
                </DropdownMenuItem>
              )}
              {canInvite && (
                <DropdownMenuItem onClick={() => setAddMemberOpen(true)}>
                  <UserPlus className="h-4 w-4" />
                  Bestehenden Benutzer hinzufügen
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => navigate("/onboarding")}>
                <Plus className="h-4 w-4" />
                Organisation erstellen / beitreten
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Benutzer */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className={cn(headerButton, "px-2")}>
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-[#AF5574] text-xs text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden text-sm md:inline">
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
                  <p className="text-xs text-muted-foreground">
                    {activeOrg.organizationName}
                    {activeOrg.role ? ` · ${roleLabel(activeOrg.role)}` : ""}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/account")}>
                <User className="h-4 w-4" />
                Konto bearbeiten
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => logoutMutation.mutate()}
                className="text-destructive"
              >
                <LogOut className="h-4 w-4" />
                Abmelden
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      {canInvite && (
        <InviteUserDialog
          organizationName={activeOrg.organizationName}
          open={inviteOpen}
          onOpenChange={setInviteOpen}
        />
      )}
      {canInvite && (
        <AddExistingMemberDialog
          organizationName={activeOrg.organizationName}
          open={addMemberOpen}
          onOpenChange={setAddMemberOpen}
        />
      )}
    </div>
  );
}
