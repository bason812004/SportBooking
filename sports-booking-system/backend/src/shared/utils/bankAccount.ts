/** Only the last 4 digits of a bank account number, for notices and exported lists (e.g. "******1234"). */
export function maskAccountNumber(value: string | null | undefined) {
  if (!value) return null;
  return value.length <= 4 ? value : `${"*".repeat(Math.min(6, value.length - 4))}${value.slice(-4)}`;
}
