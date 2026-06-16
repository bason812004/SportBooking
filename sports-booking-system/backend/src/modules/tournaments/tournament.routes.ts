import { Router } from "express";
import { UserRole } from "@prisma/client";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { tournamentController } from "./tournament.controller.js";
import { tournamentRegistrationSchema } from "./tournament.validation.js";

export const tournamentRoutes = Router();

tournamentRoutes.get("/", tournamentController.list);
tournamentRoutes.post("/:id/register", authMiddleware, requireRole(UserRole.USER), validate(tournamentRegistrationSchema), tournamentController.register);
tournamentRoutes.get("/:slug", tournamentController.detail);
