/**
 * Vietnamese phone in the form accounts store it (0xxxxxxxxx): "+84 901 234 567", "84901234567" and
 * "0901.234.567" all become "0901234567". Anything else comes back as its digits only.
 */
export function normalizeVietnamPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("84") && digits.length >= 11) return `0${digits.slice(2)}`;
  return digits;
}
