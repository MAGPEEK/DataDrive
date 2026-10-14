import type { User } from "@datadrive/domain";
import type {
  AuthDependencies,
  PasswordHasher,
  Session,
  SessionRepository,
  TokenCodec,
  TotpService,
  UserRepository,
} from "../auth-ports.js";
import type { Dependencies } from "../ports.js";
import { testDependencies } from "./in-memory.js";

export class InMemoryUserRepository implements UserRepository {
  private readonly store = new Map<string, User>();

  async findById(id: string): Promise<User | null> {
    return this.store.get(id) ?? null;
  }

  async findByUsername(username: string): Promise<User | null> {
    return [...this.store.values()].find((u) => u.username === username) ?? null;
  }

  async count(): Promise<number> {
    return this.store.size;
  }

  async save(user: User): Promise<void> {
    this.store.set(user.id, user);
  }
}

export class InMemorySessionRepository implements SessionRepository {
  private readonly store = new Map<string, Session>();

  async save(session: Session): Promise<void> {
    this.store.set(session.tokenHash, session);
  }

  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    return this.store.get(tokenHash) ?? null;
  }

  async delete(tokenHash: string): Promise<void> {
    this.store.delete(tokenHash);
  }

  async deleteAllForUser(userId: string): Promise<void> {
    for (const [key, session] of this.store) if (session.userId === userId) this.store.delete(key);
  }
}

export class PlainHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return `plain:${password}`;
  }

  async verify(hash: string, password: string): Promise<boolean> {
    return hash === `plain:${password}`;
  }
}

export class CountingTokens implements TokenCodec {
  private counter = 0;

  generate(): { token: string; hash: string } {
    this.counter += 1;
    const token = `token-${this.counter}`;
    return { token, hash: this.hash(token) };
  }

  hash(token: string): string {
    return `hash(${token})`;
  }
}

export class FixedCodeTotp implements TotpService {
  static readonly CODE = "123456";

  generateSecret(): string {
    return "SECRET";
  }

  uri(secret: string, account: string): string {
    return `otpauth://totp/${account}?secret=${secret}`;
  }

  verify(_secret: string, code: string): boolean {
    return code === FixedCodeTotp.CODE;
  }
}

/** Auth dependencies sharing drives, clock and ids with the given application dependencies. */
export function testAuthDependencies(shared: Dependencies = testDependencies()): AuthDependencies {
  return {
    users: new InMemoryUserRepository(),
    drives: shared.drives,
    sessions: new InMemorySessionRepository(),
    hasher: new PlainHasher(),
    tokens: new CountingTokens(),
    totp: new FixedCodeTotp(),
    clock: shared.clock,
    ids: shared.ids,
  };
}
