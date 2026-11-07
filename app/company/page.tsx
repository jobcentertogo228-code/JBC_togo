import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CompanyNotificationReadForm } from "@/components/company/company-notification-read-form";
import { formatDate } from "@/lib/candidate/queries";
import { requireRole } from "@/lib/auth/roles";

export default async function CompanyHomePage() {
  const { supabase, user, profile } = await requireRole("company");
  const [notificationsResult, unreadResult] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, title, body, read_at, created_at")
      .eq("recipient_id", user.id)
      .eq("type", "new_application")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .eq("type", "new_application")
      .is("read_at", null),
  ]);

  if (notificationsResult.error) {
    throw new Error(`Impossible de charger les notifications entreprise : ${notificationsResult.error.message}`);
  }
  if (unreadResult.error) {
    throw new Error(`Impossible de compter les notifications entreprise : ${unreadResult.error.message}`);
  }

  return (
    <div className="space-y-8">
      <p className="muted">Espace entreprise</p>
      <h1 className="dashboard-title">Bienvenue{profile.full_name ? `, ${profile.full_name}` : ""}.</h1>
      <p className="muted">Votre espace de recrutement est prêt.</p>
      <div className="mt-6">
        <Button asChild>
          <Link href="/company/offres/nouvelle">Publier une offre</Link>
        </Button>
      </div>
      <section className="dashboard-grid">
        <Link className="dashboard-card transition-colors hover:border-primary" href="/company/offres/nouvelle">
          <h2>Offres d’emploi</h2>
          <p className="muted">Publiez une offre et rendez-la visible aux candidats.</p>
        </Link>
        <Link className="dashboard-card transition-colors hover:border-primary" href="/company/candidatures">
          <h2>Candidatures</h2>
          <p className="muted">Consultez les profils et suivez les candidatures reçues.</p>
        </Link>
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Notifications de candidature</CardTitle>
              <CardDescription className="mt-2">
                {unreadResult.count ?? 0} notification{unreadResult.count === 1 ? "" : "s"} non lue{unreadResult.count === 1 ? "" : "s"}
              </CardDescription>
            </div>
            <Bell aria-hidden="true" className="h-5 w-5 text-primary" />
          </div>
        </CardHeader>
        <CardContent>
          {notificationsResult.data?.length ? (
            <div className="divide-y divide-border">
              {notificationsResult.data.map((notification) => (
                <article className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start" key={notification.id}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={notification.read_at ? "text-sm font-medium" : "text-sm font-semibold"}>
                        {notification.title}
                      </p>
                      {!notification.read_at && <Badge variant="info">Nouvelle</Badge>}
                    </div>
                    {notification.body && <p className="mt-1 text-sm text-muted-foreground">{notification.body}</p>}
                    <p className="mt-2 text-xs text-muted-foreground">{formatDate(notification.created_at)}</p>
                    <Link className="mt-2 inline-block text-sm font-medium text-primary hover:underline" href="/company/candidatures">
                      Consulter les candidatures
                    </Link>
                  </div>
                  {!notification.read_at && <CompanyNotificationReadForm notificationId={notification.id} />}
                </article>
              ))}
            </div>
          ) : (
            <p className="py-4 text-sm text-muted-foreground">Les nouvelles candidatures apparaîtront ici.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
