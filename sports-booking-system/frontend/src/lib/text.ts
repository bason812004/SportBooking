const cp1252ToByte: Record<string, number> = {
  "€": 0x80,
  "‚": 0x82,
  "ƒ": 0x83,
  "„": 0x84,
  "…": 0x85,
  "†": 0x86,
  "‡": 0x87,
  "ˆ": 0x88,
  "‰": 0x89,
  "Š": 0x8a,
  "‹": 0x8b,
  "Œ": 0x8c,
  "Ž": 0x8e,
  "‘": 0x91,
  "’": 0x92,
  "“": 0x93,
  "”": 0x94,
  "•": 0x95,
  "–": 0x96,
  "—": 0x97,
  "˜": 0x98,
  "™": 0x99,
  "š": 0x9a,
  "›": 0x9b,
  "œ": 0x9c,
  "ž": 0x9e,
  "Ÿ": 0x9f
};

const mojibakePattern = /(?:Ã|Ä|Â|Æ|á[º»]|â[€“”]|Ð)/;

const vietnameseAliases: Array<[RegExp, string]> = [
  [/\bCau long\b/g, "C\u1ea7u l\u00f4ng"],
  [/\bSan bong\b/g, "S\u00e2n b\u00f3ng"],
  [/\bHa Noi\b/g, "H\u00e0 N\u1ed9i"],
  [/\bDa Nang\b/g, "\u0110\u00e0 N\u1eb5ng"],
  [/\bCan Tho\b/g, "C\u1ea7n Th\u01a1"],
  [/\bPhu Nhuan\b/g, "Ph\u00fa Nhu\u1eadn"],
  [/\bThu Duc\b/g, "Th\u1ee7 \u0110\u1ee9c"],
  [/\bGo Vap\b/g, "G\u00f2 V\u1ea5p"],
  [/\bTan Binh\b/g, "T\u00e2n B\u00ecnh"],
  [/\bMy Dinh\b/g, "M\u1ef9 \u0110\u00ecnh"],
  [/\bCau Giay\b/g, "C\u1ea7u Gi\u1ea5y"],
  [/\bNam Tu Liem\b/g, "Nam T\u1eeb Li\u00eam"],
  [/\bSon Tra\b/g, "S\u01a1n Tr\u00e0"],
  [/\bHoang Mai\b/g, "Ho\u00e0ng Mai"],
  [/\bNinh Kieu\b/g, "Ninh Ki\u1ec1u"]
];

function applyVietnameseAliases(value: string) {
  return vietnameseAliases.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), value);
}

export function repairText(value: string) {
  if (!mojibakePattern.test(value)) return applyVietnameseAliases(value);

  const bytes: number[] = [];
  for (const char of value) {
    const code = char.charCodeAt(0);
    const mapped = cp1252ToByte[char];
    if (mapped == null && code > 0xff) return applyVietnameseAliases(value);
    bytes.push(mapped ?? code);
  }

  try {
    return applyVietnameseAliases(new TextDecoder("utf-8", { fatal: false }).decode(Uint8Array.from(bytes)));
  } catch {
    return applyVietnameseAliases(value);
  }
}

export function repairObject<T>(input: T): T {
  if (typeof input === "string") return repairText(input) as T;
  if (Array.isArray(input)) return input.map((item) => repairObject(item)) as T;
  if (!input || typeof input !== "object") return input;

  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>).map(([key, value]) => [key, repairObject(value)])
  ) as T;
}
