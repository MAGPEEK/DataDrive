import type { ContentHasher } from "@datadrive/application";
import { createHash } from "node:crypto";

export class Sha256Hasher implements ContentHasher {
  sha256(data: Uint8Array): string {
    return createHash("sha256").update(data).digest("hex");
  }
}
