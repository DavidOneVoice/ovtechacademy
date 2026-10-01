import test from "node:test";
import assert from "node:assert/strict";
import { PHONE_COUNTRIES, getPhoneExample, validateWhatsAppNumber } from "../src/data/phoneNumbers.js";
import { emptyRegistration, registrationFormFromDraft, validateRegistration } from "../src/data/registration.js";

const details = {
  fullName: "Example Learner", email: "learner@example.test", location: "Test city",
  ageRange: "25 - 34", referral: "Other", reason: "I want to learn practical skills.",
  courseId: "virtual-assistance", phoneCountry: "NG", whatsapp: "8012345678",
};

test("both application types require an explicitly selected phone country even for international input", () => {
  for (const type of ["scholarship", "tuition"]) {
    for (const whatsapp of ["08012345678", "+2348012345678", "712345678"]) {
      assert.throws(() => validateRegistration({ ...details, whatsapp, phoneCountry: "" }, type), /Select the country code/);
    }
    assert.throws(() => validateRegistration({ ...details, phoneCountry: "ZZ" }, type), /country code/);
  }
  assert.equal(emptyRegistration().phoneCountry, "");
});

test("Nigeria and Uganda numbers are saved with exactly one calling code and country metadata", () => {
  for (const type of ["scholarship", "tuition"]) {
    for (const [country, input, national, whatsapp, callingCode] of [
      ["NG", "801 234 5678", "8012345678", "+2348012345678", "+234"],
      ["NG", "08012345678", "8012345678", "+2348012345678", "+234"],
      ["NG", "+2348012345678", "8012345678", "+2348012345678", "+234"],
      ["NG", "2348012345678", "8012345678", "+2348012345678", "+234"],
      ["UG", "712345678", "712345678", "+256712345678", "+256"],
      ["UG", "+256 712 345 678", "712345678", "+256712345678", "+256"],
    ]) {
      const clean = validateRegistration({ ...details, phoneCountry: country, whatsapp: input }, type);
      assert.equal(clean.whatsapp, whatsapp); assert.equal(clean.phoneCallingCode, callingCode);
      assert.equal(clean.phoneCountry, country); assert.equal(clean.phoneNationalNumber, national);
    }
  }
});

test("invalid lengths, prefixes, extensions, text and mismatched countries cannot be submitted", () => {
  for (const [phoneCountry, whatsapp] of [
    ["NG", "801234567"], ["NG", "80123456789"], ["NG", "1234567890"],
    ["NG", "2342348012345678"], ["NG", "+256712345678"],
    ["UG", "71234567"], ["UG", "7123456789"], ["UG", "+2348012345678"],
    ["NG", "Phone: +2348012345678"], ["NG", "+2348012345678 ext 1"],
    ["NG", ""], ["NG", "++2348012345678"],
  ]) assert.throws(() => validateWhatsAppNumber({ phoneCountry, whatsapp }), /WhatsApp|selected country/);
});

test("country-specific lengths are used across international destinations", () => {
  for (const [phoneCountry, whatsapp, expected] of [
    ["GB", "07400123456", "+447400123456"],
    ["US", "(201) 555-0123", "+12015550123"],
    ["DE", "015123456789", "+4915123456789"],
    ["CA", "5062345678", "+15062345678"],
    ["IT", "02 36618 300", "+390236618300"],
  ]) assert.equal(validateWhatsAppNumber({ phoneCountry, whatsapp }).whatsapp, expected);
  assert.ok(PHONE_COUNTRIES.length > 200);
  for (const country of PHONE_COUNTRIES) {
    const example = getPhoneExample(country.code);
    if (example) {
      const clean = validateWhatsAppNumber({ phoneCountry: country.code, whatsapp: example });
      assert.equal(clean.phoneCallingCode, country.callingCode);
      assert.ok(clean.whatsapp.startsWith(country.callingCode));
    }
  }
});

test("editing saved drafts preserves selections without duplicating the prefix, and never guesses an old draft's country", () => {
  const clean = validateRegistration(details);
  const restored = registrationFormFromDraft(clean);
  assert.equal(restored.whatsapp, "8012345678"); assert.equal(restored.phoneCountry, "NG");
  assert.equal(validateRegistration(restored).whatsapp, clean.whatsapp);
  const legacy = registrationFormFromDraft({ ...details, phoneCountry: undefined, whatsapp: "08012345678" });
  assert.equal(legacy.phoneCountry, ""); assert.equal(legacy.whatsapp, "08012345678");
  assert.throws(() => validateRegistration(legacy), /country code/);
  assert.equal(validateRegistration(legacy, "scholarship", { allowLegacyPhone: true }).whatsapp, "08012345678");
  assert.throws(() => validateRegistration({ ...details, whatsapp: "1234567890" }, "scholarship", { allowLegacyPhone: true }), /valid WhatsApp/);
});
