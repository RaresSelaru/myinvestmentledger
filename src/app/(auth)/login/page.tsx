import Link from "next/link";
import { signInAction } from "@/app/(auth)/actions";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthMessage } from "@/components/auth/auth-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <AuthCard
      title="Log in"
      subtitle="Open your private portfolio cockpit."
    >
      <form action={signInAction} className="space-y-4">
        <AuthMessage error={first(params.error)} message={first(params.message)} />
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Forgot password
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <Button className="w-full" type="submit">
          Log in
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          No account?{" "}
          <Link className="font-medium text-foreground" href="/signup">
            Sign up
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
