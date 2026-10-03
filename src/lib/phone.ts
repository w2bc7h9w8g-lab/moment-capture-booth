export const onlyDigits = (v: string) => v.replace(/\D/g, "").slice(0, 11);

export function formatBrPhone(digits: string) {
  const d = onlyDigits(digits);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Validates Brazilian phone numbers accepted by the booth: 10 digits (landline) or 11 digits (mobile), with a valid DDD. */
export function isValidBrMobile(digits: string) {
  const d = onlyDigits(digits);
  if (d.length !== 10 && d.length !== 11) return false;
  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;
  return d.length === 10 || d[2] === "9";
}
