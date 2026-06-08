import { ZodError } from "zod";
import { ValidationError } from "../shared/errors/AppError.js";
export function validate(schema) {
    return (req, _res, next) => {
        try {
            const parsed = schema.parse({
                body: req.body,
                query: req.query,
                params: req.params
            });
            req.body = parsed.body ?? req.body;
            req.query = parsed.query ?? req.query;
            req.params = parsed.params ?? req.params;
            return next();
        }
        catch (error) {
            if (error instanceof ZodError) {
                const fieldErrors = error.flatten().fieldErrors;
                return next(new ValidationError("Du lieu gui len khong hop le", fieldErrors));
            }
            return next(error);
        }
    };
}
