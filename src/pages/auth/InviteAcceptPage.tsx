import { useParams, useNavigate } from "react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { getInviteInfo, acceptInvite, getMyOrganizations } from "@/api/auth";
import { useAuthStore } from "@/store/authStore";
import { getApiErrorMessage } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const acceptSchema = z.object({
  displayName: z.string().min(1, "Anzeigename ist erforderlich"),
  password: z.string().min(8, "Passwort muss mindestens 8 Zeichen lang sein"),
});

type AcceptForm = z.infer<typeof acceptSchema>;

export function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const setActiveOrg = useAuthStore((s) => s.setActiveOrg);

  const inviteQuery = useQuery({
    queryKey: ["invite", token],
    queryFn: () => getInviteInfo(token!),
    enabled: !!token,
  });

  const acceptMutation = useMutation({
    mutationFn: (data: AcceptForm) =>
      acceptInvite({
        token: token!,
        password: data.password,
        displayName: data.displayName,
      }),
    onSuccess: async (response) => {
      setAuth(response);
      if (response.hasOrganization) {
        const orgs = await getMyOrganizations();
        if (orgs.length > 0) setActiveOrg(orgs[0]!);
      }
      navigate(response.hasOrganization ? "/tournaments" : "/onboarding");
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AcceptForm>({
    resolver: zodResolver(acceptSchema),
  });

  if (inviteQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (inviteQuery.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ungültige Einladung</CardTitle>
          <CardDescription>
            Diese Einladung ist ungültig oder abgelaufen.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const invite = inviteQuery.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Einladung annehmen</CardTitle>
        <CardDescription>
          {invite?.inviterName} hat dich zu{" "}
          <span className="font-medium">{invite?.organizationName}</span>{" "}
          eingeladen.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit((data) => acceptMutation.mutate(data))}>
        <CardContent className="space-y-4">
          {acceptMutation.isError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {getApiErrorMessage(acceptMutation.error)}
            </div>
          )}
          <div className="space-y-2">
            <Label>E-Mail</Label>
            <Input value={invite?.email ?? ""} disabled />
          </div>
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
            <Label htmlFor="password">Passwort festlegen</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button
            type="submit"
            className="w-full"
            disabled={acceptMutation.isPending}
          >
            {acceptMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Beitreten
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
