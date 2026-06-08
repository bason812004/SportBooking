import { Prisma } from "@prisma/client";
import { AppError } from "../shared/errors/AppError.js";
export function errorMiddleware(error, _req, res, _next) {
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
