export const onlyDigits = (v: string) => v.replace(/\D/g, "").slice(0, 11);

export function formatBrPhone(digits: string) {
  const d = onlyDigits(digits);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Simple validation: 11 digits, valid DDD range, mobile starts with 9. */
export function isValidBrMobile(digits: string) {
  const d = onlyDigits(digits);
  if (d.length !== 11) return false;
  const ddd = Number(d.slice(0, 2));
  return ddd >= 11 && ddd <= 99 && d[2] === "9";
}
