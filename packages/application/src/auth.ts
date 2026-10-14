import {
  InvalidCredentialsError,
  OtpRequiredError,
  UsernameTakenError,
  assertStrongPassword,
  createPersonalDrive,
  normalizeUsername,
  type Role,
  type User,
} from "@datadrive/domain";
import type { AuthDependencies } from "./auth-ports.js";

export const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export interface CreateUserCommand {
  readonly username: string;
  readonly password: string;
  readonly role: Role;
}

export interface LoginCommand {
  readonly username: string;
  readonly password: string;
  readonly otp?: string | undefined;
}

export interface LoginResult {
  readonly token: string;
  readonly user: User;
}

export async function createUserUseCase(
  deps: AuthDependencies,
  command: CreateUserCommand,
): Promise<User> {
  const username = normalizeUsername(command.username);
  assertStrongPassword(command.password);
  if ((await deps.users.findByUsername(username)) !== null) throw new UsernameTakenError();
  const user: User = {
    id: deps.ids.next(),
    username,
    passwordHash: await deps.hasher.hash(command.password),
    role: command.role,
    totpSecret: null,
    totpEnabled: false,
    disabled: false,
    createdAt: deps.clock.now(),
  };
  await deps.users.save(user);
  await deps.drives.save(createPersonalDrive(user.id, user.username, user.createdAt));
  return user;
}

async function verifyPassword(
  deps: AuthDependencies,
  user: User | null,
  password: string,
): Promise<boolean> {
  // Always hash-compare, so unknown users cost the same time as known ones.
  const hash = user?.passwordHash ?? (await deps.hasher.hash("dummy-password-for-timing"));
  const valid = await deps.hasher.verify(hash, password);
  return valid && user !== null && !user.disabled;
}

function checkOtp(deps: AuthDependencies, user: User, otp: string | undefined): void {
  if (!user.totpEnabled || user.totpSecret === null) return;
  if (otp === undefined || otp === "") throw new OtpRequiredError();
  if (!deps.totp.verify(user.totpSecret, otp, deps.clock.now()))
    throw new InvalidCredentialsError();
}

export async function loginUseCase(
  deps: AuthDependencies,
  command: LoginCommand,
): Promise<LoginResult> {
  const user = await deps.users.findByUsername(command.username.trim().toLowerCase());
  if (!(await verifyPassword(deps, user, command.password)) || user === null) {
    throw new InvalidCredentialsError();
  }
  checkOtp(deps, user, command.otp);
  const { token, hash } = deps.tokens.generate();
  const now = deps.clock.now();
  await deps.sessions.save({
    tokenHash: hash,
    userId: user.id,
    createdAt: now,
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
  });
  return { token, user };
}

export async function authenticateUseCase(
  deps: AuthDependencies,
  token: string,
): Promise<User | null> {
  const session = await deps.sessions.findByTokenHash(deps.tokens.hash(token));
  if (session === null) return null;
  if (session.expiresAt.getTime() <= deps.clock.now().getTime()) {
    await deps.sessions.delete(session.tokenHash);
    return null;
  }
  const user = await deps.users.findById(session.userId);
  return user !== null && !user.disabled ? user : null;
}

export async function logoutUseCase(deps: AuthDependencies, token: string): Promise<void> {
  await deps.sessions.delete(deps.tokens.hash(token));
}

export interface TotpSetup {
  readonly secret: string;
  readonly uri: string;
}

export async function beginTotpSetupUseCase(
  deps: AuthDependencies,
  userId: string,
): Promise<TotpSetup> {
  const user = await requireUser(deps, userId);
  const secret = deps.totp.generateSecret();
  await deps.users.save({ ...user, totpSecret: secret, totpEnabled: false });
  return { secret, uri: deps.totp.uri(secret, user.username) };
}

export async function confirmTotpUseCase(
  deps: AuthDependencies,
  userId: string,
  code: string,
): Promise<void> {
  const user = await requireUser(deps, userId);
  if (user.totpSecret === null || !deps.totp.verify(user.totpSecret, code, deps.clock.now())) {
    throw new InvalidCredentialsError();
  }
  await deps.users.save({ ...user, totpEnabled: true });
  await deps.sessions.deleteAllForUser(user.id);
}

async function requireUser(deps: AuthDependencies, userId: string): Promise<User> {
  const user = await deps.users.findById(userId);
  if (user === null) throw new InvalidCredentialsError();
  return user;
}
