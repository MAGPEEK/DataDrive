const FORBIDDEN_CHARACTERS = new Set(["\\", "/"]);
const MAX_BYTES = 255;
const FIRST_PRINTABLE_CODE = 32;
const encoder = new TextEncoder();

function hasForbiddenCharacter(name: string): boolean {
  return [...name].some(
    (c) => FORBIDDEN_CHARACTERS.has(c) || c.charCodeAt(0) < FIRST_PRINTABLE_CODE,
  );
}

/**
 * Observed in the reference system (2026-10-14): "/" and "\", "." and ".." are rejected, names are limited
 * to 255 UTF-8 bytes (not characters), and everything else is accepted: spaces at the edges, ":", "*", "?",
 * "<", ">", '"', "|", "...", emoji, "con". Clients on stricter file systems deal with those names themselves.
 */
export function isValidNodeName(name: string): boolean {
  if (name.length === 0 || encoder.encode(name).length > MAX_BYTES) return false;
  if (name === "." || name === "..") return false;
  return !hasForbiddenCharacter(name);
}
