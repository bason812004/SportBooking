export class AppError extends Error {
    statusCode;
    code;
    fieldErrors;
    constructor(statusCode, code, message, fieldErrors) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.fieldErrors = fieldErrors;
    }
}
export class ValidationError extends AppError {
    constructor(message = "Du lieu khong hop le", fieldErrors) {
        super(400, "VALIDATION_ERROR", message, fieldErrors);
    }
}
export class AuthError extends AppError {
    constructor(message = "Vui long dang nhap") {
        super(401, "AUTH_ERROR", message);
    }
}
export class ForbiddenError extends AppError {
    constructor(message = "Ban khong co quyen thuc hien thao tac nay") {
        super(403, "FORBIDDEN", message);
    }
}
export class NotFoundError extends AppError {
    constructor(message = "Khong tim thay du lieu") {
        super(404, "NOT_FOUND", message);
    }
}
export class ConflictError extends AppError {
    constructor(message = "Du lieu da ton tai", code = "CONFLICT") {
        super(409, code, message);
    }
}
export class DatabaseError extends AppError {
    constructor(message = "Loi co so du lieu") {
        super(500, "DATABASE_ERROR", message);
    }
}
