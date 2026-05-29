import type { ReactNode } from "react";
import { Check, Settings, Play, Trophy, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const STATUS_TO_IDX: Record<string, number> = {
  Preparation: 0,
  InProgress: 1,
  Completed: 2,
};

const STEPS = [
  {
    label: "In Vorbereitung",
    icon: Settings,
    description: [
      { ok: true, text: "Turnier bearbeiten" },
      { ok: true, text: "Teilnehmer hinzufügen & entfernen" },
      { ok: true, text: "Phasen konfigurieren & generieren" },
      { ok: true, text: "Gruppenverteilung anpassen" },
    ],
  },
  {
    label: "Laufend",
    icon: Play,
    description: [
      { ok: true, text: "Ergebnisse eintragen" },
      { ok: true, text: "Plätze ändern" },
      { ok: true, text: "Standings verfolgen" },
      { ok: false, text: "Keine Teilnehmer- oder Phasenänderungen" },
    ],
  },
  {
    label: "Abgeschlossen",
    icon: Trophy,
    description: [
      { ok: true, text: "Ergebnisse & Auswertung einsehen" },
      { ok: false, text: "Keine Änderungen möglich" },
    ],
  },
] as const;

export interface TimelineWarnings {
  [stepIdx: number]: string[];
}

export interface MatchProgress {
  completed: number;
  total: number;
}

interface TimelineProps {
  status: string;
  warnings?: TimelineWarnings;
  matchProgress?: MatchProgress;
}

function WarningTooltip({ children, warnings }: { children: ReactNode; warnings: string[] }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="cursor-default">{children}</div>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        className="max-w-xs whitespace-normal bg-amber-600 border-amber-700 text-white"
      >
        <ul className="space-y-1 py-0.5">
          {warnings.map((w, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs">
              <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span>{w}</span>
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}

function StepCircle({
  step,
  state,
  hasWarning,
}: {
  step: (typeof STEPS)[number];
  state: "completed" | "active" | "future";
  hasWarning?: boolean;
}) {
  const Icon = step.icon;
  return (
    <div className="relative flex items-center justify-center">
      {state === "active" && (
        <span className="absolute inline-flex h-10 w-10 rounded-full bg-primary opacity-25 animate-ping" />
      )}
      <div
        className={cn(
          "relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors",
          state === "completed" && "border-primary bg-primary text-primary-foreground",
          state === "active" && "border-primary bg-primary text-primary-foreground",
          state === "future" && "border-muted-foreground/40 bg-background text-muted-foreground",
        )}
      >
        {state === "completed" ? (
          <Check className="h-4 w-4" />
        ) : (
          <Icon className="h-4 w-4" />
        )}
      </div>
      {hasWarning && (
        <span className="absolute -top-1 -right-1 z-20 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 shadow-sm">
          <AlertTriangle className="h-2.5 w-2.5 text-white" />
        </span>
      )}
    </div>
  );
}

function Connector({ solid }: { solid: boolean }) {
  return (
    <div className="flex-1 flex items-center px-1">
      <div
        className={cn(
          "h-0.5 w-full",
          solid ? "bg-primary" : "border-t-2 border-dashed border-muted-foreground/30",
        )}
      />
    </div>
  );
}

function InlineWarnings({ stepWarnings }: { stepWarnings: string[] }) {
  return (
    <ul className="mt-1 space-y-0.5">
      {stepWarnings.map((w, i) => (
        <li key={i} className="flex items-start gap-1 text-xs text-amber-600">
          <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span>{w}</span>
        </li>
      ))}
    </ul>
  );
}

export function TournamentStatusTimeline({
  status,
  warnings = {},
  matchProgress,
}: TimelineProps) {
  const cancelled = status === "Cancelled";
  const activeIdx = cancelled ? -1 : (STATUS_TO_IDX[status] ?? 0);

  return (
    <TooltipProvider>
      <div className="relative w-full">
        {/* Horizontal layout (md+) */}
        <div className="hidden md:block">
          {/* Circles + connectors row */}
          <div className="flex items-center">
            {STEPS.map((step, idx) => {
              const state = cancelled
                ? "future"
                : idx < activeIdx
                ? "completed"
                : idx === activeIdx
                ? "active"
                : "future";
              const stepWarnings = warnings[idx];
              const hasWarning = !!stepWarnings && stepWarnings.length > 0;
              const circle = <StepCircle step={step} state={state} hasWarning={hasWarning} />;
              return (
                <div key={step.label} className="flex items-center flex-1 last:flex-none">
                  {hasWarning ? (
                    <WarningTooltip warnings={stepWarnings}>{circle}</WarningTooltip>
                  ) : (
                    circle
                  )}
                  {idx < STEPS.length - 1 && (
                    <Connector solid={!cancelled && idx < activeIdx} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Labels + description row */}
          <div className="mt-3 flex">
            {STEPS.map((step, idx) => {
              const isActive = !cancelled && idx === activeIdx;
              const isPast = !cancelled && idx < activeIdx;
              const stepWarnings = warnings[idx];
              const showMatchProgress = matchProgress && idx === 1 && isActive;
              return (
                <div key={step.label} className="flex-1 pr-2 last:pr-0">
                  <p
                    className={cn(
                      "text-xs font-semibold",
                      isActive && "text-primary",
                      isPast && "text-foreground",
                      !isActive && !isPast && "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {step.description.map((item) => (
                      <li
                        key={item.text}
                        className={cn(
                          "text-xs",
                          item.ok ? "text-muted-foreground" : "text-muted-foreground/50",
                        )}
                      >
                        {item.ok ? "✓" : "✗"} {item.text}
                      </li>
                    ))}
                    {showMatchProgress && (
                      <li className="text-xs text-muted-foreground">
                        ◎ {matchProgress.completed} / {matchProgress.total} Matches abgeschlossen
                      </li>
                    )}
                  </ul>
                  {stepWarnings && stepWarnings.length > 0 && (
                    <InlineWarnings stepWarnings={stepWarnings} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Vertical layout (mobile) */}
        <div className="flex flex-col gap-0 md:hidden">
          {STEPS.map((step, idx) => {
            const state = cancelled
              ? "future"
              : idx < activeIdx
              ? "completed"
              : idx === activeIdx
              ? "active"
              : "future";
            const isLast = idx === STEPS.length - 1;
            const isActive = !cancelled && idx === activeIdx;
            const isPast = !cancelled && idx < activeIdx;
            const stepWarnings = warnings[idx];
            const hasWarning = !!stepWarnings && stepWarnings.length > 0;
            const showMatchProgress = matchProgress && idx === 1 && isActive;
            const circleEl = <StepCircle step={step} state={state} hasWarning={hasWarning} />;
            return (
              <div key={step.label} className="flex gap-3">
                {/* Left: circle + vertical connector */}
                <div className="flex flex-col items-center">
                  {hasWarning ? (
                    <WarningTooltip warnings={stepWarnings}>{circleEl}</WarningTooltip>
                  ) : (
                    circleEl
                  )}
                  {!isLast && (
                    <div
                      className={cn(
                        "w-0.5 flex-1 my-1",
                        !cancelled && idx < activeIdx
                          ? "bg-primary"
                          : "border-l-2 border-dashed border-muted-foreground/30",
                      )}
                    />
                  )}
                </div>
                {/* Right: label + description */}
                <div className="pb-4">
                  <p
                    className={cn(
                      "text-sm font-semibold leading-10",
                      isActive && "text-primary",
                      isPast && "text-foreground",
                      !isActive && !isPast && "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </p>
                  <ul className="space-y-0.5 -mt-2">
                    {step.description.map((item) => (
                      <li
                        key={item.text}
                        className={cn(
                          "text-xs",
                          item.ok ? "text-muted-foreground" : "text-muted-foreground/50",
                        )}
                      >
                        {item.ok ? "✓" : "✗"} {item.text}
                      </li>
                    ))}
                    {showMatchProgress && (
                      <li className="text-xs text-muted-foreground">
                        ◎ {matchProgress.completed} / {matchProgress.total} Matches abgeschlossen
                      </li>
                    )}
                  </ul>
                  {stepWarnings && stepWarnings.length > 0 && (
                    <InlineWarnings stepWarnings={stepWarnings} />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Cancelled overlay */}
        {cancelled && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Badge variant="destructive" className="text-sm px-4 py-1.5 shadow-md">
              Abgesagt
            </Badge>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
