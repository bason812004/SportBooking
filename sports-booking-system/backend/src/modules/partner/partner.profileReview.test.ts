import assert from "node:assert/strict";
import { test } from "node:test";
import { needsReview } from "./partner.profileReview.js";

const verified = {
  businessName: "Sai Gon Sport Hub",
  taxCode: "0312345678",
  verificationDocumentUrl: "https://example.com/license.pdf"
};
const bank = { bankName: "Vietcombank", bankAccountNumber: "0123456789", bankAccountHolder: "CONG TY SAI GON SPORT" };

test("an approved partner editing only non-verified details stays approved", () => {
  // Name, phone, avatar and address are not part of the comparison at all.
  assert.equal(needsReview({ approvalStatus: "APPROVED", ...verified }, { ...verified }), false);
  assert.equal(needsReview({ approvalStatus: "APPROVED", ...verified }, { ...verified, businessName: "  Sai Gon Sport Hub " }), false, "whitespace is not a change");
});

test("changing a verified detail sends an approved partner back to review", () => {
  assert.equal(needsReview({ approvalStatus: "APPROVED", ...verified }, { ...verified, businessName: "Sport Hub 2" }), true);
  assert.equal(needsReview({ approvalStatus: "APPROVED", ...verified }, { ...verified, taxCode: null }), true, "clearing counts too");
  assert.equal(needsReview({ approvalStatus: "APPROVED", ...verified, verificationDocumentUrl: null }, { ...verified }), true, "adding counts too");
});

test("a new bank account does not send the profile back to review (it has its own guard: password and a 24h wait)", () => {
  const saved = { ...verified, ...bank, bankAccountNumber: "9999999999" };
  assert.equal(needsReview({ approvalStatus: "APPROVED", ...verified, ...bank }, saved), false);
});

test("a rejected partner saving the form resubmits it, whatever changed", () => {
  assert.equal(needsReview({ approvalStatus: "REJECTED", ...verified }, { ...verified }), true);
});
