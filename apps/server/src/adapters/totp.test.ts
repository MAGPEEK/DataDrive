import { describe, expect, it } from "vitest";
import { Rfc6238Totp, base32Decode, base32Encode, hotp } from "./totp.js";

const rfcSecret = Buffer.from("12345678901234567890");

describe("hotp (RFC 4226 test vectors)", () => {
  it.each([
    [0, "755224"],
    [1, "287082"],
    [2, "359152"],
    [9, "520489"],
  ])("counter %i gives %s", (counter, expected) => {
    expect(hotp(rfcSecret, counter)).toBe(expected);
  });
});

describe("base32", () => {
  it("round-trips and matches the RFC 4648 example", () => {
    expect(base32Encode(Buffer.from("foobar"))).toBe("MZXW6YTBOI");
    expect(base32Decode("MZXW6YTBOI").toString()).toBe("foobar");
  });
});

describe("Rfc6238Totp", () => {
  const totp = new Rfc6238Totp();
  const secret = base32Encode(rfcSecret);

  it("accepts the RFC 6238 code at t=59s (counter 1) and neighbours within the window", () => {
    expect(totp.verify(secret, "287082", new Date(59_000))).toBe(true);
    expect(totp.verify(secret, "287082", new Date(89_000))).toBe(true);
    expect(totp.verify(secret, "287082", new Date(150_000))).toBe(false);
  });

  it("rejects wrong and malformed codes", () => {
    expect(totp.verify(secret, "000000", new Date(59_000))).toBe(false);
    expect(totp.verify(secret, "28708", new Date(59_000))).toBe(false);
  });

  it("generates distinct secrets and an otpauth uri", () => {
    expect(totp.generateSecret()).not.toBe(totp.generateSecret());
    expect(totp.uri(secret, "alice")).toMatch(/^otpauth:\/\/totp\/DataDrive%3Aalice\?secret=/u);
  });
});
