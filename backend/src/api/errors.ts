export class ApiHttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiHttpError";
  }
}

export class NotFoundError extends ApiHttpError {
  constructor(entity: string, id: string) {
    super(404, "NOT_FOUND", `${entity} ${id} was not found.`);
  }
}

export class BadRequestError extends ApiHttpError {
  constructor(message: string, details?: unknown) {
    super(400, "BAD_REQUEST", message, details);
  }
}
