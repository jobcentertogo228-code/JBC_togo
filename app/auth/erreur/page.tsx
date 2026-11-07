export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const message = type === "profile"
    ? "Le profil associé à ce compte est indisponible. Vérifiez le déclencheur de création des profils dans Supabase."
    : type === "membership"
      ? "L’appartenance à l’entreprise n’a pas pu être vérifiée. Réessayez ou contactez l’assistance."
      : "La session n’a pas pu être vérifiée. Reconnectez-vous.";

  return (
    <main className="page-shell main-content">
      <section className="auth-card">
        <h1>Accès momentanément indisponible</h1>
        <p role="alert">{message}</p>
        <a href="/connexion">Retour à la connexion</a>
      </section>
    </main>
  );
}
