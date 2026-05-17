import { useState, useEffect, useCallback } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2 } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
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
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const PASSWORD_RULES = [
  /[A-Z]/,
  /[a-z]/,
  /[0-9]/,
  /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/,
] as const;

function getPasswordStrength(pw: string): number {
  return PASSWORD_RULES.filter((re) => re.test(pw)).length;
}

const strengthConfig = [
  null,
  { label: "Schwach", color: "bg-red-500", width: "w-1/4" },
  { label: "Schwach", color: "bg-red-500", width: "w-2/4" },
  { label: "Mittel", color: "bg-orange-500", width: "w-3/4" },
  { label: "Stark", color: "bg-green-500", width: "w-full" },
] as const;

const profileSchema = z.object({
  displayName: z.string().min(1, "Anzeigename ist erforderlich"),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Aktuelles Passwort ist erforderlich"),
    newPassword: z
      .string()
      .min(
        8,
        "Mindestens 8 Zeichen, Groß-/Kleinbuchstabe, Zahl und Sonderzeichen",
      )
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~])/,
        "Mindestens 8 Zeichen, Groß-/Kleinbuchstabe, Zahl und Sonderzeichen",
      ),
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwörter stimmen nicht überein",
    path: ["confirmNewPassword"],
  });

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

function useToast() {
  const [message, setMessage] = useState<string | null>(null);

  const show = useCallback((msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000);
  }, []);

  return { message, show };
}

export function AccountPage() {
  const user = useAuthStore((s) => s.user);
  const toast = useToast();

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Konto</h1>
        <p className="text-muted-foreground">
          Verwalte dein Profil und dein Passwort.
        </p>
      </div>

      {toast.message && (
        <div className="flex items-center gap-2 rounded-md border bg-muted px-4 py-3 text-sm">
          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          {toast.message}
        </div>
      )}

      <ProfileSection
        displayName={user?.displayName ?? ""}
        email={user?.email ?? ""}
        onNotAvailable={() => toast.show("Funktion noch nicht verfügbar")}
      />

      <Separator />

      <PasswordSection
        onNotAvailable={() => toast.show("Funktion noch nicht verfügbar")}
      />
    </div>
  );
}

function ProfileSection({
  displayName,
  email,
  onNotAvailable,
}: {
  displayName: string;
  email: string;
  onNotAvailable: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { displayName },
  });

  const onSubmit = (_data: ProfileForm) => {
    onNotAvailable();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profil</CardTitle>
        <CardDescription>Deine persönlichen Daten.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Anzeigename</Label>
            <Input id="displayName" {...register("displayName")} />
            {errors.displayName && (
              <p className="text-sm text-destructive">
                {errors.displayName.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>E-Mail</Label>
            <p className="rounded-md border bg-muted px-3 py-2 text-sm">
              {email}
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit">Speichern</Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function PasswordSection({
  onNotAvailable,
}: {
  onNotAvailable: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    trigger,
    formState: { errors },
  } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    mode: "onBlur",
  });

  const newPasswordValue = useWatch({ control, name: "newPassword" }) ?? "";
  const confirmValue =
    useWatch({ control, name: "confirmNewPassword" }) ?? "";

  const strength =
    newPasswordValue.length > 0 ? getPasswordStrength(newPasswordValue) : 0;
  const strengthInfo = strengthConfig[strength];

  useEffect(() => {
    if (!confirmValue) return;
    const id = setTimeout(() => trigger("confirmNewPassword"), 800);
    return () => clearTimeout(id);
  }, [confirmValue, trigger]);

  const onSubmit = (_data: PasswordForm) => {
    onNotAvailable();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Passwort ändern</CardTitle>
        <CardDescription>
          Wähle ein neues, sicheres Passwort.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Aktuelles Passwort</Label>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              {...register("currentPassword")}
            />
            {errors.currentPassword && (
              <p className="text-sm text-destructive">
                {errors.currentPassword.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">Neues Passwort</Label>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              {...register("newPassword")}
            />
            {strengthInfo && (
              <div className="space-y-1">
                <div className="h-1.5 w-full rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      strengthInfo.color,
                      strengthInfo.width,
                    )}
                  />
                </div>
                <p
                  className={cn(
                    "text-xs",
                    strength <= 2
                      ? "text-red-500"
                      : strength === 3
                        ? "text-orange-500"
                        : "text-green-500",
                  )}
                >
                  {strengthInfo.label}
                </p>
              </div>
            )}
            {errors.newPassword && (
              <p className="text-sm text-destructive">
                {errors.newPassword.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmNewPassword">
              Neues Passwort bestätigen
            </Label>
            <Input
              id="confirmNewPassword"
              type="password"
              autoComplete="new-password"
              {...register("confirmNewPassword")}
            />
            {errors.confirmNewPassword && (
              <p className="text-sm text-destructive">
                {errors.confirmNewPassword.message}
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit">Passwort ändern</Button>
        </CardFooter>
      </form>
    </Card>
  );
}
