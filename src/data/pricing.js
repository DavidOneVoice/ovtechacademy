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
