import type { ApiError } from '@interviewlab/core';
import type { FastifyInstance } from 'fastify';
export class ServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
  }
}
export const unavailable = (name: string) =>
  new ServiceError('capability_unavailable', 501, name + ' is not connected');

export function installErrorHandler(app: FastifyInstance) {
  app.setErrorHandler(
    (
      error: Error & { validation?: unknown; statusCode?: number; code?: string },
      request,
      reply,
    ) => {
      let failure = error instanceof ServiceError ? error : undefined;
      if (!failure && (error.validation || error.statusCode === 400))
        failure = new ServiceError(
          'unsupported_input',
          400,
          'Request does not match the API contract',
        );
      if (!failure && error.statusCode === 413)
        failure = new ServiceError('unsupported_input', 413, 'Request body is too large');
      if (!failure && error.statusCode === 415)
        failure = new ServiceError('unsupported_input', 415, 'Unsupported media type');
      if (!failure) {
        // Do not log error.message/stack: database and provider errors can contain private input.
        request.log.error({ error_type: error.name }, 'Unhandled server error');
        failure = new ServiceError('internal_error', 500, 'Internal server error');
      }
      const body: ApiError = {
        code: failure.code,
        message: failure.message,
        retryable: failure.retryable,
        request_id: request.id,
      };
      void reply.code(failure.statusCode).send(body);
    },
  );
  app.setNotFoundHandler((request, reply) => {
    const body: ApiError = {
      code: 'not_found',
      message: 'Resource not found',
      retryable: false,
      request_id: request.id,
    };
    void reply.code(404).send(body);
  });
}
