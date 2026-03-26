class ForumError extends Error {
  constructor(message, code = 'FORUM_ERROR', status = 400) {
    super(message);
    // Ensure subclasses get their constructor name (e.g. 'ValidationError')
    this.name = this.constructor.name;
    this.code = code;
    this.status = status;
  }
}

export class TopicNotFoundError extends ForumError {
  constructor(id) {
    super(`Topic with id ${id} not found`, 'TOPIC_NOT_FOUND', 404);
  }
}

export class UnauthorizedError extends ForumError {
  constructor(message = 'Unauthorized to perform this action') {
    super(message, 'UNAUTHORIZED', 403);
  }
}

export class ValidationError extends ForumError {
  constructor(errors) {
    super('Validation failed', 'VALIDATION_ERROR', 400);
    this.errors = errors;
  }
}

export class RateLimitError extends ForumError {
  constructor(message = 'Too many requests') {
    super(message, 'RATE_LIMIT_EXCEEDED', 429);
  }
}

export class DatabaseError extends ForumError {
  constructor(message = 'Database operation failed') {
    super(message, 'DATABASE_ERROR', 500);
  }
}

export default ForumError;
// Also expose named export for modules that import `{ ForumError }`.
export { ForumError };