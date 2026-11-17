export function surfaceCode(number: number) {
  return `S${String(number).padStart(2, "0")}`;
}

export function surfaceName(courtName: string, number: number) {
  const suffix = ` - Sân ${String(number).padStart(2, "0")}`;
  return `${courtName.slice(0, 160 - suffix.length)}${suffix}`;
}

const COURT_NAME_MAX = 180;

/** "<venue> - <sport>" for each court of a venue registered with several sports, within the 180-char name column. */
export function sportCourtName(venueName: string, sportName: string) {
  const suffix = ` - ${sportName.trim()}`;
  return `${venueName.trim().slice(0, COURT_NAME_MAX - suffix.length).trimEnd()}${suffix}`;
}

// Treat old numeric codes as aliases when finding the next available number.
export function normalizedSurfaceCode(code: string) {
  const match = /^s?(\d+)$/i.exec(code.trim());
  return match ? surfaceCode(Number(match[1])) : code.trim().toUpperCase();
}
