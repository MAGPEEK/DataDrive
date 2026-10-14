const UNITS = ["B", "KB", "MB", "GB", "TB"] as const;
const STEP = 1024;

export function formatBytes(bytes: number, locale = "en"): string {
  let value = bytes;
  let unit = 0;
  while (value >= STEP && unit < UNITS.length - 1) {
    value /= STEP;
    unit += 1;
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value);
  return `${number} ${UNITS[unit]}`;
}

export function formatDate(iso: string, locale = "en"): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso),
  );
}
