import { DomainError } from "@datadrive/domain";
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";

const STATUS_BY_CODE: Record<string, number> = {
  invalid_name: 400,
  not_found: 404,
  name_conflict: 409,
  not_in_trash: 409,
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
  void reply
    .status(status)
    .send({ error: "internal_error", message: status === 500 ? "Internal error" : error.message });
}
