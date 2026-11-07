import { CandidateShell } from "@/components/candidate/candidate-shell";
import { NotificationRealtimeProvider } from "@/components/notifications/notification-realtime-provider";
import { requireRole } from "@/lib/auth/roles";

export default async function CandidateLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { supabase, user, profile } = await requireRole("candidate");
  const [accountResult, notificationsResult] = await Promise.all([
    supabase.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle(),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .is("read_at", null),
  ]);

  if (accountResult.error) throw new Error(`Unable to load candidate account: ${accountResult.error.message}`);
  if (notificationsResult.error) {
    throw new Error(`Unable to count candidate notifications: ${notificationsResult.error.message}`);
  }

  return (
    <NotificationRealtimeProvider initialUnreadCount={notificationsResult.count ?? 0} userId={user.id}>
      <CandidateShell
        avatarUrl={accountResult.data?.avatar_url ?? null}
        email={user.email ?? ""}
        name={profile.full_name || "Candidat"}
      >
        {children}
      </CandidateShell>
    </NotificationRealtimeProvider>
  );
}
