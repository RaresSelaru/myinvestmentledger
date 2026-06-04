import Link from "next/link";
import { resetPasswordAction } from "@/app/(auth)/actions";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthMessage } from "@/components/auth/auth-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ForgotPasswordPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const params = await searchParams;

  return (
    <AuthCard title="Reset password" subtitle="Send a reset link to your email.">
      <form action={resetPasswordAction} className="space-y-4">
        <AuthMessage error={first(params.error)} />
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <Button className="w-full" type="submit">
          Send reset link
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          <Link className="font-medium text-foreground" href="/login">
            Back to login
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
