import { getCountries, getCountryCallingCode, getExampleNumber, parsePhoneNumberWithError } from "libphonenumber-js/max";
import examples from "libphonenumber-js/mobile/examples";

const names = new Intl.DisplayNames(["en"], { type: "region" });
export const PHONE_COUNTRIES = Object.freeze(getCountries().map((code) => ({
  code, name: names.of(code) || code, callingCode: `+${getCountryCallingCode(code)}`,
})).sort((a, b) => a.name.localeCompare(b.name, "en")));
const countries = new Map(PHONE_COUNTRIES.map((country) => [country.code, country]));
export const getPhoneCountry = (code) => countries.get(code);
export const getPhoneExample = (code) => countries.has(code)
  ? String(getExampleNumber(code, examples)?.nationalNumber || "") : "";

export function validateWhatsAppNumber({ phoneCountry, whatsapp } = {}) {
  const code = typeof phoneCountry === "string" ? phoneCountry.trim().toUpperCase() : "";
  const country = countries.get(code);
  if (!country) throw new Error("Select the country code for your WhatsApp number.");
  const text = typeof whatsapp === "string" ? whatsapp.trim() : "";
  if (!text) throw new Error("Enter your WhatsApp number after selecting its country code.");
  const lengthHint = code === "NG" ? "10 digits after +234" : code === "UG" ? "9 digits after +256" : country.callingCode;
  const invalid = `Enter a valid WhatsApp number for ${country.name} (${lengthHint}).`;
  if (text.length > 40 || !/^\+?[0-9\s().-]+$/.test(text)) throw new Error(invalid);
  let phone;
  try {
    phone = parsePhoneNumberWithError(text, { defaultCountry: code, extract: false });
  } catch { throw new Error(invalid); }
  // Some countries and territories share a calling code and numbering plan.
  // The selected code must match even when metadata resolves a shared number
  // to a neighbouring country or the territory's parent country.
  if (phone.countryCallingCode !== country.callingCode.slice(1)) {
    throw new Error("Enter a number matching the selected country code, or select the country code your WhatsApp number uses.");
  }
  if (!phone.isValid() || phone.ext || !/^\+[1-9][0-9]{5,14}$/.test(phone.number)) throw new Error(invalid);
  return {
    whatsapp: phone.number, phoneCountry: code, phoneCallingCode: country.callingCode,
    phoneNationalNumber: String(phone.nationalNumber),
  };
}
