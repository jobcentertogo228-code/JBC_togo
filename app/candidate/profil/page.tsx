import type { Metadata } from "next";
import { CandidateProfileForm } from "@/components/candidate/profile-form";
import { CandidateSkillsForm } from "@/components/candidate/skills-form";
import { Alert } from "@/components/ui/alert";
import { getCandidateRecord } from "@/lib/candidate/queries";
import { requireRole } from "@/lib/auth/roles";

export const metadata: Metadata = { title: "Mon profil candidat" };

export default async function CandidateProfilePage() {
  const { supabase, user, profile } = await requireRole("candidate");
  const [candidate, profileDetails, skillsResult, selectedSkillsResult] = await Promise.all([
    getCandidateRecord(supabase, user.id),
    supabase.from("profiles").select("phone").eq("id", user.id).maybeSingle(),
    supabase.from("skills").select("id, name, category").order("name").limit(100),
    supabase.from("candidate_skills").select("skill_id").eq("candidate_id", user.id),
  ]);

  if (profileDetails.error) throw new Error(`Unable to load candidate contact details: ${profileDetails.error.message}`);
  if (skillsResult.error) throw new Error(`Unable to load skills catalog: ${skillsResult.error.message}`);
  if (selectedSkillsResult.error) throw new Error(`Unable to load selected skills: ${selectedSkillsResult.error.message}`);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-primary">Mon espace candidat</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Mon profil</h1>
        <p className="mt-2 text-muted-foreground">Présentez clairement votre parcours et vos compétences aux recruteurs.</p>
      </div>
      {!candidate && (
        <Alert variant="info">
          Votre profil professionnel sera créé lors de l’enregistrement de vos informations.
        </Alert>
      )}
      <CandidateProfileForm
        initial={{
          fullName: profile.full_name,
          phone: profileDetails.data?.phone ?? "",
          displayName: candidate?.display_name ?? profile.full_name,
          headline: candidate?.headline ?? "",
          summary: candidate?.summary ?? "",
          city: candidate?.city ?? "",
          yearsExperience: candidate?.years_experience?.toString() ?? "",
        }}
      />
      <CandidateSkillsForm
        selectedIds={(selectedSkillsResult.data ?? []).map((skill) => skill.skill_id)}
        skills={skillsResult.data ?? []}
      />
    </div>
  );
}
