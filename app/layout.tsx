import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "JOB-CENTER | Recrutement au Togo",
    template: "%s | JOB-CENTER",
  },
  description: "La plateforme de recrutement et de recherche d’emploi au Togo.",
  applicationName: "JOB-CENTER",
  openGraph: {
    type: "website",
    locale: "fr_TG",
    siteName: "JOB-CENTER",
    title: "JOB-CENTER | Recrutement au Togo",
    description: "La plateforme de recrutement et de recherche d’emploi au Togo.",
  },
  twitter: {
    card: "summary",
    title: "JOB-CENTER | Recrutement au Togo",
    description: "La plateforme de recrutement et de recherche d’emploi au Togo.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
