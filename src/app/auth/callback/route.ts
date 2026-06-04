import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  return value;
}

function withMessage(path: string, key: "error" | "message", message: string) {
  const url = new URL(path, "https://placeholder.local");
  url.searchParams.set(key, message);
  return `${url.pathname}${url.search}`;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeNext(requestUrl.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(
      new URL(
        withMessage("/login", "error", "The authentication link is missing a code."),
        requestUrl.origin
      )
    );
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.redirect(
      new URL(
        withMessage("/login", "error", "Supabase environment variables are not configured yet."),
        requestUrl.origin
      )
    );
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(withMessage("/login", "error", error.message), requestUrl.origin)
    );
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
