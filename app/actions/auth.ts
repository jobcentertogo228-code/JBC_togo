"use server";

import { redirect } from "next/navigation";
import {
  candidateSignUpSchema,
  companySetupSchema,
  companySignUpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
} from "@/lib/auth/schemas";
import { roleDestination, safeNextPath } from "@/lib/auth/redirects";
import { getProfileForUser } from "@/lib/auth/roles";
import { getSiteUrl } from "@/lib/supabase/env";
import { createSupabaseActionClient } from "@/lib/supabase/server";

export type AuthActionState = {
  error?: string;
  message?: string;
};

function fieldValues(formData: FormData) {
  return {
    fullName: String(formData.get("fullName") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
    companyName: String(formData.get("companyName") ?? ""),
    companySlug: String(formData.get("companySlug") ?? ""),
  };
}

function validationMessage(error: { issues: Array<{ message: string }> }) {
  return error.issues[0]?.message ?? "Vérifiez les informations saisies.";
}

function publicAuthError(message: string) {
  if (/invalid login credentials/i.test(message)) {
    return "Adresse e-mail ou mot de passe incorrect.";
  }
  if (/already registered|user already exists/i.test(message)) {
    return "Cette adresse e-mail possède déjà un compte. Essayez de vous connecter.";
  }
  if (/password should be at least|weak password/i.test(message)) {
    return "Le mot de passe ne respecte pas les exigences de sécurité.";
  }
  return "L’opération a échoué. Vérifiez vos informations et réessayez.";
}

async function authenticatedDestination() {
  const supabase = await createSupabaseActionClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return "/connexion";
  }

  const profile = await getProfileForUser(supabase, data.user);
  if (!profile) {
    return "/auth/erreur?type=profile";
  }

  if (profile.account_role === "company") {
    const { data: membership, error: membershipError } = await supabase
      .from("company_memberships")
      .select("company_id")
      .eq("profile_id", data.user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      return "/auth/erreur?type=membership";
    }

    if (!membership) {
      return "/company/setup";
    }
  }

  return roleDestination(profile.account_role);
}

export async function signInAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signInSchema.safeParse(fieldValues(formData));
  if (!parsed.success) return { error: validationMessage(parsed.error) };

  const supabase = await createSupabaseActionClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) return { error: publicAuthError(error.message) };

  const destination = safeNextPath(
    String(formData.get("next") ?? ""),
    await authenticatedDestination(),
  );
  redirect(destination);
}

export async function signUpCandidateAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = candidateSignUpSchema.safeParse(fieldValues(formData));
  if (!parsed.success) return { error: validationMessage(parsed.error) };
  const next = safeNextPath(String(formData.get("next") ?? ""), "/candidate");

  const supabase = await createSupabaseActionClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${getSiteUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) return { error: publicAuthError(error.message) };
  if (!data.session) {
    return { message: "Vérifiez votre boîte e-mail pour confirmer votre compte avant de vous connecter." };
  }

  redirect(next);
}

export async function signUpCompanyAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = companySignUpSchema.safeParse(fieldValues(formData));
  if (!parsed.success) return { error: validationMessage(parsed.error) };

  const supabase = await createSupabaseActionClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName,
        company_name: parsed.data.companyName,
        company_slug: parsed.data.companySlug,
      },
      emailRedirectTo: `${getSiteUrl()}/auth/callback?next=%2Fcompany%2Fsetup`,
    },
  });

  if (error) return { error: publicAuthError(error.message) };
  if (!data.session) {
    return { message: "Compte créé. Confirmez votre e-mail, puis terminez la création de l’espace entreprise." };
  }

  const { error: companyError } = await supabase.rpc("create_company", {
    p_name: parsed.data.companyName,
    p_slug: parsed.data.companySlug,
  });

  if (companyError) {
    redirect("/company/setup?error=creation");
  }

  redirect("/company");
}

export async function completeCompanySetupAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = companySetupSchema.safeParse(fieldValues(formData));
  if (!parsed.success) return { error: validationMessage(parsed.error) };

  const supabase = await createSupabaseActionClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) redirect("/connexion?next=%2Fcompany%2Fsetup");

  const { data: existingMembership, error: membershipError } = await supabase
    .from("company_memberships")
    .select("company_id")
    .eq("profile_id", authData.user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (membershipError) return { error: "Impossible de vérifier l’espace entreprise. Réessayez." };
  if (existingMembership) redirect("/company");

  const { error } = await supabase.rpc("create_company", {
    p_name: parsed.data.companyName,
    p_slug: parsed.data.companySlug,
  });

  if (error) return { error: publicAuthError(error.message) };
  redirect("/company");
}

export async function forgotPasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = forgotPasswordSchema.safeParse(fieldValues(formData));
  if (!parsed.success) return { error: validationMessage(parsed.error) };

  const supabase = await createSupabaseActionClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${getSiteUrl()}/auth/callback?next=%2Freinitialiser-mot-de-passe`,
  });

  if (error) {
    return { error: "Nous n’avons pas pu envoyer le lien. Réessayez dans quelques instants." };
  }

  return { message: "Si cette adresse est associée à un compte, un lien de réinitialisation va être envoyé." };
}

export async function resetPasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = resetPasswordSchema.safeParse(fieldValues(formData));
  if (!parsed.success) return { error: validationMessage(parsed.error) };

  const supabase = await createSupabaseActionClient();
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError || !data.user) {
    return { error: "Le lien est invalide ou a expiré. Demandez un nouveau lien de réinitialisation." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: publicAuthError(error.message) };

  redirect(await authenticatedDestination());
}

export async function signOutAction() {
  const supabase = await createSupabaseActionClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(`Unable to sign out: ${error.message}`);
  redirect("/connexion");
}
