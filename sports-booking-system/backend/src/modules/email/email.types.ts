export type RegistrationOtpEmail = {
  to: string;
  fullName: string;
  code: string;
  expiresInMinutes: number;
};
