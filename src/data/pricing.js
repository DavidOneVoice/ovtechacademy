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

export const getPricingByCountryCode = (countryCode) => {
  const normalizedCountryCode = countryCode?.toUpperCase();

  return pricing[normalizedCountryCode] || pricing.DEFAULT;
};
