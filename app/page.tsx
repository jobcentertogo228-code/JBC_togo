import Link from "next/link";

export default function HomePage() {
  return (
    <div className="page-shell">
      <header className="site-header">
        <Link className="brand" href="/">JOB-CENTER</Link>
        <nav className="site-nav" aria-label="Navigation principale">
          <Link href="/emplois">Offres d’emploi</Link>
          <Link href="/connexion">Connexion</Link>
          <Link href="/inscription/candidat">Créer un compte candidat</Link>
          <Link className="button" href="/inscription/entreprise">Espace entreprise</Link>
        </nav>
      </header>
      <main className="main-content">
        <p className="muted">L’emploi et le recrutement, au même endroit.</p>
        <h1 className="dashboard-title">Les bonnes opportunités commencent ici.</h1>
        <p className="muted">
          Créez votre profil professionnel ou trouvez les talents qui feront grandir votre entreprise.
        </p>
        <div className="feature-grid">
          <section className="feature-card">
            <h2>Vous cherchez un emploi ?</h2>
            <p className="muted">Créez un profil candidat et préparez-vous à postuler.</p>
            <Link href="/emplois">Parcourir les offres d’emploi →</Link>
            {" "}
            <Link href="/inscription/candidat">Créer mon compte candidat →</Link>
          </section>
          <section className="feature-card">
            <h2>Vous recrutez ?</h2>
            <p className="muted">Ouvrez votre espace entreprise pour démarrer.</p>
            <Link href="/inscription/entreprise">Créer un compte entreprise →</Link>
          </section>
        </div>
      </main>
      <footer className="site-footer">© JOB-CENTER — Togo</footer>
    </div>
  );
}
