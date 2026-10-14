import { DomainError } from "./errors.js";

export type Role = "admin" | "user";

export interface User {
  readonly id: string;
  readonly username: string;
  readonly passwordHash: string;
  readonly role: Role;
  readonly totpSecret: string | null;
  readonly totpEnabled: boolean;
  readonly disabled: boolean;
  readonly createdAt: Date;
}

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;
const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 256;

export class InvalidUsernameError extends DomainError {
  constructor() {
    super("invalid_username", "Username must be 3-32 characters: a-z, 0-9, dot, dash, underscore");
  }
}

export class WeakPasswordError extends DomainError {
  constructor() {
    super(
      "weak_password",
      `Password must have ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters`,
    );
  }
}

export class UsernameTakenError extends DomainError {
  constructor() {
    super("username_taken", "This username is already taken");
  }
}

export class InvalidCredentialsError extends DomainError {
  constructor() {
    super("invalid_credentials", "Invalid username, password or code");
  }
}

export class OtpRequiredError extends DomainError {
  constructor() {
    super("otp_required", "A one-time code is required");
  }
}

export function normalizeUsername(input: string): string {
  const username = input.trim().toLowerCase();
  if (!USERNAME_PATTERN.test(username)) throw new InvalidUsernameError();
  return username;
}

export function assertStrongPassword(password: string): void {
  const length = [...password].length;
  if (length < MIN_PASSWORD_LENGTH || length > MAX_PASSWORD_LENGTH) throw new WeakPasswordError();
}

export class OwnAccountError extends DomainError {
  constructor() {
    super("own_account", "You cannot disable or demote your own account");
  }
}
