import { Router } from "express";
import { UserRole } from "@prisma/client";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { tournamentController } from "./tournament.controller.js";
import { tournamentIdParamsSchema, tournamentUpdateSchema, tournamentWriteSchema } from "./tournament.validation.js";

export const partnerTournamentRoutes = Router();
partnerTournamentRoutes.use(authMiddleware, requireRole(UserRole.PARTNER));
partnerTournamentRoutes.get("/", tournamentController.partnerList);
partnerTournamentRoutes.post("/", validate(tournamentWriteSchema), tournamentController.partnerCreate);
partnerTournamentRoutes.get("/:id", validate(tournamentIdParamsSchema), tournamentController.partnerDetail);
partnerTournamentRoutes.put("/:id", validate(tournamentUpdateSchema), tournamentController.partnerUpdate);
partnerTournamentRoutes.delete("/:id", validate(tournamentIdParamsSchema), tournamentController.partnerDelete);
partnerTournamentRoutes.get("/:id/registrations", validate(tournamentIdParamsSchema), tournamentController.partnerRegistrations);
partnerTournamentRoutes.put("/registrations/:id/approve", validate(tournamentIdParamsSchema), tournamentController.approveRegistration);
partnerTournamentRoutes.put("/registrations/:id/reject", validate(tournamentIdParamsSchema), tournamentController.rejectRegistration);

export const adminTournamentRoutes = Router();
adminTournamentRoutes.use(authMiddleware, requireRole(UserRole.ADMIN));
adminTournamentRoutes.get("/pending", tournamentController.adminPending);
adminTournamentRoutes.put("/:id/approve", validate(tournamentIdParamsSchema), tournamentController.adminApprove);
adminTournamentRoutes.put("/:id/reject", validate(tournamentIdParamsSchema), tournamentController.adminReject);
