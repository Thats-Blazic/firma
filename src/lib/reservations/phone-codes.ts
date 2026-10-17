export type DialCode = { code: string; label: string };

/** Most relevant dialling codes for this business first, then the rest alphabetically. */
export const DIAL_CODES: DialCode[] = [
  { code: "+381", label: "Srbija (+381)" },
  { code: "+382", label: "Crna Gora (+382)" },
  { code: "+387", label: "Bosna i Hercegovina (+387)" },
  { code: "+385", label: "Hrvatska (+385)" },
  { code: "+386", label: "Slovenija (+386)" },
  { code: "+389", label: "Severna Makedonija (+389)" },
  { code: "+383", label: "Kosovo (+383)" },
  { code: "+355", label: "Albanija (+355)" },
  { code: "+43", label: "Austrija (+43)" },
  { code: "+32", label: "Belgija (+32)" },
  { code: "+359", label: "Bugarska (+359)" },
  { code: "+420", label: "Češka (+420)" },
  { code: "+45", label: "Danska (+45)" },
  { code: "+33", label: "Francuska (+33)" },
  { code: "+30", label: "Grčka (+30)" },
  { code: "+31", label: "Holandija (+31)" },
  { code: "+353", label: "Irska (+353)" },
  { code: "+39", label: "Italija (+39)" },
  { code: "+49", label: "Nemačka (+49)" },
  { code: "+47", label: "Norveška (+47)" },
  { code: "+36", label: "Mađarska (+36)" },
  { code: "+48", label: "Poljska (+48)" },
  { code: "+40", label: "Rumunija (+40)" },
  { code: "+7", label: "Rusija (+7)" },
  { code: "+421", label: "Slovačka (+421)" },
  { code: "+44", label: "Velika Britanija (+44)" },
  { code: "+1", label: "SAD / Kanada (+1)" },
  { code: "+41", label: "Švajcarska (+41)" },
  { code: "+46", label: "Švedska (+46)" },
  { code: "+90", label: "Turska (+90)" },
  { code: "+971", label: "UAE (+971)" },
];

/** "+381" + "061 234 567" → "+38161234567" (drops the national trunk prefix 0). */
export function composePhone(dial: string, national: string): string {
  const digits = national.replace(/\D/g, "").replace(/^0+/, "");
  return digits ? `${dial}${digits}` : "";
}
