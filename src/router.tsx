import { createBrowserRouter, redirect } from "react-router";
import { useAuthStore } from "@/store/authStore";
import { RootLayout } from "@/layouts/RootLayout";
import { AuthLayout } from "@/layouts/AuthLayout";
import { AppLayout } from "@/layouts/AppLayout";
import { LoginPage } from "@/pages/auth/LoginPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";
import { RegisterOrgPage } from "@/pages/auth/RegisterOrgPage";
import { InviteAcceptPage } from "@/pages/auth/InviteAcceptPage";
import { OnboardingPage } from "@/pages/auth/OnboardingPage";
import { TournamentsPage } from "@/pages/tournaments/TournamentsPage";
import { CreateTournamentPage } from "@/pages/tournaments/CreateTournamentPage";
import { TournamentLayout } from "@/pages/tournaments/TournamentLayout";
import { TournamentDashboardPage } from "@/pages/tournaments/TournamentDashboardPage";
import { TournamentSettingsPage } from "@/pages/tournaments/TournamentSettingsPage";
import { ParticipantsPage } from "@/pages/tournaments/ParticipantsPage";
import { VenuesPage } from "@/pages/tournaments/VenuesPage";
import { PhasesPage } from "@/pages/tournaments/PhasesPage";
import { MatchesPage } from "@/pages/tournaments/MatchesPage";
import { StandingsPage } from "@/pages/tournaments/StandingsPage";
import { DisplayPage } from "@/pages/display/DisplayPage";
import { InfoPage } from "@/pages/display/InfoPage";
import { AccountPage } from "@/pages/account/AccountPage";

function requireAuth() {
  const { refreshToken } = useAuthStore.getState();
  if (!refreshToken) {
    return redirect("/login");
  }
  return null;
}

function redirectIfAuthed() {
  const { refreshToken } = useAuthStore.getState();
  if (refreshToken) {
    return redirect("/tournaments");
  }
  return null;
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        element: <AuthLayout />,
        loader: redirectIfAuthed,
        children: [
          { path: "/login", element: <LoginPage /> },
          { path: "/register", element: <RegisterPage /> },
          { path: "/register-organization", element: <RegisterOrgPage /> },
          { path: "/invite/:token", element: <InviteAcceptPage /> },
        ],
      },
      {
        path: "/onboarding",
        loader: requireAuth,
        element: <OnboardingPage />,
      },
      {
        element: <AppLayout />,
        loader: requireAuth,
        children: [
          { index: true, loader: () => redirect("/tournaments") },
          { path: "/account", element: <AccountPage /> },
          { path: "/tournaments", element: <TournamentsPage /> },
          { path: "/tournaments/new", element: <CreateTournamentPage /> },
          {
            path: "/t/:tournamentId",
            element: <TournamentLayout />,
            children: [
              { index: true, element: <TournamentDashboardPage /> },
              { path: "dashboard", element: <TournamentDashboardPage /> },
              { path: "settings", element: <TournamentSettingsPage /> },
              { path: "participants", element: <ParticipantsPage /> },
              { path: "venues", element: <VenuesPage /> },
              { path: "phases", element: <PhasesPage /> },
              { path: "matches", element: <MatchesPage /> },
              { path: "standings", element: <StandingsPage /> },
            ],
          },
        ],
      },
      {
        path: "/display/:tournamentId",
        element: <DisplayPage />,
      },
      {
        path: "/info/:tournamentId",
        element: <InfoPage />,
      },
    ],
  },
]);
