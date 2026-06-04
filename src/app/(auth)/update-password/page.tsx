import { updatePasswordAction } from "@/app/(auth)/actions";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthMessage } from "@/components/auth/auth-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type UpdatePasswordPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function UpdatePasswordPage({
  searchParams,
}: UpdatePasswordPageProps) {
  const params = await searchParams;

  return (
    <AuthCard title="Set new password" subtitle="Choose a new password for your account.">
      <form action={updatePasswordAction} className="space-y-4">
        <AuthMessage error={first(params.error)} />
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <Button className="w-full" type="submit">
          Save password
        </Button>
      </form>
    </AuthCard>
  );
}
