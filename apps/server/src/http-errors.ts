import { DomainError } from "@datadrive/domain";
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";

const STATUS_BY_CODE: Record<string, number> = {
  invalid_name: 400,
  invalid_username: 400,
  weak_password: 400,
  invalid_credentials: 401,
  otp_required: 401,
  forbidden: 403,
  not_found: 404,
  name_conflict: 409,
  username_taken: 409,
  own_account: 409,
  not_in_trash: 409,
  quota_exceeded: 413,
};

export function errorHandler(
  error: FastifyError | DomainError,
  _request: FastifyRequest,
  reply: FastifyReply,
): void {
  if (error instanceof DomainError) {
    const status = STATUS_BY_CODE[error.code] ?? 400;
    void reply.status(status).send({ error: error.code, message: error.message });
    return;
  }
  const status = (error as FastifyError).statusCode ?? 500;
  const message = status === 500 ? "Internal error" : error.message;
  void reply.status(status).send({ error: "internal_error", message });
}
