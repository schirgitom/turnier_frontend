import { useState } from "react";
import { useNavigate } from "react-router";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Building2, Clock, Loader2, LogOut } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useLogout } from "@/hooks/useAuth";
import { createOrganization } from "@/api/organizations";
import { getMyOrganizations } from "@/api/auth";
import { getApiErrorMessage } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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

const createOrgSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
  slug: z.string().min(1, "Slug ist erforderlich"),
});

type CreateOrgForm = z.infer<typeof createOrgSchema>;

function LogoutButton() {
  const logoutMutation = useLogout();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => logoutMutation.mutate()}
      disabled={logoutMutation.isPending}
    >
      <LogOut className="mr-2 h-4 w-4" />
      Abmelden
    </Button>
  );
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const setActiveOrg = useAuthStore((s) => s.setActiveOrg);
  const user = useAuthStore((s) => s.user);
  const [mode, setMode] = useState<"choose" | "create" | "wait">("choose");

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<CreateOrgForm>({
    resolver: zodResolver(createOrgSchema),
  });

  const name = useWatch({ control, name: "name" }) ?? "";
  const slugValue = useWatch({ control, name: "slug" }) ?? "";

  const autoSlug = toSlug(name);
  const showAutoSlug = slugValue === "" || slugValue === toSlug(name);

  const createMutation = useMutation({
    mutationFn: (data: CreateOrgForm) => createOrganization(data),
    onSuccess: async () => {
      const orgs = await getMyOrganizations();
      if (orgs.length > 0) {
        setActiveOrg(orgs[0]!);
      }
      navigate("/tournaments");
    },
  });

  const onSubmit = (data: CreateOrgForm) => {
    const finalSlug = data.slug || toSlug(data.name);
    createMutation.mutate({ name: data.name, slug: finalSlug });
  };

  const displayName = user?.displayName || "";

  if (mode === "choose") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
        <div className="absolute right-4 top-4">
          <LogoutButton />
        </div>
        <div className="w-full max-w-2xl space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold">
              {displayName
                ? `Willkommen, ${displayName}!`
                : "Willkommen!"}
            </h1>
            <p className="mt-2 text-muted-foreground">
              Du bist noch keiner Organisation zugeordnet. Wie möchtest du
              fortfahren?
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => {
                setMode("create");
                setValue("slug", "");
              }}
            >
              <CardHeader className="text-center">
                <Building2 className="mx-auto h-10 w-10 text-primary" />
                <CardTitle className="text-lg">
                  Neue Organisation erstellen
                </CardTitle>
                <CardDescription>
                  Erstelle eine eigene Organisation und lade dein Team ein.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => setMode("wait")}
            >
              <CardHeader className="text-center">
                <Clock className="mx-auto h-10 w-10 text-muted-foreground" />
                <CardTitle className="text-lg">
                  Warte auf Einladung
                </CardTitle>
                <CardDescription>
                  Warte, bis ein Admin dich zu einer Organisation einlädt.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "wait") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
        <div className="absolute right-4 top-4">
          <LogoutButton />
        </div>
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Clock className="mx-auto h-10 w-10 text-muted-foreground" />
            <CardTitle>Warte auf Einladung</CardTitle>
            <CardDescription>
              Du wirst per E-Mail eingeladen, sobald ein Admin dich hinzufügt.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button variant="outline" onClick={() => setMode("choose")}>
              Zurück
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="absolute right-4 top-4">
        <LogoutButton />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Organisation erstellen</CardTitle>
          <CardDescription>
            Gib deiner Organisation einen Namen.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {createMutation.isError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {getApiErrorMessage(createMutation.error)}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Organisationsname</Label>
              <Input
                id="name"
                placeholder="z.B. Sportverein Musterstadt"
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
          </CardContent>
          <CardContent className="flex flex-col gap-3 pt-0">
            <Button
              type="submit"
              className="w-full"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Organisation erstellen
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setMode("choose")}
            >
              Zurück
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
