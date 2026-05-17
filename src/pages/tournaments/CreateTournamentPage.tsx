import { useNavigate } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, ArrowLeft } from "lucide-react";
import { createTournament } from "@/api/tournaments";
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
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

const createSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
  slug: z.string().min(1, "Slug ist erforderlich"),
  description: z.string().optional(),
  location: z.string().optional(),
  startDate: z.string().min(1, "Startdatum ist erforderlich"),
  endDate: z.string().min(1, "Enddatum ist erforderlich"),
  maxParticipants: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null)),
  minParticipants: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null)),
  sportCode: z.string().min(1, "Sportart ist erforderlich"),
  formatType: z.string().min(1, "Format ist erforderlich"),
  seeding: z.boolean(),
  visibility: z.string().min(1, "Sichtbarkeit ist erforderlich"),
});

type CreateForm = z.infer<typeof createSchema>;

export function CreateTournamentPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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
    formState: { errors },
  } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      seeding: false,
      sportCode: "",
      formatType: "",
      visibility: "Private",
      slug: "",
    },
  });

  const name = useWatch({ control, name: "name" }) ?? "";
  const slugValue = useWatch({ control, name: "slug" }) ?? "";
  const autoSlug = toSlug(name);
  const showAutoSlug = slugValue === "" || slugValue === autoSlug;

  const onSubmit = (data: CreateForm) => {
    mutation.mutate({
      name: data.name,
      slug: data.slug || toSlug(data.name),
      description: data.description,
      location: data.location,
      startDate: data.startDate,
      endDate: data.endDate,
      maxParticipants: data.maxParticipants,
      minParticipants: data.minParticipants,
      sportCode: data.sportCode,
      formatType: data.formatType,
      seeding: data.seeding,
      visibility: data.visibility,
    });
  };

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => navigate("/tournaments")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Zurück
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Neues Turnier erstellen</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {mutation.isError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {getApiErrorMessage(mutation.error)}
              </div>
            )}
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
              {errors.slug && (
                <p className="text-sm text-destructive">
                  {errors.slug.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Beschreibung</Label>
              <Input
                id="description"
                placeholder="Optional"
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Startdatum</Label>
                <Input id="startDate" type="date" {...register("startDate")} />
                {errors.startDate && (
                  <p className="text-sm text-destructive">
                    {errors.startDate.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Enddatum</Label>
                <Input id="endDate" type="date" {...register("endDate")} />
                {errors.endDate && (
                  <p className="text-sm text-destructive">
                    {errors.endDate.message}
                  </p>
                )}
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
                  {...register("maxParticipants")}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sportart</Label>
                <Select
                  onValueChange={(v) => setValue("sportCode", v)}
                  defaultValue=""
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="badminton">Badminton</SelectItem>
                    <SelectItem value="tabletennis">Tischtennis</SelectItem>
                    <SelectItem value="tennis">Tennis</SelectItem>
                    <SelectItem value="volleyball">Volleyball</SelectItem>
                    <SelectItem value="football">Fußball</SelectItem>
                    <SelectItem value="other">Andere</SelectItem>
                  </SelectContent>
                </Select>
                {errors.sportCode && (
                  <p className="text-sm text-destructive">
                    {errors.sportCode.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Format</Label>
                <Select
                  onValueChange={(v) => setValue("formatType", v)}
                  defaultValue=""
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SingleElimination">
                      K.O.-System
                    </SelectItem>
                    <SelectItem value="DoubleElimination">
                      Doppeltes K.O.
                    </SelectItem>
                    <SelectItem value="RoundRobin">Jeder-gegen-Jeden</SelectItem>
                    <SelectItem value="Swiss">Schweizer System</SelectItem>
                    <SelectItem value="GroupStage">Gruppenphase</SelectItem>
                  </SelectContent>
                </Select>
                {errors.formatType && (
                  <p className="text-sm text-destructive">
                    {errors.formatType.message}
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sichtbarkeit</Label>
                <Select
                  onValueChange={(v) => setValue("visibility", v)}
                  defaultValue="Private"
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Private">Privat</SelectItem>
                    <SelectItem value="Public">Öffentlich</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    {...register("seeding")}
                    className="h-4 w-4 rounded border"
                  />
                  Setzliste verwenden
                </label>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              className="w-full"
              disabled={mutation.isPending}
            >
              {mutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Turnier erstellen
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
