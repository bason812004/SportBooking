import type { NextFunction, Request, Response } from "express";
import type { AnyZodObject } from "zod";
import { ZodError } from "zod";
import { ValidationError } from "../shared/errors/AppError.js";

export function validate(schema: AnyZodObject) {
  return (req: Request, _res: Response, next: NextFunction) => {
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
    } catch (error) {
      if (error instanceof ZodError) {
        const fieldErrors = error.flatten().fieldErrors as Record<string, string[]>;
        return next(new ValidationError("Du lieu gui len khong hop le", fieldErrors));
      }
      return next(error);
    }
  };
}
