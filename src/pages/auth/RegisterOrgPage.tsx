import { Link } from "react-router";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { useRegisterOrganization } from "@/hooks/useAuth";
import { getApiErrorMessage } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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

const registerOrgSchema = z.object({
  adminDisplayName: z.string().min(1, "Anzeigename ist erforderlich"),
  adminEmail: z.string().email("Ungültige E-Mail-Adresse"),
  adminPassword: z
    .string()
    .min(8, "Passwort muss mindestens 8 Zeichen lang sein"),
  organizationName: z.string().min(1, "Organisationsname ist erforderlich"),
});

type RegisterOrgForm = z.infer<typeof registerOrgSchema>;

export function RegisterOrgPage() {
  const registerMutation = useRegisterOrganization();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<RegisterOrgForm>({
    resolver: zodResolver(registerOrgSchema),
  });

  const organizationName = useWatch({ control, name: "organizationName" }) ?? "";
  const slug = toSlug(organizationName);

  const onSubmit = (data: RegisterOrgForm) => {
    registerMutation.mutate({
      adminDisplayName: data.adminDisplayName,
      adminEmail: data.adminEmail,
      adminPassword: data.adminPassword,
      organizationName: data.organizationName,
      organizationSlug: toSlug(data.organizationName),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mit Organisation registrieren</CardTitle>
        <CardDescription>
          Erstelle dein Konto und deine Organisation in einem Schritt.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {registerMutation.isError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {getApiErrorMessage(registerMutation.error)}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="adminDisplayName">Anzeigename</Label>
            <Input id="adminDisplayName" {...register("adminDisplayName")} />
            {errors.adminDisplayName && (
              <p className="text-sm text-destructive">
                {errors.adminDisplayName.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="adminEmail">E-Mail</Label>
            <Input
              id="adminEmail"
              type="email"
              placeholder="name@beispiel.de"
              autoComplete="email"
              {...register("adminEmail")}
            />
            {errors.adminEmail && (
              <p className="text-sm text-destructive">
                {errors.adminEmail.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="adminPassword">Passwort</Label>
            <Input
              id="adminPassword"
              type="password"
              autoComplete="new-password"
              {...register("adminPassword")}
            />
            {errors.adminPassword && (
              <p className="text-sm text-destructive">
                {errors.adminPassword.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="organizationName">Organisationsname</Label>
            <Input
              id="organizationName"
              placeholder="z.B. Sportverein Musterstadt"
              {...register("organizationName")}
            />
            {errors.organizationName && (
              <p className="text-sm text-destructive">
                {errors.organizationName.message}
              </p>
            )}
          </div>
          {slug && (
            <div className="space-y-1">
              <Label className="text-muted-foreground">Slug (URL)</Label>
              <p className="rounded-md border bg-muted px-3 py-2 text-sm">
                {slug}
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button
            type="submit"
            className="w-full"
            disabled={registerMutation.isPending}
          >
            {registerMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Registrieren
          </Button>
          <div className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
            <p>
              Ohne Organisation?{" "}
              <Link to="/register" className="text-primary hover:underline">
                Einfach registrieren
              </Link>
            </p>
            <p>
              Bereits ein Konto?{" "}
              <Link to="/login" className="text-primary hover:underline">
                Anmelden
              </Link>
            </p>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
