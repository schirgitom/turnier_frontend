import { useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Loader2,
  ArrowLeft,
  ArrowRight,
  Users,
  Swords,
  Trophy,
  Layers,
  Check,
} from "lucide-react";
import { createTournament } from "@/api/tournaments";
import type { CreateTournamentRequest } from "@/types/tournament";
import { getApiErrorMessage } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const stepLabels = ["Grundlagen", "Zeitraum & Teilnehmer", "Format & Einstellungen"];

const sportOptions = [
  { value: "table_tennis", label: "Tischtennis" },
  { value: "tennis", label: "Tennis" },
  { value: "badminton", label: "Badminton" },
  { value: "volleyball", label: "Volleyball" },
  { value: "football", label: "Fußball" },
  { value: "basketball", label: "Basketball" },
  { value: "other", label: "Sonstiges" },
];

const formatOptions = [
  {
    value: "group",
    label: "Nur Gruppenphase",
    description: "Jeder spielt gegen jeden in seiner Gruppe. Kein Finale.",
    icon: Users,
  },
  {
    value: "elimination",
    label: "Nur K.O.-System",
    description: "Direkte Ausscheidung. Wer verliert, scheidet aus.",
    icon: Swords,
  },
  {
    value: "group_elimination",
    label: "Gruppenphase + K.O.",
    description: "Erst Gruppenspiele, dann Finalrunde mit den Besten.",
    icon: Layers,
  },
];

const createSchema = z
  .object({
    name: z.string().min(1, "Name ist erforderlich"),
    slug: z.string().min(1, "Slug ist erforderlich"),
    description: z.string().optional(),
    location: z.string().optional(),
    startDate: z.string().min(1, "Startdatum ist erforderlich"),
    startTime: z.string().min(1, "Startzeit ist erforderlich"),
    multiDay: z.boolean(),
    endDate: z.string(),
    maxParticipants: z.union([z.string(), z.number()]).optional().nullable(),
    minParticipants: z.union([z.string(), z.number()]).optional().nullable(),
    sportCode: z.string().min(1, "Sportart ist erforderlich"),
    formatType: z.string().min(1, "Format ist erforderlich"),
    advancingPerGroup: z.number().min(1).max(8).nullable(),
    seeding: z.boolean(),
    visibility: z.string().min(1, "Sichtbarkeit ist erforderlich"),
  })
  .refine(
    (d) => !d.multiDay || d.endDate.length > 0,
    {
      message: "Enddatum ist erforderlich",
      path: ["endDate"],
    },
  )
  .refine(
    (d) => !d.multiDay || d.endDate >= d.startDate,
    {
      message: "Enddatum muss nach dem Startdatum liegen",
      path: ["endDate"],
    },
  )
  .refine(
    (d) =>
      d.formatType !== "group_elimination" || d.advancingPerGroup !== null,
    {
      message: "Bitte wähle, wie viele Teams pro Gruppe weiterkommen",
      path: ["advancingPerGroup"],
    },
  );

type CreateForm = z.infer<typeof createSchema>;

const step1Fields = ["name", "slug"] as const;
const step2Fields = ["startDate", "startTime"] as const;
const step3Fields = ["sportCode", "formatType", "visibility"] as const;

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="mb-8 flex items-center justify-center gap-2">
      {stepLabels.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={cn(
                  "h-px w-8 sm:w-12",
                  done ? "bg-primary" : "bg-border",
                )}
              />
            )}
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium",
                  done && "bg-primary text-primary-foreground",
                  active && "border-2 border-primary text-primary",
                  !done && !active && "border border-border text-muted-foreground",
                )}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  "hidden text-sm sm:inline",
                  active ? "font-medium" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CreateTournamentPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);

  const mutation = useMutation({
    mutationFn: createTournament,
    onSuccess: (tournament) => {
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      navigate(`/t/${tournament.id}`);
    },
  });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      location: "",
      startDate: "",
      startTime: "",
      multiDay: false,
      endDate: "",
      seeding: false,
      sportCode: "",
      formatType: "",
      advancingPerGroup: null,
      visibility: "Private",
    },
  });

  const name = useWatch({ control, name: "name" }) ?? "";
  const slugValue = useWatch({ control, name: "slug" }) ?? "";
  const autoSlug = toSlug(name);
  const showAutoSlug = slugValue === "" || slugValue === autoSlug;

  const startDate = useWatch({ control, name: "startDate" }) ?? "";
  const multiDay = useWatch({ control, name: "multiDay" }) ?? false;
  const sportCode = useWatch({ control, name: "sportCode" }) ?? "";
  const formatType = useWatch({ control, name: "formatType" }) ?? "";
  const advancingPerGroup = useWatch({ control, name: "advancingPerGroup" });
  const visibility = useWatch({ control, name: "visibility" }) ?? "Private";
  const seeding = useWatch({ control, name: "seeding" }) ?? false;
  const [advancingMode, setAdvancingMode] = useState<"1" | "2" | "3" | "custom">("2");

  const goNext = async () => {
    if (step === 1) {
      const baseValid = await trigger([...step2Fields]);
      if (!baseValid) return;
      if (multiDay) {
        const endValid = await trigger(["endDate"]);
        if (!endValid) return;
      } else {
        setValue("endDate", startDate);
      }
      setStep((s) => s + 1);
      return;
    }
    const fields = step === 0 ? step1Fields : step3Fields;
    const valid = await trigger([...fields]);
    if (valid) setStep((s) => s + 1);
  };

  const goBack = () => setStep((s) => s - 1);

  const onSubmit = (data: CreateForm) => {
    const payload: CreateTournamentRequest = {
      name: data.name,
      slug: data.slug || toSlug(data.name),
      description: data.description || undefined,
      location: data.location,
      startDate: data.startDate,
      endDate: data.endDate,
      sportCode: data.sportCode,
      formatType: data.formatType,
      seeding: data.seeding,
      visibility: data.visibility,
      ...(data.minParticipants ? { minParticipants: Number(data.minParticipants) } : {}),
      ...(data.maxParticipants ? { maxParticipants: Number(data.maxParticipants) } : {}),
      ...(data.advancingPerGroup ? { advancingPerGroup: Number(data.advancingPerGroup) } : {}),
    };
    mutation.mutate(payload);
  };

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => navigate("/tournaments")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Zurück zur Übersicht
      </Button>

      <StepIndicator current={step} />

      <Card>
        <form onSubmit={handleSubmit(onSubmit)}>
          {step === 0 && (
            <>
              <CardHeader>
                <CardTitle>Grundlagen</CardTitle>
                <CardDescription>
                  Gib deinem Turnier einen Namen und eine Beschreibung.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="z.B. Stadtmeisterschaft 2026"
                    {...register("name", {
                      onChange: (e) => {
                        if (showAutoSlug) {
                          setValue("slug", toSlug(e.target.value));
                        }
                      },
                    })}
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive">
                      {errors.name.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug (URL)</Label>
                  <Input id="slug" {...register("slug")} />
                  {autoSlug && slugValue !== autoSlug && (
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => setValue("slug", autoSlug)}
                    >
                      Automatisch: {autoSlug}
                    </button>
                  )}
                  {errors.slug && (
                    <p className="text-sm text-destructive">
                      {errors.slug.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Beschreibung (optional)</Label>
                  <textarea
                    id="description"
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Worum geht es bei diesem Turnier?"
                    {...register("description")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Ort</Label>
                  <Input
                    id="location"
                    placeholder="z.B. Sporthalle Musterstadt"
                    {...register("location")}
                  />
                </div>
              </CardContent>
            </>
          )}

          {step === 1 && (
            <>
              <CardHeader>
                <CardTitle>Zeitraum & Teilnehmer</CardTitle>
                <CardDescription>
                  Lege den Zeitraum und die Teilnehmerzahl fest.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Startdatum</Label>
                    <Input
                      id="startDate"
                      type="date"
                      {...register("startDate")}
                    />
                    {errors.startDate && (
                      <p className="text-sm text-destructive">
                        {errors.startDate.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="startTime">Startzeit</Label>
                    <Input
                      id="startTime"
                      type="time"
                      {...register("startTime")}
                    />
                    {errors.startTime && (
                      <p className="text-sm text-destructive">
                        {errors.startTime.message}
                      </p>
                    )}
                  </div>
                </div>

                <label className="flex items-center gap-3 rounded-lg border p-3">
                  <input
                    type="checkbox"
                    checked={multiDay}
                    onChange={(e) => {
                      setValue("multiDay", e.target.checked);
                      if (!e.target.checked) {
                        setValue("endDate", startDate);
                      }
                    }}
                    className="h-4 w-4 rounded border"
                  />
                  <span className="text-sm font-medium">
                    Turnier geht über mehrere Tage
                  </span>
                </label>

                <div
                  className={cn(
                    "grid transition-all duration-300 ease-in-out",
                    multiDay
                      ? "grid-rows-[1fr] opacity-100"
                      : "grid-rows-[0fr] opacity-0",
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="space-y-2">
                      <Label htmlFor="endDate">Enddatum</Label>
                      <Input
                        id="endDate"
                        type="date"
                        min={startDate || undefined}
                        {...register("endDate")}
                      />
                      {errors.endDate && (
                        <p className="text-sm text-destructive">
                          {errors.endDate.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="minParticipants">
                      Min. Teilnehmer (optional)
                    </Label>
                    <Input
                      id="minParticipants"
                      type="number"
                      min={2}
                      placeholder="z.B. 4"
                      {...register("minParticipants")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxParticipants">
                      Max. Teilnehmer (optional)
                    </Label>
                    <Input
                      id="maxParticipants"
                      type="number"
                      min={2}
                      placeholder="z.B. 32"
                      {...register("maxParticipants")}
                    />
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {step === 2 && (
            <>
              <CardHeader>
                <CardTitle>Format & Einstellungen</CardTitle>
                <CardDescription>
                  Wähle Sportart, Turnierformat und Sichtbarkeit.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {mutation.isError && (
                  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    {getApiErrorMessage(mutation.error)}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Sportart</Label>
                  <Select
                    value={sportCode}
                    onValueChange={(v) => setValue("sportCode", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sportart auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {sportOptions.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.sportCode && (
                    <p className="text-sm text-destructive">
                      {errors.sportCode.message}
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <Label>Turnierformat</Label>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {formatOptions.map((opt) => {
                      const Icon = opt.icon;
                      const selected = formatType === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setValue("formatType", opt.value);
                            if (opt.value === "group_elimination") {
                              setAdvancingMode("2");
                              setValue("advancingPerGroup", 2);
                            } else {
                              setValue("advancingPerGroup", null);
                            }
                          }}
                          className={cn(
                            "flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-center transition-colors",
                            selected
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50",
                          )}
                        >
                          <Icon
                            className={cn(
                              "h-6 w-6",
                              selected
                                ? "text-primary"
                                : "text-muted-foreground",
                            )}
                          />
                          <span className="text-sm font-medium">
                            {opt.label}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {opt.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {errors.formatType && (
                    <p className="text-sm text-destructive">
                      {errors.formatType.message}
                    </p>
                  )}

                  <div
                    className={cn(
                      "grid transition-all duration-300 ease-in-out",
                      formatType === "group_elimination"
                        ? "grid-rows-[1fr] opacity-100"
                        : "grid-rows-[0fr] opacity-0",
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className="space-y-3 rounded-lg border bg-muted/30 p-4 mt-3">
                        <Label>Wer kommt weiter?</Label>
                        <div className="space-y-2">
                          {(
                            [
                              { mode: "1" as const, label: "Top 1 jeder Gruppe", value: 1 },
                              { mode: "2" as const, label: "Top 2 jeder Gruppe", value: 2 },
                              { mode: "3" as const, label: "Top 3 jeder Gruppe", value: 3 },
                            ]
                          ).map((opt) => (
                            <label
                              key={opt.mode}
                              className={cn(
                                "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 transition-colors",
                                advancingMode === opt.mode
                                  ? "border-primary bg-primary/5"
                                  : "border-transparent hover:bg-muted",
                              )}
                            >
                              <input
                                type="radio"
                                name="advancingMode"
                                checked={advancingMode === opt.mode}
                                onChange={() => {
                                  setAdvancingMode(opt.mode);
                                  setValue("advancingPerGroup", opt.value);
                                }}
                                className="h-4 w-4 accent-primary"
                              />
                              <span className="text-sm">{opt.label}</span>
                            </label>
                          ))}
                          <label
                            className={cn(
                              "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 transition-colors",
                              advancingMode === "custom"
                                ? "border-primary bg-primary/5"
                                : "border-transparent hover:bg-muted",
                            )}
                          >
                            <input
                              type="radio"
                              name="advancingMode"
                              checked={advancingMode === "custom"}
                              onChange={() => {
                                setAdvancingMode("custom");
                                setValue("advancingPerGroup", advancingPerGroup ?? 2);
                              }}
                              className="h-4 w-4 accent-primary"
                            />
                            <span className="text-sm">Benutzerdefiniert</span>
                            {advancingMode === "custom" && (
                              <Input
                                type="number"
                                min={1}
                                max={8}
                                value={advancingPerGroup ?? ""}
                                onChange={(e) => {
                                  const v = e.target.value ? Number(e.target.value) : null;
                                  setValue("advancingPerGroup", v);
                                }}
                                className="ml-auto h-8 w-20"
                              />
                            )}
                          </label>
                        </div>
                        {errors.advancingPerGroup && (
                          <p className="text-sm text-destructive">
                            {errors.advancingPerGroup.message}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Sichtbarkeit</Label>
                  <div className="flex gap-3">
                    {(
                      [
                        { value: "Private", label: "Privat" },
                        { value: "Public", label: "Öffentlich" },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setValue("visibility", opt.value)}
                        className={cn(
                          "flex-1 rounded-lg border-2 px-4 py-2 text-sm font-medium transition-colors",
                          visibility === opt.value
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border hover:border-primary/50",
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-center gap-3 rounded-lg border p-3">
                  <input
                    type="checkbox"
                    checked={seeding}
                    onChange={(e) => setValue("seeding", e.target.checked)}
                    className="h-4 w-4 rounded border"
                  />
                  <div>
                    <span className="text-sm font-medium">
                      Setzliste verwenden
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Teilnehmer werden nach Stärke gesetzt
                    </p>
                  </div>
                </label>
              </CardContent>
            </>
          )}

          <CardFooter className="flex justify-between gap-3">
            {step > 0 ? (
              <Button type="button" variant="outline" onClick={goBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Zurück
              </Button>
            ) : (
              <div />
            )}
            {step < 2 ? (
              <Button type="button" onClick={goNext}>
                Weiter
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trophy className="mr-2 h-4 w-4" />
                )}
                Turnier erstellen
              </Button>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
