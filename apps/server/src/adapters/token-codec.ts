import type { TokenCodec } from "@datadrive/application";
import { createHash, randomBytes } from "node:crypto";

const TOKEN_BYTES = 32;

export class RandomTokenCodec implements TokenCodec {
  generate(): { token: string; hash: string } {
    const token = randomBytes(TOKEN_BYTES).toString("base64url");
    return { token, hash: this.hash(token) };
  }

  hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
