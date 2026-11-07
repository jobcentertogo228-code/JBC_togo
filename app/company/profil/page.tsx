import type { Metadata } from "next";
import Link from "next/link";
import { CompanyProfileForm } from "@/components/company/company-profile-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/roles";

export const metadata: Metadata = { title: "Profil entreprise" };

export default async function CompanyProfilePage() {
  const { supabase, user } = await requireRole("company");
  const { data: memberships, error: membershipsError } = await supabase
    .from("company_memberships")
    .select("company_id, role")
    .eq("profile_id", user.id)
    .eq("status", "active")
    .order("created_at");

  if (membershipsError) throw new Error(`Impossible de charger vos entreprises : ${membershipsError.message}`);
  const companyIds = [...new Set((memberships ?? []).map((membership) => membership.company_id))];
  if (companyIds.length === 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <h1 className="text-3xl font-bold tracking-tight">Profil entreprise</h1>
        <Alert variant="info">Aucune entreprise n’est associée à votre compte.</Alert>
        <Button asChild><Link href="/company/setup">Créer mon espace entreprise</Link></Button>
      </div>
    );
  }

  const { data: companies, error: companiesError } = await supabase
    .from("companies")
    .select("id, company_code, name, industry, description, phone, email, website_url, address, city, country_code, logo_path, is_verified")
    .in("id", companyIds)
    .order("name");

  if (companiesError) throw new Error(`Impossible de charger les profils entreprise : ${companiesError.message}`);
  const roleByCompany = new Map((memberships ?? []).map((membership) => [membership.company_id, membership.role]));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-sm font-semibold text-primary">Espace entreprise</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Profil entreprise</h1>
        <p className="mt-2 text-muted-foreground">Gérez les coordonnées publiques et la présentation de votre entreprise.</p>
      </div>
      {(companies ?? []).map((company) => (
        <CompanyProfileForm
          canManage={["owner", "admin"].includes(roleByCompany.get(company.id) ?? "")}
          company={{
            id: company.id,
            companyCode: company.company_code,
            name: company.name,
            industry: company.industry ?? "",
            description: company.description ?? "",
            phone: company.phone ?? "",
            email: company.email ?? "",
            websiteUrl: company.website_url ?? "",
            address: company.address ?? "",
            city: company.city ?? "",
            countryCode: company.country_code.trim(),
            logoUrl: company.logo_path?.startsWith("https://") ? company.logo_path : null,
            isVerified: company.is_verified,
          }}
          key={company.id}
          userId={user.id}
        />
      ))}
    </div>
  );
}
