import { findCourse } from "./courses.js";

// Legacy prices are retained only for historical application email fallbacks.
export const pricing = {
  NG: {
    country: "Nigeria",
    currency: "NGN",
    tuition: "₦250,000",
    scholarship: "₦12,500",
    scholarshipPercent: "95%",
    studentPaysPercent: "5%",
    scholarshipPaymentLink: "https://paystack.shop/pay/ovtech-scholarship",
    fullTuitionPaymentLink: "https://paystack.shop/pay/ovtech-tuition",
  },

  GB: {
    country: "United Kingdom",
    currency: "GBP",
    tuition: "£250",
    scholarship: "£25",
    scholarshipPercent: "90%",
    studentPaysPercent: "10%",
    scholarshipPaymentLink:
      "https://paystack.shop/pay/ovtech-internationlscholarship",
    fullTuitionPaymentLink:
      "https://paystack.shop/pay/ovtech-internationlstudentspay",
  },

  AFRICA: {
    country: "Africa",
    currency: "USD",
    tuition: "$200",
    scholarship: "$10",
    scholarshipPercent: "95%",
    studentPaysPercent: "5%",
    scholarshipPaymentLink:
      "https://paystack.shop/pay/ovtech-internationlscholarship",
    fullTuitionPaymentLink:
      "https://paystack.shop/pay/ovtech-internationlstudentspay",
  },

  DEFAULT: {
    country: "International",
    currency: "USD",
    tuition: "$350",
    scholarship: "$35",
    scholarshipPercent: "90%",
    studentPaysPercent: "10%",
    scholarshipPaymentLink:
      "https://paystack.shop/pay/ovtech-internationlscholarship",
    fullTuitionPaymentLink:
      "https://paystack.shop/pay/ovtech-internationlstudentspay",
  },
};

const AFRICAN_COUNTRY_CODES = new Set([
  "DZ",
  "AO",
  "BJ",
  "BW",
  "BF",
  "BI",
  "CV",
  "CM",
  "CF",
  "TD",
  "KM",
  "CG",
  "CD",
  "CI",
  "DJ",
  "EG",
  "GQ",
  "ER",
  "SZ",
  "ET",
  "GA",
  "GM",
  "GH",
  "GN",
  "GW",
  "KE",
  "LS",
  "LR",
  "LY",
  "MG",
  "MW",
  "ML",
  "MR",
  "MU",
  "MA",
  "MZ",
  "NA",
  "NE",
  "NG",
  "RW",
  "ST",
  "SN",
  "SC",
  "SL",
  "SO",
  "ZA",
  "SS",
  "SD",
  "TZ",
  "TG",
  "TN",
  "UG",
  "ZM",
  "ZW",
]);

export const getPricingByCountryCode = (countryCode) => {
  const normalizedCountryCode = countryCode?.toUpperCase();

  if (pricing[normalizedCountryCode]) {
    return pricing[normalizedCountryCode];
  }

  if (AFRICAN_COUNTRY_CODES.has(normalizedCountryCode)) {
    return pricing.AFRICA;
  }

  return pricing.DEFAULT;
};

// October 2026 fees. Each pair is [full tuition, scholarship fee].
const regionalCourseFees = {
  GB: {
    "data-analytics": [300, 20], "web-development": [300, 40],
    "software-development": [300, 40], "virtual-assistance": [100, 15],
    "cyber-security": [300, 40], "ai-automation": [300, 40],
  },
  AFRICA: {
    "data-analytics": [250, 25], "web-development": [300, 30],
    "software-development": [300, 30], "virtual-assistance": [100, 15],
    "cyber-security": [300, 30], "ai-automation": [300, 30],
  },
  DEFAULT: {
    "data-analytics": [300, 30], "web-development": [400, 50],
    "software-development": [400, 50], "virtual-assistance": [100, 30],
    "cyber-security": [400, 50], "ai-automation": [400, 50],
  },
};
const countryNames = new Intl.DisplayNames(["en"], { type: "region", fallback: "none" });
export const normalizeCountryCode = (value) => {
  const code = typeof value === "string" ? value.trim().toUpperCase().replace(/^UK$/, "GB") : "";
  return /^[A-Z]{2}$/.test(code) && code !== "ZZ" && countryNames.of(code) ? code : null;
};
export const getPricingRegion = (value) => {
  const code = normalizeCountryCode(value);
  if (!code) return null;
  if (code === "NG" || code === "GB") return code;
  return AFRICAN_COUNTRY_CODES.has(code) || ["EH", "RE", "YT", "SH"].includes(code) ? "AFRICA" : "DEFAULT";
};
export const formatMoney = (amount, currency) => {
  const symbol = { NGN: "₦", GBP: "£", USD: "US$" }[currency];
  if (!symbol) throw new Error("A supported currency is required.");
  return `${symbol}${Number(amount).toLocaleString("en-GB", { maximumFractionDigits: 2 })}`;
};
export const formatNaira = (amount) => formatMoney(amount, "NGN");
const formatPercent = (value) => `${Number(value.toFixed(2))}%`;
export const getCoursePricing = (value, countryCode) => {
  const course = findCourse(value);
  const code = normalizeCountryCode(countryCode);
  const region = getPricingRegion(code);
  // Never guess Nigeria while location detection is pending or unavailable.
  if (!course || !region) return null;
  const [tuitionAmount, scholarshipAmount] = region === "NG"
    ? [course.tuitionAmount, course.scholarshipAmount] : regionalCourseFees[region][course.id];
  const currency = region === "NG" ? "NGN" : region === "GB" ? "GBP" : "USD";
  return {
    country: countryNames.of(code), countryCode: code, region, currency,
    tuitionAmount, scholarshipAmount,
    tuition: formatMoney(tuitionAmount, currency), scholarship: formatMoney(scholarshipAmount, currency),
    scholarshipPercent: formatPercent((1 - scholarshipAmount / tuitionAmount) * 100),
    studentPaysPercent: formatPercent(scholarshipAmount / tuitionAmount * 100),
    fullTuitionPaymentLink: `/register?course=${course.id}`,
  };
};

export const applicationPricingFields = (fees) => {
  if (!fees) throw new Error("Please wait for your course fees to load.");
  return {
    detectedCountry: fees.country, detectedCountryCode: fees.countryCode,
    pricingRegion: fees.region, currency: fees.currency,
    tuition: fees.tuition, tuitionAmount: fees.tuitionAmount,
    scholarshipFee: fees.scholarship, scholarshipFeeAmount: fees.scholarshipAmount,
    scholarshipPercent: fees.scholarshipPercent, studentPaysPercent: fees.studentPaysPercent,
  };
};
