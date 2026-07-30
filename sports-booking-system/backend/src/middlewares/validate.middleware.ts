import type { NextFunction, Request, Response } from "express";
import type { AnyZodObject } from "zod";
import { ZodError, z } from "zod";
import { ValidationError } from "../shared/errors/AppError.js";

/**
 * Detects whether a schema is wrapped (has body/query/params) or flat.
 * A wrapped schema has keys that match exactly "body", "query", "params".
 */
function isWrappedSchema(schema: AnyZodObject): boolean {
  const keys = Object.keys(schema.shape);
  return keys.includes("body") || keys.includes("query") || keys.includes("params");
}

export function validate(schema: AnyZodObject) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (isWrappedSchema(schema)) {
        // Wrapped schema: { body, query, params } — parse all three fields
        const parsed = schema.parse({
          body: req.body,
          query: req.query,
          params: req.params
        }) as Record<string, unknown>;

        if ("body" in parsed && parsed.body !== undefined) req.body = parsed.body;
        if ("query" in parsed && parsed.query !== undefined) {
          req.query = parsed.query as typeof req.query;
        }
        if ("params" in parsed && parsed.params !== undefined) {
          req.params = parsed.params as typeof req.params;
        }
      } else {
        // Flat schema — determine which request field(s) the schema keys belong to.
        const keys = Object.keys(schema.shape);
        // Params-like keys: these should come from req.params
        const paramsKeys = new Set(["slug", "id", "commentId", "postId", "courtId", "userId", "voucherId", "bookingId", "page", "limit"]);
        const hasParamsKeys = keys.some((k) => paramsKeys.has(k));

        if (hasParamsKeys) {
          // Merge validated params back into req.params
          const parsed = schema.parse(req.params);
          Object.assign(req.params, parsed as Record<string, string>);
        } else {
          // Assume body data
          const parsed = schema.parse(req.body);
          req.body = parsed;
        }
      }

      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        const fieldErrors = error.flatten().fieldErrors as Record<string, string[]>;
        return next(new ValidationError("Dữ liệu gửi lên không hợp lệ", fieldErrors));
      }
      return next(error);
    }
  };
}
