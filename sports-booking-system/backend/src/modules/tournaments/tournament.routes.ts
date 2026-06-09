import { Router } from "express";
import { tournamentController } from "./tournament.controller.js";

export const tournamentRoutes = Router();

tournamentRoutes.get("/", tournamentController.list);
tournamentRoutes.get("/:slug", tournamentController.detail);
