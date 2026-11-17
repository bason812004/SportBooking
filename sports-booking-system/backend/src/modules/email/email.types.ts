/** Tells the owner their password was changed and the other devices were signed out. */
export type PasswordChangedEmail = {
  to: string;
  fullName: string;
  changedAt: Date;
};

/** Tells a partner the account their withdrawals go to was changed. */
export type BankAccountChangedEmail = {
  to: string;
  fullName: string;
  businessName: string;
  bankName: string | null;
  maskedAccount: string | null;
  changedAt: Date;
};

export type RegistrationOtpEmail = {
  to: string;
  fullName: string;
  code: string;
  expiresInMinutes: number;
};
