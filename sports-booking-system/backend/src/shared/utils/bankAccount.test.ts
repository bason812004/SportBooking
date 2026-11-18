import assert from "node:assert/strict";
import { test } from "node:test";
import { maskAccountNumber } from "./bankAccount.js";

test("an account number keeps only its last 4 digits, behind at most 6 stars", () => {
  assert.equal(maskAccountNumber("0123456789"), "******6789");
  assert.equal(maskAccountNumber("1234567"), "***4567");
  assert.equal(maskAccountNumber("12345678901234567890"), "******7890");
  assert.equal(maskAccountNumber("1234"), "1234");
  assert.equal(maskAccountNumber(""), null);
  assert.equal(maskAccountNumber(null), null);
  assert.equal(maskAccountNumber(undefined), null);
});
