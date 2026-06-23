import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { authController } from "./auth.controller.js";
import {
  changePasswordSchema,
  googleAuthSchema,
  loginSchema,
  refreshTokenSchema,
  resendRegistrationCodeSchema,
  registerPartnerSchema,
  registerSchema,
  verifyRegistrationCodeSchema
} from "./auth.validation.js";

export const authRoutes = Router();

authRoutes.post("/register", validate(registerSchema), authController.requestRegistrationCode);
authRoutes.post("/register/request-code", validate(registerSchema), authController.requestRegistrationCode);
authRoutes.post("/register/verify-code", validate(verifyRegistrationCodeSchema), authController.verifyRegistrationCode);
authRoutes.post("/register/resend-code", validate(resendRegistrationCodeSchema), authController.resendRegistrationCode);
authRoutes.post("/register-partner", validate(registerPartnerSchema), authController.requestPartnerRegistrationCode);
authRoutes.post("/register-partner/request-code", validate(registerPartnerSchema), authController.requestPartnerRegistrationCode);
authRoutes.post("/register-partner/verify-code", validate(verifyRegistrationCodeSchema), authController.verifyRegistrationCode);
authRoutes.post("/register-partner/resend-code", validate(resendRegistrationCodeSchema), authController.resendRegistrationCode);
authRoutes.post("/login", validate(loginSchema), authController.login);
authRoutes.post("/google", validate(googleAuthSchema), authController.google);
authRoutes.post("/refresh-token", validate(refreshTokenSchema), authController.refreshToken);
authRoutes.post("/logout", authMiddleware, authController.logout);
authRoutes.get("/me", authMiddleware, authController.me);
authRoutes.put("/change-password", authMiddleware, validate(changePasswordSchema), authController.changePassword);
