"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getProfileForUser, requireRole, roleHome } from "@/lib/auth/roles";
import { isAuthSessionMissingError } from "@/lib/auth/session";
import { createSupabaseActionClient } from "@/lib/supabase/server";

export type CandidateActionState = {
  error?: string;
  message?: string;
};

const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Saisissez votre nom complet.").max(120),
  phone: z.string().trim().max(40).optional(),
  displayName: z.string().trim().max(120).optional(),
  headline: z.string().trim().max(160).optional(),
  summary: z.string().trim().max(10000).optional(),
  city: z.string().trim().max(120).optional(),
  yearsExperience: z.string().optional(),
});

const visibilitySchema = z.object({
  visibility: z.enum(["private", "companies_only", "public"]),
});

const skillsSchema = z.object({
  skillIds: z.array(z.string().uuid()).max(30, "Vous pouvez sélectionner au maximum 30 compétences."),
});

const passwordSchema = z.object({
  password: z.string().min(10, "Le mot de passe doit contenir au moins 10 caractères."),
  confirmPassword: z.string(),
}).refine((value) => value.password === value.confirmPassword, {
  path: ["confirmPassword"],
  message: "Les mots de passe ne correspondent pas.",
});

function formValues(formData: FormData) {
  return Object.fromEntries(
    Array.from(formData.entries()).map(([key, value]) => [key, typeof value === "string" ? value : ""]),
  );
}

function firstIssue(error: { issues: Array<{ message: string }> }) {
  return error.issues[0]?.message ?? "Vérifiez les informations saisies.";
}

export async function saveCandidateProfileAction(
  _previousState: CandidateActionState,
  formData: FormData,
): Promise<CandidateActionState> {
  const parsed = profileSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { supabase, user } = await requireRole("candidate");
  const yearsExperience = parsed.data.yearsExperience?.trim()
    ? Number(parsed.data.yearsExperience)
    : null;

  if (yearsExperience !== null && (!Number.isFinite(yearsExperience) || yearsExperience < 0 || yearsExperience > 80)) {
    return { error: "L’expérience doit être comprise entre 0 et 80 ans." };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone || null,
    })
    .eq("id", user.id);

  if (profileError) return { error: "Impossible de mettre à jour vos informations personnelles." };

  const { error: candidateError } = await supabase
    .from("candidates")
    .upsert(
      {
        profile_id: user.id,
        display_name: parsed.data.displayName?.trim() || parsed.data.fullName,
        headline: parsed.data.headline?.trim() || null,
        summary: parsed.data.summary?.trim() || null,
        city: parsed.data.city?.trim() || null,
        years_experience: yearsExperience,
      },
      { onConflict: "profile_id" },
    );

  if (candidateError) return { error: "Les informations du profil n’ont pas pu être enregistrées." };

  revalidatePath("/candidate");
  revalidatePath("/candidate/profil");
  return { message: "Votre profil a été mis à jour." };
}

export async function saveCandidateVisibilityAction(
  _previousState: CandidateActionState,
  formData: FormData,
): Promise<CandidateActionState> {
  const parsed = visibilitySchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { supabase, user } = await requireRole("candidate");
  const { error } = await supabase
    .from("candidates")
    .upsert(
      { profile_id: user.id, visibility: parsed.data.visibility },
      { onConflict: "profile_id" },
    );

  if (error) return { error: "Le réglage de visibilité n’a pas pu être enregistré." };

  revalidatePath("/candidate");
  revalidatePath("/candidate/parametres");
  return { message: "Vos préférences de confidentialité ont été mises à jour." };
}

export async function saveCandidateSkillsAction(
  _previousState: CandidateActionState,
  formData: FormData,
): Promise<CandidateActionState> {
  const parsed = skillsSchema.safeParse({
    skillIds: formData.getAll("skillIds").map(String),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { supabase } = await requireRole("candidate");
  const { error } = await supabase.rpc("replace_candidate_skills", {
    p_skill_ids: parsed.data.skillIds,
  });

  if (error) return { error: "Les compétences n’ont pas pu être enregistrées." };
  revalidatePath("/candidate");
  revalidatePath("/candidate/profil");
  return { message: "Vos compétences ont été mises à jour." };
}

export async function changeCandidatePasswordAction(
  _previousState: CandidateActionState,
  formData: FormData,
): Promise<CandidateActionState> {
  const parsed = passwordSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { supabase } = await requireRole("candidate");
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) return { error: "Le mot de passe n’a pas pu être modifié. Réessayez." };
  return { message: "Votre mot de passe a été modifié." };
}

export async function deleteResumeAction(
  _previousState: CandidateActionState,
  formData: FormData,
): Promise<CandidateActionState> {
  const resumeId = z.string().uuid().safeParse(formData.get("resumeId"));
  if (!resumeId.success) return { error: "Le CV sélectionné est invalide." };

  const { supabase, user } = await requireRole("candidate");
  const { data: resume, error: readError } = await supabase
    .from("resumes")
    .select("id, storage_path")
    .eq("id", resumeId.data)
    .eq("candidate_id", user.id)
    .maybeSingle();

  if (readError) return { error: "Impossible de charger ce CV." };
  if (!resume) return { error: "Ce CV n’existe plus dans votre profil." };

  const { error: deleteError } = await supabase
    .from("resumes")
    .delete()
    .eq("id", resume.id)
    .eq("candidate_id", user.id);

  if (deleteError) {
    return { error: "Ce CV ne peut pas être supprimé, probablement parce qu’il est lié à une candidature." };
  }

  const { error: storageError } = await supabase.storage
    .from("candidate-resumes")
    .remove([resume.storage_path]);

  revalidatePath("/candidate/cv");
  revalidatePath("/candidate");

  if (storageError) {
    return { error: "Le CV a été retiré du profil, mais son fichier n’a pas pu être supprimé du stockage." };
  }

  return { message: "Le CV a été supprimé." };
}

export async function setDefaultResumeAction(
  _previousState: CandidateActionState,
  formData: FormData,
): Promise<CandidateActionState> {
  const resumeId = z.string().uuid().safeParse(formData.get("resumeId"));
  if (!resumeId.success) return { error: "Le CV sélectionné est invalide." };

  const { supabase } = await requireRole("candidate");
  const { error } = await supabase.rpc("set_candidate_default_resume", {
    p_resume_id: resumeId.data,
  });

  if (error) return { error: "Impossible de définir ce document comme CV principal." };
  revalidatePath("/candidate/cv");
  revalidatePath("/candidate");
  return { message: "CV principal mis à jour." };
}

export async function markNotificationReadAction(
  _previousState: CandidateActionState,
  formData: FormData,
): Promise<CandidateActionState> {
  const notificationId = z.string().uuid().safeParse(formData.get("notificationId"));
  if (!notificationId.success) return { error: "Cette notification est invalide." };

  const { supabase, user } = await requireRole("candidate");
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId.data)
    .eq("recipient_id", user.id);

  if (error) return { error: "Impossible de marquer la notification comme lue." };
  revalidatePath("/candidate/notifications");
  revalidatePath("/candidate");
  return { message: "Notification marquée comme lue." };
}

export async function applyToJobAction(
  _previousState: CandidateActionState,
  formData: FormData,
): Promise<CandidateActionState> {
  const jobId = z.string().uuid().safeParse(formData.get("jobId"));
  if (!jobId.success) return { error: "Cette offre est invalide." };

  const { supabase, user } = await requireRole("candidate");
  const { data: candidate, error: candidateError } = await supabase
    .from("candidates")
    .select("profile_id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (candidateError) return { error: "Impossible de vérifier votre profil candidat." };
  if (!candidate) return { error: "Complétez d’abord votre profil avant de postuler." };

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id, status, closes_at")
    .eq("id", jobId.data)
    .maybeSingle();

  if (jobError) return { error: "Impossible de vérifier cette offre." };
  if (!job || job.status !== "published" || (job.closes_at && new Date(job.closes_at) <= new Date())) {
    return { error: "Cette offre n’accepte plus de candidatures." };
  }

  const { data: existingApplication, error: existingError } = await supabase
    .from("applications")
    .select("id")
    .eq("job_id", jobId.data)
    .eq("candidate_id", user.id)
    .maybeSingle();

  if (existingError) return { error: "Impossible de vérifier vos candidatures existantes." };
  if (existingApplication) return { error: "Vous avez déjà postulé à cette offre." };

  const { data: defaultResume, error: resumeError } = await supabase
    .from("resumes")
    .select("id")
    .eq("candidate_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (resumeError) return { error: "Impossible de charger votre CV principal." };
  if (!defaultResume) return { error: "Ajoutez un CV à votre profil avant de postuler." };

  const { error: applicationError } = await supabase.from("applications").insert({
    job_id: jobId.data,
    candidate_id: user.id,
    resume_id: defaultResume.id,
  });

  if (applicationError?.code === "23505") {
    return { error: "Vous avez déjà postulé à cette offre." };
  }
  if (applicationError) {
    console.error("Unable to submit job application:", applicationError);
    return { error: "Votre candidature n’a pas pu être envoyée. Réessayez." };
  }

  revalidatePath("/candidate");
  revalidatePath("/candidate/candidatures");
  revalidatePath("/company");
  revalidatePath("/company/candidatures");
  redirect("/candidate/candidatures");
}

export type SavedJobActionState = {
  isSaved: boolean;
  error?: string;
};

export async function toggleSavedJobAction(
  _previousState: SavedJobActionState,
  formData: FormData,
): Promise<SavedJobActionState> {
  const jobId = z.string().uuid().safeParse(formData.get("jobId"));
  const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional().safeParse(formData.get("slug") || undefined);
  if (!jobId.success || !slug.success) {
    return { isSaved: false, error: "Cette offre n’est pas valide." };
  }

  const supabase = await createSupabaseActionClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError && !isAuthSessionMissingError(authError)) {
    throw new Error(`Impossible de vérifier la session : ${authError.message}`);
  }
  if (!authData.user) {
    const next = slug.data ? `/emplois/${slug.data}` : "/candidate/offres/sauvegardees";
    redirect(`/connexion?next=${encodeURIComponent(next)}`);
  }

  const profile = await getProfileForUser(supabase, authData.user);
  if (!profile) return { isSaved: false, error: "Le profil de votre compte est introuvable." };
  if (profile.account_role !== "candidate") redirect(roleHome(profile.account_role));

  const { error: candidateError } = await supabase
    .from("candidates")
    .upsert({ profile_id: authData.user.id }, { onConflict: "profile_id" });
  if (candidateError) return { isSaved: false, error: "Impossible de préparer votre profil candidat." };

  const { data: savedJob, error: lookupError } = await supabase
    .from("saved_jobs")
    .select("job_id")
    .eq("candidate_id", authData.user.id)
    .eq("job_id", jobId.data)
    .maybeSingle();
  if (lookupError) return { isSaved: false, error: "Impossible de vérifier vos offres sauvegardées." };

  if (savedJob) {
    const { error } = await supabase
      .from("saved_jobs")
      .delete()
      .eq("candidate_id", authData.user.id)
      .eq("job_id", jobId.data);
    if (error) return { isSaved: true, error: "Impossible de retirer l’offre de vos sauvegardes." };
  } else {
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, status, closes_at")
      .eq("id", jobId.data)
      .maybeSingle();
    if (jobError) return { isSaved: false, error: "Impossible de vérifier cette offre." };
    if (!job || job.status !== "published" || (job.closes_at && new Date(job.closes_at) <= new Date())) {
      return { isSaved: false, error: "Cette offre n’est plus disponible." };
    }

    const { error } = await supabase.from("saved_jobs").insert({
      candidate_id: authData.user.id,
      job_id: jobId.data,
    });
    if (error) return { isSaved: false, error: "Impossible de sauvegarder cette offre." };
  }

  revalidatePath("/emplois");
  if (slug.data) revalidatePath(`/emplois/${slug.data}`);
  revalidatePath("/candidate");
  revalidatePath("/candidate/offres");
  revalidatePath("/candidate/offres/sauvegardees");
  return { isSaved: !savedJob };
}
