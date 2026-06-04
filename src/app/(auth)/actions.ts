"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const emailSchema = z.string().trim().email();
const passwordSchema = z.string().min(8);

const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

const resetSchema = z.object({
  email: emailSchema,
});

function param(message: string) {
  return encodeURIComponent(message);
}

export async function signInAction(formData: FormData) {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect(`/login?error=${param("Check your email and password.")}`);
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    redirect(`/login?error=${param("Supabase environment variables are not configured yet.")}`);
  }

  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    redirect(`/login?error=${param(error.message)}`);
  }

  redirect("/dashboard");
}

export async function signUpAction(formData: FormData) {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect(`/signup?error=${param("Use a valid email and a password with at least 8 characters.")}`);
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    redirect(`/signup?error=${param("Supabase environment variables are not configured yet.")}`);
  }

  const headerStore = await headers();
  const origin = headerStore.get("origin") ?? "http://localhost:3000";

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/dashboard`,
    },
  });

  if (error) {
    redirect(`/signup?error=${param(error.message)}`);
  }

  redirect(`/login?message=${param("Account created. Check your email if confirmation is enabled.")}`);
}

export async function resetPasswordAction(formData: FormData) {
  const parsed = resetSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    redirect(`/forgot-password?error=${param("Enter a valid email address.")}`);
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    redirect(`/forgot-password?error=${param("Supabase environment variables are not configured yet.")}`);
  }

  const headerStore = await headers();
  const origin = headerStore.get("origin") ?? "http://localhost:3000";

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/login`,
  });

  if (error) {
    redirect(`/forgot-password?error=${param(error.message)}`);
  }

  redirect(`/login?message=${param("Password reset link sent.")}`);
}
