import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AccountRole, Database } from "@/types/database";

export type AuthenticatedProfile = {
  id: string;
  account_role: AccountRole;
  full_name: string;
};

export function roleHome(role: AccountRole) {
  switch (role) {
    case "admin":
      return "/admin";
    case "company":
      return "/company";
    case "candidate":
      return "/candidate";
  }
}

export async function getProfileForUser(
  supabase: SupabaseClient<Database>,
  user: User,
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, account_role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load authenticated profile: ${error.message}`);
  }

  return data as AuthenticatedProfile | null;
}

export async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect("/connexion");
  }

  return { supabase, user: data.user };
}

export async function requireRole(role: Exclude<AccountRole, "admin">) {
  const { supabase, user } = await requireUser();
  const profile = await getProfileForUser(supabase, user);

  if (!profile) {
    throw new Error("Authenticated user has no profile; check the Supabase auth trigger.");
  }

  if (profile.account_role !== role && profile.account_role !== "admin") {
    redirect(roleHome(profile.account_role));
  }

  if (role === "company" && profile.account_role !== "admin") {
    const { data: membership, error } = await supabase
      .from("company_memberships")
      .select("company_id")
      .eq("profile_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Unable to verify company membership: ${error.message}`);
    }

    if (!membership) {
      redirect("/company/setup");
    }
  }

  return { supabase, user, profile };
}

export async function requireAdmin() {
  const { supabase, user } = await requireUser();
  const profile = await getProfileForUser(supabase, user);

  if (!profile) {
    throw new Error("Authenticated user has no profile; check the Supabase auth trigger.");
  }

  if (profile.account_role !== "admin") {
    redirect(roleHome(profile.account_role));
  }

  return { supabase, user, profile };
}
