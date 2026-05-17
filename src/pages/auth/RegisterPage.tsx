import { useEffect } from "react";
import { Link } from "react-router";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { useRegister } from "@/hooks/useAuth";
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

const registerSchema = z
  .object({
    displayName: z.string().min(1, "Anzeigename ist erforderlich"),
    email: z.string().email("Ungültige E-Mail-Adresse"),
    password: z
      .string()
      .min(8, "Mindestens 8 Zeichen, Groß-/Kleinbuchstabe, Zahl und Sonderzeichen")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~])/,
        "Mindestens 8 Zeichen, Groß-/Kleinbuchstabe, Zahl und Sonderzeichen",
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwörter stimmen nicht überein",
    path: ["confirmPassword"],
  });

type RegisterForm = z.infer<typeof registerSchema>;

const strengthConfig = [
  null,
  { label: "Schwach", color: "bg-red-500", width: "w-1/4" },
  { label: "Schwach", color: "bg-red-500", width: "w-2/4" },
  { label: "Mittel", color: "bg-orange-500", width: "w-3/4" },
  { label: "Stark", color: "bg-green-500", width: "w-full" },
] as const;

export function RegisterPage() {
  const registerMutation = useRegister();
  const {
    register,
    handleSubmit,
    control,
    trigger,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    mode: "onBlur",
  });

  const passwordValue = useWatch({ control, name: "password" }) ?? "";
  const confirmValue = useWatch({ control, name: "confirmPassword" }) ?? "";

  const strength = passwordValue.length > 0 ? getPasswordStrength(passwordValue) : 0;
  const strengthInfo = strengthConfig[strength];

  useEffect(() => {
    if (!confirmValue) return;
    const id = setTimeout(() => trigger("confirmPassword"), 800);
    return () => clearTimeout(id);
  }, [confirmValue, trigger]);

  const onSubmit = (data: RegisterForm) => {
    registerMutation.mutate({
      email: data.email,
      password: data.password,
      displayName: data.displayName,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registrieren</CardTitle>
        <CardDescription>
          Erstelle ein neues Konto. Du kannst danach eine Organisation erstellen
          oder einer beitreten.
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
            <Label htmlFor="displayName">Anzeigename</Label>
            <Input id="displayName" {...register("displayName")} />
            {errors.displayName && (
              <p className="text-sm text-destructive">
                {errors.displayName.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@beispiel.de"
              autoComplete="email"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Passwort</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              {...register("password")}
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
            {errors.password && (
              <p className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Passwort bestätigen</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>
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
              Organisation gründen?{" "}
              <Link
                to="/register-organization"
                className="text-primary hover:underline"
              >
                Mit Organisation registrieren
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
