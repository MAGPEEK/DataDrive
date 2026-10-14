import type { User } from "@datadrive/domain";
import type { Clock, IdGenerator } from "./ports.js";

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  count(): Promise<number>;
  save(user: User): Promise<void>;
}

export interface Session {
  readonly tokenHash: string;
  readonly userId: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

export interface SessionRepository {
  save(session: Session): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<Session | null>;
  delete(tokenHash: string): Promise<void>;
  deleteAllForUser(userId: string): Promise<void>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
}

export interface TokenCodec {
  generate(): { token: string; hash: string };
  hash(token: string): string;
}

export interface TotpService {
  generateSecret(): string;
  uri(secret: string, account: string): string;
  verify(secret: string, code: string, now: Date): boolean;
}

export interface AuthDependencies {
  readonly users: UserRepository;
  readonly sessions: SessionRepository;
  readonly hasher: PasswordHasher;
  readonly tokens: TokenCodec;
  readonly totp: TotpService;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}
