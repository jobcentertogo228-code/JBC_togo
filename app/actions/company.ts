"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/roles";

export type CompanyActionState = {
  error?: string;
  message?: string;
};

const optionalMoney = z.union([
  z.literal("").transform(() => null),
  z.string()
    .trim()
    .regex(/^\d+(?:\.\d{1,2})?$/, "Saisissez un montant valide.")
    .transform(Number)
    .pipe(z.number().finite().min(0).max(9_999_999_999.99)),
]);

const optionalYears = z.union([
  z.literal("").transform(() => null),
  z.string()
    .trim()
    .regex(/^\d+(?:\.\d)?$/, "Saisissez un nombre d’années valide.")
    .transform(Number)
    .pipe(z.number().finite().min(0).max(80)),
]);

const jobPublicationSchema = z.object({
  companyId: z.string().uuid("Sélectionnez une entreprise valide."),
  title: z.string().trim().min(3, "Le titre doit contenir au moins 3 caractères.").max(180),
  description: z.string().trim().min(20, "La description doit contenir au moins 20 caractères.").max(30000),
  city: z.string().trim().min(2, "Saisissez une ville.").max(120),
  salaryMin: optionalMoney,
  salaryMax: optionalMoney,
  employmentType: z.enum(["full_time", "part_time", "contract", "internship", "temporary"]),
  minimumEducationLevel: z.enum([
    "none",
    "primary",
    "secondary",
    "high_school",
    "bac_plus_2",
    "bachelor",
    "master",
    "doctorate",
  ]),
  experienceLevel: z.union([
    z.literal(""),
    z.enum(["internship", "junior", "mid", "senior", "executive"]),
  ]),
  experienceMinYears: optionalYears,
  closesAt: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Saisissez une date limite valide.")
    .refine((date) => {
      const parsed = new Date(`${date}T00:00:00.000Z`);
      return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
    }, "Saisissez une date limite valide."),
}).refine(
  (values) => values.salaryMin === null || values.salaryMax === null || values.salaryMin <= values.salaryMax,
  { path: ["salaryMax"], message: "Le salaire maximum doit être supérieur ou égal au minimum." },
);

const applicationStatusSchema = z.object({
  applicationId: z.string().uuid("Cette candidature est invalide."),
  status: z.enum(["under_review", "shortlisted", "interview", "accepted", "rejected"]),
  interviewAt: z.string().optional(),
});

function firstIssue(error: { issues: Array<{ message: string }> }) {
  return error.issues[0]?.message ?? "Vérifiez les informations saisies.";
}

function slugify(value: string) {
  const base = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 140)
    .replace(/-$/g, "");

  return `${base || "offre"}-${randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

export async function publishJobAction(
  _previousState: CompanyActionState,
  formData: FormData,
): Promise<CompanyActionState> {
  const values = Object.fromEntries(
    Array.from(formData.entries()).map(([key, value]) => [key, typeof value === "string" ? value : ""]),
  );
  const parsed = jobPublicationSchema.safeParse(values);

  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { supabase, user } = await requireRole("company");
  const { data: membership, error: membershipError } = await supabase
    .from("company_memberships")
    .select("company_id, role")
    .eq("company_id", parsed.data.companyId)
    .eq("profile_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError) {
    console.error("Unable to verify job publisher membership:", membershipError);
    return { error: "Impossible de vérifier vos droits de publication." };
  }

  if (!membership || !["owner", "admin", "recruiter"].includes(membership.role)) {
    return { error: "Vous n’avez pas les droits nécessaires pour publier pour cette entreprise." };
  }

  const closesAt = new Date(`${parsed.data.closesAt}T23:59:59.999Z`);
  const publishedAt = new Date();
  if (closesAt <= publishedAt) {
    return { error: "La date limite doit être aujourd’hui ou une date ultérieure." };
  }

  const slug = slugify(parsed.data.title);
  const { error: insertError } = await supabase.from("jobs").insert({
    company_id: membership.company_id,
    created_by: user.id,
    title: parsed.data.title,
    slug,
    summary: parsed.data.description.replace(/\s+/g, " ").slice(0, 300),
    description: parsed.data.description,
    city: parsed.data.city,
    country_code: "TG",
    employment_type: parsed.data.employmentType,
    salary_min: parsed.data.salaryMin,
    salary_max: parsed.data.salaryMax,
    salary_currency: "XOF",
    experience_level: parsed.data.experienceLevel || null,
    experience_min_years: parsed.data.experienceMinYears,
    minimum_education_level: parsed.data.minimumEducationLevel,
    status: "published",
    published_at: publishedAt.toISOString(),
    closes_at: closesAt.toISOString(),
  });

  if (insertError) {
    console.error("Unable to publish job:", insertError);
    return { error: "L’offre n’a pas pu être publiée. Vérifiez les informations puis réessayez." };
  }

  revalidatePath("/company");
  revalidatePath("/emplois");
  redirect(`/emplois/${slug}`);
}

export async function markCompanyNotificationReadAction(
  _previousState: CompanyActionState,
  formData: FormData,
): Promise<CompanyActionState> {
  const notificationId = z.string().uuid().safeParse(formData.get("notificationId"));
  if (!notificationId.success) return { error: "Cette notification est invalide." };

  const { supabase, user } = await requireRole("company");
  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId.data)
    .eq("recipient_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Unable to mark company notification as read:", error);
    return { error: "Impossible de marquer cette notification comme lue." };
  }
  if (!data) return { error: "Cette notification n’est plus disponible." };

  revalidatePath("/company");
  revalidatePath("/company/candidatures");
  return { message: "Notification marquée comme lue." };
}

export async function updateCompanyApplicationStatusAction(
  _previousState: CompanyActionState,
  formData: FormData,
): Promise<CompanyActionState> {
  const parsed = applicationStatusSchema.safeParse({
    applicationId: formData.get("applicationId"),
    status: formData.get("status"),
    interviewAt: typeof formData.get("interviewAt") === "string" ? formData.get("interviewAt") : "",
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { supabase, user } = await requireRole("company");
  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .select("id, job_id, status")
    .eq("id", parsed.data.applicationId)
    .maybeSingle();

  if (applicationError) {
    console.error("Unable to load application for status update:", applicationError);
    return { error: "Impossible de charger cette candidature." };
  }
  if (!application) return { error: "Cette candidature n’est pas disponible." };

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("company_id")
    .eq("id", application.job_id)
    .maybeSingle();

  if (jobError) {
    console.error("Unable to load application company:", jobError);
    return { error: "Impossible de vérifier l’entreprise de cette candidature." };
  }
  if (!job) return { error: "L’offre associée à cette candidature est introuvable." };

  const { data: membership, error: membershipError } = await supabase
    .from("company_memberships")
    .select("company_id")
    .eq("company_id", job.company_id)
    .eq("profile_id", user.id)
    .eq("status", "active")
    .in("role", ["owner", "admin", "recruiter"])
    .maybeSingle();

  if (membershipError) {
    console.error("Unable to verify application manager membership:", membershipError);
    return { error: "Impossible de vérifier vos droits sur cette candidature." };
  }
  if (!membership) return { error: "Vous n’avez pas les droits pour modifier cette candidature." };

  if (["accepted", "rejected", "withdrawn"].includes(application.status)) {
    return { error: "Cette candidature est clôturée et ne peut plus être modifiée." };
  }

  let interviewAt: string | null = null;
  if (parsed.data.status === "interview") {
    const value = parsed.data.interviewAt ?? "";
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
      return { error: "Indiquez la date et l’heure de l’entretien." };
    }

    const parsedDate = new Date(`${value}:00Z`);
    if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 16) !== value) {
      return { error: "La date et l’heure de l’entretien sont invalides." };
    }
    if (parsedDate <= new Date()) {
      return { error: "L’entretien doit être programmé à une date future." };
    }
    interviewAt = parsedDate.toISOString();
  }

  const { data: updatedApplication, error: updateError } = await supabase
    .from("applications")
    .update({
      status: parsed.data.status,
      ...(interviewAt ? { interview_at: interviewAt } : {}),
    })
    .eq("id", application.id)
    .eq("status", application.status)
    .select("id")
    .maybeSingle();

  if (updateError) {
    console.error("Unable to update application status:", updateError);
    return { error: "Le statut de cette candidature n’a pas pu être mis à jour." };
  }
  if (!updatedApplication) return { error: "Cette candidature n’est plus disponible." };

  revalidatePath("/company");
  revalidatePath("/company/candidatures");
  revalidatePath("/candidate");
  revalidatePath("/candidate/candidatures");
  revalidatePath("/candidate/notifications");
  return { message: "Le suivi de la candidature a été mis à jour." };
}
