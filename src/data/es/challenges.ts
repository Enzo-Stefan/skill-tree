// Spanish for the daily, weekly and seasonal challenges (#122, #19). A FIRST DRAFT, like the rest of the Spanish:
// someone fluent should check it. Keyed by challenge id; numbers stay exactly as in src/data/challenges.ts
// and src/data/seasons.ts, and anything left out shows in English.

export interface ChallengeWords {
  title: string;
  text: string;
}

export const challengesEs: Record<string, ChallengeWords> = {
  "d-train": { title: "Presente", text: "Entrena hoy. Vale cualquier habilidad." },
  "d-pass1": { title: "Pasa una", text: "Pasa la prueba de una habilidad hoy." },
  "d-focus": { title: "Dos habilidades", text: "Trabaja dos habilidades distintas hoy." },
  "d-train2": { title: "Mantén el ritmo", text: "Haz una sesión de entrenamiento hoy." },
  "d-mix": { title: "Mézclalo", text: "Trabaja tres habilidades distintas hoy." },
  "w-days3": { title: "Tres días", text: "Entrena en tres días distintos esta semana." },
  "w-days4": { title: "Cuatro días", text: "Entrena en cuatro días distintos esta semana." },
  "w-pass2": { title: "Pasa dos", text: "Pasa dos habilidades esta semana." },
  "w-skills4": { title: "Completo", text: "Trabaja cuatro habilidades distintas esta semana." },
  "w-pass1": { title: "Sube de nivel", text: "Pasa una habilidad esta semana." },
  "w26-days30": { title: "Treinta días", text: "Entrena en 30 días distintos esta temporada." },
  "w26-pass8": { title: "Ocho habilidades nuevas", text: "Pasa 8 habilidades esta temporada." },
  "w26-skills12": { title: "Doce habilidades", text: "Trabaja 12 habilidades distintas esta temporada." },
};

/** Season titles by season id. */
export const seasonTitlesEs: Record<string, string> = {
  "winter-2026": "Invierno de trabajo",
};
