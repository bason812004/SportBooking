import { Prisma } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { AppError } from "../shared/errors/AppError.js";

export function errorMiddleware(error: Error, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        fieldErrors: error.fieldErrors ?? {}
      }
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const status = error.code === "P2002" ? 409 : 400;
    return res.status(status).json({
      success: false,
      error: {
        code: error.code,
        message: "Loi truy van co so du lieu",
        fieldErrors: {}
      }
    });
  }

  console.error(error);
  return res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "He thong dang gap loi, vui long thu lai sau",
      fieldErrors: {}
    }
  });
}
