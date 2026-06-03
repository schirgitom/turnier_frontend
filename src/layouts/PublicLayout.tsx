import { Outlet, Link } from "react-router";
import { Button } from "@/components/ui/button";

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="Victora" style={{ height: 28, width: "auto" }} />
          </Link>
          <Button variant="outline" size="sm" asChild>
            <Link to="/login">Anmelden</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        Powered by Victora
      </footer>
    </div>
  );
}
