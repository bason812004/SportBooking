import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { authController } from "./auth.controller.js";
import {
  changePasswordSchema,
  googleAuthSchema,
  loginSchema,
  refreshTokenSchema,
  registerPartnerSchema,
  registerSchema
} from "./auth.validation.js";

export const authRoutes = Router();

authRoutes.post("/register", validate(registerSchema), authController.register);
authRoutes.post("/register-partner", validate(registerPartnerSchema), authController.registerPartner);
authRoutes.post("/login", validate(loginSchema), authController.login);
authRoutes.post("/google", validate(googleAuthSchema), authController.google);
authRoutes.post("/refresh-token", validate(refreshTokenSchema), authController.refreshToken);
authRoutes.post("/logout", authMiddleware, authController.logout);
authRoutes.get("/me", authMiddleware, authController.me);
authRoutes.put("/change-password", authMiddleware, validate(changePasswordSchema), authController.changePassword);
