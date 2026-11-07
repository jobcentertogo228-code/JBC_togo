"use client";

import { useActionState } from "react";
import { saveCandidateSkillsAction } from "@/app/actions/candidate";
import { AuthFeedback } from "@/components/auth/auth-feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export function CandidateSkillsForm({
  skills,
  selectedIds,
}: {
  skills: Array<{ id: string; name: string; category: string | null }>;
  selectedIds: string[];
}) {
  const [state, formAction, pending] = useActionState(saveCandidateSkillsAction, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compétences</CardTitle>
        <CardDescription>Sélectionnez jusqu’à 30 compétences qui représentent votre profil.</CardDescription>
      </CardHeader>
      <CardContent>
        {skills.length ? (
          <form action={formAction} className="space-y-5">
            <fieldset>
              <legend className="sr-only">Choisir mes compétences</legend>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <Label
                    className="cursor-pointer"
                    key={skill.id}
                  >
                    <input
                      className="peer sr-only"
                      defaultChecked={selectedIds.includes(skill.id)}
                      name="skillIds"
                      type="checkbox"
                      value={skill.id}
                    />
                    <span className="inline-flex rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                      {skill.name}
                    </span>
                  </Label>
                ))}
              </div>
            </fieldset>
            <AuthFeedback state={state} />
            <Button disabled={pending} type="submit">{pending ? "Enregistrement…" : "Enregistrer mes compétences"}</Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">Le catalogue de compétences sera bientôt disponible.</p>
        )}
      </CardContent>
    </Card>
  );
}
