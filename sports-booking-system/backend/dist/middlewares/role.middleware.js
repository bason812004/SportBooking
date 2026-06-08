import { ForbiddenError } from "../shared/errors/AppError.js";
export function requireRole(...roles) {
    return (req, _res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return next(new ForbiddenError());
        }
        return next();
    };
}
