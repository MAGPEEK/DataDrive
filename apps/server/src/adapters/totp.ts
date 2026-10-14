import type { TotpService } from "@datadrive/application";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const DIGITS = 6;
const WINDOW = 1;
const SECRET_BYTES = 20;

export function base32Encode(bytes: Uint8Array): string {
  let bits = "";
  for (const byte of bytes) bits += byte.toString(2).padStart(8, "0");
  const chunks = bits.match(/.{1,5}/g) ?? [];
  return chunks.map((chunk) => ALPHABET[parseInt(chunk.padEnd(5, "0"), 2)]).join("");
}

export function base32Decode(text: string): Buffer {
  const bits = [...text.replace(/=+$/u, "").toUpperCase()]
    .map((char) => ALPHABET.indexOf(char).toString(2).padStart(5, "0"))
    .join("");
  const bytes = (bits.match(/.{8}/g) ?? []).map((byte) => parseInt(byte, 2));
  return Buffer.from(bytes);
}

export function hotp(secret: Buffer, counter: number, digits = DIGITS): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", secret).update(message).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** digits).padStart(digits, "0");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export class Rfc6238Totp implements TotpService {
  constructor(private readonly issuer = "DataDrive") {}

  generateSecret(): string {
    return base32Encode(randomBytes(SECRET_BYTES));
  }

  uri(secret: string, account: string): string {
    const label = encodeURIComponent(`${this.issuer}:${account}`);
    return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(this.issuer)}`;
  }

  verify(secret: string, code: string, now: Date): boolean {
    const key = base32Decode(secret);
    const counter = Math.floor(now.getTime() / 1000 / STEP_SECONDS);
    return [-WINDOW, 0, WINDOW].some((shift) => safeEqual(hotp(key, counter + shift), code));
  }
}
