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
      }) as { body?: unknown; query?: unknown; params?: unknown };

      // Schema is wrapped: extract whichever of body/query/params it declared
      if ("body" in parsed || "query" in parsed || "params" in parsed) {
        if ("body" in parsed) req.body = parsed.body as typeof req.body;
        if ("query" in parsed) req.query = parsed.query as typeof req.query;
        if ("params" in parsed) req.params = parsed.params as typeof req.params;
      } else {
        // Schema is flat → whole parsed object is the body
        req.body = parsed as typeof req.body;
      }

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
