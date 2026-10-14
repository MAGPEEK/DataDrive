export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidNameError extends DomainError {
  constructor(name: string) {
    super("invalid_name", `Invalid name: ${JSON.stringify(name)}`);
  }
}

export class NameConflictError extends DomainError {
  constructor(name: string) {
    super("name_conflict", `An item named ${JSON.stringify(name)} already exists here`);
  }
}

export class NotFoundError extends DomainError {
  constructor(id: string) {
    super("not_found", `Node ${id} not found`);
  }
}

export class NotInTrashError extends DomainError {
  constructor(id: string) {
    super("not_in_trash", `Node ${id} is not in the trash`);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = "You are not allowed to do this") {
    super("forbidden", message);
  }
}
