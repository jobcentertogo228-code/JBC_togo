"use client";

import { useActionState } from "react";
import { saveCandidateProfileAction } from "@/app/actions/candidate";
import { AuthFeedback } from "@/components/auth/auth-feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CandidateProfileForm({
  initial,
}: {
  initial: {
    fullName: string;
    phone: string;
    displayName: string;
    headline: string;
    summary: string;
    city: string;
    yearsExperience: string;
  };
}) {
  const [state, formAction, pending] = useActionState(saveCandidateProfileAction, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>Informations professionnelles</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nom complet</Label>
              <Input autoComplete="name" defaultValue={initial.fullName} id="fullName" name="fullName" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input autoComplete="tel" defaultValue={initial.phone} id="phone" name="phone" type="tel" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">Nom affiché aux recruteurs</Label>
              <Input defaultValue={initial.displayName} id="displayName" maxLength={120} name="displayName" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="headline">Titre professionnel</Label>
              <Input
                defaultValue={initial.headline}
                id="headline"
                maxLength={160}
                name="headline"
                placeholder="Ex. Assistante de gestion"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Ville</Label>
              <Input autoComplete="address-level2" defaultValue={initial.city} id="city" name="city" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="yearsExperience">Années d’expérience</Label>
              <Input
                defaultValue={initial.yearsExperience}
                id="yearsExperience"
                max="80"
                min="0"
                name="yearsExperience"
                step="0.5"
                type="number"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="summary">Présentation professionnelle</Label>
            <Textarea
              defaultValue={initial.summary}
              id="summary"
              maxLength={10000}
              name="summary"
              placeholder="Présentez vos compétences et votre parcours en quelques phrases."
              rows={6}
            />
            <p className="text-xs text-muted-foreground">Cette présentation aide les recruteurs à comprendre votre profil.</p>
          </div>
          <AuthFeedback state={state} />
          <Button disabled={pending} type="submit">
            {pending ? "Enregistrement…" : "Enregistrer mon profil"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
