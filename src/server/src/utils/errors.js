class AppError extends Error { 
  constructor(msg, code, status) { 
    super(msg); 
    this.code=code; 
    this.statusCode=status; 
  } 
}
class ValidationError extends AppError { 
  constructor(msg) { super(msg, 'VALIDATION_ERROR', 400); } 
}
class FileNotFoundError extends AppError { 
  constructor(p) { super(`File not found: ${p}`, 'FILE_NOT_FOUND', 404); } 
}
class DatabaseError extends AppError { 
  constructor(msg) { super(msg, 'DB_ERROR', 503); } 
}
class AuthenticationError extends AppError { 
  constructor() { super('Auth required', 'AUTH_REQUIRED', 401); } 
}
class ForbiddenError extends AppError { 
  constructor(msg) { super(msg, 'FORBIDDEN', 403); } 
}

module.exports = {
  AppError,
  ValidationError,
  FileNotFoundError,
  DatabaseError,
  AuthenticationError,
  ForbiddenError
};
