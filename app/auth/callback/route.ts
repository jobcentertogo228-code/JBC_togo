import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/redirects";
import { createSupabaseActionClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"), "/candidate");

  if (!code) {
    return NextResponse.redirect(new URL("/connexion?error=callback", request.url));
  }

  const supabase = await createSupabaseActionClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/connexion?error=callback", request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
}
