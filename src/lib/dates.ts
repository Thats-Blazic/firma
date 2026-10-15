const MONTHS_GENITIVE = [
  "januara",
  "februara",
  "marta",
  "aprila",
  "maja",
  "juna",
  "jula",
  "avgusta",
  "septembra",
  "oktobra",
  "novembra",
  "decembra",
];

/** Formats a date as "15. oktobra 2026." (Serbian, Latin script). */
export function formatDateSr(date: Date): string {
  return `${date.getDate()}. ${MONTHS_GENITIVE[date.getMonth()]} ${date.getFullYear()}.`;
}

export function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
