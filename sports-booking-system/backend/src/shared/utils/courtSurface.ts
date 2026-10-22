export function surfaceCode(number: number) {
  return `S${String(number).padStart(2, "0")}`;
}

export function surfaceName(courtName: string, number: number) {
  const suffix = ` - Sân ${String(number).padStart(2, "0")}`;
  return `${courtName.slice(0, 160 - suffix.length)}${suffix}`;
}

// Treat old numeric codes as aliases when finding the next available number.
export function normalizedSurfaceCode(code: string) {
  const match = /^s?(\d+)$/i.exec(code.trim());
  return match ? surfaceCode(Number(match[1])) : code.trim().toUpperCase();
}
