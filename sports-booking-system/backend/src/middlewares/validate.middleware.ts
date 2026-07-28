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

      // Schema is wrapped: { body, query, params } → extract each part
      if ("body" in parsed && "query" in parsed && "params" in parsed) {
        req.body = (parsed as { body: unknown }).body ?? req.body;
        req.query = (parsed as { query: unknown }).query as typeof req.query ?? req.query;
        req.params = (parsed as { params: unknown }).params as typeof req.params ?? req.params;
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
