import {
  NotFoundError,
  OwnAccountError,
  assertStrongPassword,
  type Role,
  type User,
} from "@datadrive/domain";
import type { AuthDependencies } from "./auth-ports.js";

export interface UserChanges {
  readonly userId: string;
  readonly role?: Role;
  readonly disabled?: boolean;
  readonly password?: string;
}

function assertNotLockingOut(actorId: string, user: User, changes: UserChanges): void {
  if (actorId !== user.id) return;
  if (changes.disabled === true || (changes.role !== undefined && changes.role !== user.role)) {
    throw new OwnAccountError();
  }
}

/** Changes role, status or password of a user. Disabling or a new password ends all sessions. */
export async function updateUserUseCase(
  deps: AuthDependencies,
  actorId: string,
  changes: UserChanges,
): Promise<User> {
  const user = await deps.users.findById(changes.userId);
  if (user === null) throw new NotFoundError(changes.userId);
  assertNotLockingOut(actorId, user, changes);
  if (changes.password !== undefined) assertStrongPassword(changes.password);
  const updated: User = {
    ...user,
    role: changes.role ?? user.role,
    disabled: changes.disabled ?? user.disabled,
    passwordHash:
      changes.password === undefined ? user.passwordHash : await deps.hasher.hash(changes.password),
  };
  await deps.users.save(updated);
  if (changes.password !== undefined || changes.disabled === true) {
    await deps.sessions.deleteAllForUser(user.id);
  }
  return updated;
}
