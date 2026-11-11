import { CandidateShell } from "@/components/candidate/candidate-shell";
import { NotificationRealtimeProvider } from "@/components/notifications/notification-realtime-provider";
import { requireRole } from "@/lib/auth/roles";

export default async function CandidateLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { supabase, user, profile } = await requireRole("candidate");
  const { count, error: notificationsError } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", user.id)
    .is("read_at", null);

  if (notificationsError) {
    throw new Error(`Unable to count candidate notifications: ${notificationsError.message}`);
  }

  return (
    <NotificationRealtimeProvider initialUnreadCount={count ?? 0} userId={user.id}>
      <CandidateShell
        avatarUrl={profile.avatar_url}
        email={user.email ?? ""}
        name={profile.full_name || "Candidat"}
      >
        {children}
      </CandidateShell>
    </NotificationRealtimeProvider>
  );
}
