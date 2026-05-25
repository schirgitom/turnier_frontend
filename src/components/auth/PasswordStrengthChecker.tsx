import { CircleCheck, CircleX } from "lucide-react";
import { cn } from "@/lib/utils";

const criteria = [
  {
    label: "Groß- und Kleinbuchstaben",
    test: (pw: string) => /[a-z]/.test(pw) && /[A-Z]/.test(pw),
  },
  {
    label: "Zahl (0-9)",
    test: (pw: string) => /[0-9]/.test(pw),
  },
  {
    label: "Sonderzeichen (!@#$%^&*...)",
    test: (pw: string) => /[^a-zA-Z0-9]/.test(pw),
  },
  {
    label: "Mindestens 8 Zeichen",
    test: (pw: string) => pw.length >= 8,
  },
] as const;

const strengthConfig = [
  { label: "Schwach", color: "bg-red-500", width: "w-1/4" },
  { label: "Schwach", color: "bg-red-500", width: "w-1/4" },
  { label: "Schwach", color: "bg-orange-500", width: "w-2/4" },
  { label: "Mittel", color: "bg-yellow-500", width: "w-3/4" },
  { label: "Stark", color: "bg-green-500", width: "w-full" },
] as const;

export function PasswordStrengthChecker({ password }: { password: string }) {
  const results = criteria.map((c) => c.test(password));
  const met = results.filter(Boolean).length;
  const config = strengthConfig[met]!;

  return (
    <div className="rounded-lg bg-muted/50 p-3 space-y-3">
      <div className="space-y-1">
        <div className="h-1.5 w-full rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              config.color,
              config.width,
            )}
          />
        </div>
        <p
          className={cn(
            "text-xs font-medium",
            met <= 2
              ? "text-red-500"
              : met === 3
                ? "text-yellow-600"
                : "text-green-600",
          )}
        >
          {config.label}
        </p>
      </div>

      <ul className="space-y-1.5">
        {criteria.map((c, i) => {
          const pass = results[i];
          return (
            <li key={c.label} className="flex items-center gap-2 text-sm">
              {pass ? (
                <CircleCheck className="h-4 w-4 shrink-0 text-green-600" />
              ) : (
                <CircleX className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <span
                className={cn(
                  pass ? "text-green-600" : "text-muted-foreground",
                )}
              >
                {c.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
