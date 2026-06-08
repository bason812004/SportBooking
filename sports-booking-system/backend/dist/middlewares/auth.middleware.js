import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AuthError } from "../shared/errors/AppError.js";
export function authMiddleware(req, _res, next) {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) {
        return next(new AuthError());
    }
    try {
        const payload = jwt.verify(token, env.JWT_SECRET);
        req.user = { id: payload.sub, role: payload.role };
        return next();
    }
    catch {
        return next(new AuthError("Token khong hop le hoac da het han"));
    }
}
