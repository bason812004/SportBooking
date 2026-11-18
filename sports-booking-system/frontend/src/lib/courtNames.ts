/**
 * Sub-court names often repeat their venue ("San bong Sala 1 - Sân 04"): keep the part after it ("Sân 04"), for
 * screens that already show which venue they are about. A name that does not start with the venue is kept whole.
 */
export function surfaceShortName(surface: string, venue: string) {
  if (!venue || !surface.toLocaleLowerCase("vi").startsWith(venue.toLocaleLowerCase("vi"))) return surface;
  const rest = surface.slice(venue.length).replace(/^[\s\-–—:·|]+/, "").trim();
  return rest || surface;
}
