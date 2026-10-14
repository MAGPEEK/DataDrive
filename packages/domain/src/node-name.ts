const FORBIDDEN_CHARACTERS = new Set(["\\", "/"]);
const MAX_LENGTH = 255;
const FIRST_PRINTABLE_CODE = 32;

function hasForbiddenCharacter(name: string): boolean {
  return [...name].some(
    (c) => FORBIDDEN_CHARACTERS.has(c) || c.charCodeAt(0) < FIRST_PRINTABLE_CODE,
  );
}

/** Observed in the reference portal: "/" and "\", "." and ".." are rejected. */
export function isValidNodeName(name: string): boolean {
  if (name.length === 0 || name.length > MAX_LENGTH) return false;
  if (name === "." || name === "..") return false;
  if (name !== name.trim()) return false;
  return !hasForbiddenCharacter(name);
}
