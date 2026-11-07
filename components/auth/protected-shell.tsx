import Link from "next/link";
import { signOutAction } from "@/app/actions/auth";
import { NotificationBell } from "@/components/notifications/notification-bell";

export function ProtectedShell({
  children,
  title,
  home,
  notificationHref,
}: {
  children: React.ReactNode;
  title: string;
  home: string;
  notificationHref?: string;
}) {
  return (
    <div className="page-shell">
      <header className="site-header">
        <Link className="brand" href={home}>JOB-CENTER</Link>
        <nav className="site-nav" aria-label="Navigation de l’espace">
          <span className="muted">{title}</span>
          {notificationHref && <NotificationBell href={notificationHref} label="Notifications" />}
          <form action={signOutAction}>
            <button className="button button-secondary" type="submit">Déconnexion</button>
          </form>
        </nav>
      </header>
      <main className="main-content">{children}</main>
      <footer className="site-footer">Votre espace sécurisé JOB-CENTER</footer>
    </div>
  );
}
