import { useEffect, useState } from "react";
import { getPricingByCountryCode } from "../data/pricing";

const COUNTRY_STORAGE_KEY = "ovtech_country";
const FALLBACK_COUNTRY_CODE = "NG";

const normalizeCountryCode = (countryCode) =>
  typeof countryCode === "string" ? countryCode.trim().toUpperCase() : "";

const getCachedCountryCode = () => {
  try {
    return normalizeCountryCode(localStorage.getItem(COUNTRY_STORAGE_KEY));
  } catch {
    return "";
  }
};

const cacheCountryCode = (countryCode) => {
  try {
    localStorage.setItem(COUNTRY_STORAGE_KEY, countryCode);
  } catch {
    // Ignore storage errors so pricing still works in restricted browsers.
  }
};

const detectCountryCode = async () => {
  const response = await fetch("https://ipapi.co/json/");

  if (!response.ok) {
    throw new Error("Unable to detect visitor country");
  }

  const data = await response.json();
  const countryCode = normalizeCountryCode(data.country_code);

  if (!countryCode) {
    throw new Error("Country code missing from location response");
  }

  return countryCode;
};

const usePricing = () => {
  const [countryCode, setCountryCode] = useState(() => {
    const cachedCountryCode = getCachedCountryCode();

    return cachedCountryCode || FALLBACK_COUNTRY_CODE;
  });

  useEffect(() => {
    const cachedCountryCode = getCachedCountryCode();

    if (cachedCountryCode) {
      setCountryCode(cachedCountryCode);
      return;
    }

    let isMounted = true;

    const loadCountryCode = async () => {
      try {
        const detectedCountryCode = await detectCountryCode();

        cacheCountryCode(detectedCountryCode);

        if (isMounted) {
          setCountryCode(detectedCountryCode);
        }
      } catch {
        cacheCountryCode(FALLBACK_COUNTRY_CODE);

        if (isMounted) {
          setCountryCode(FALLBACK_COUNTRY_CODE);
        }
      }
    };

    loadCountryCode();

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    ...getPricingByCountryCode(countryCode),
    countryCode,
  };
};

export default usePricing;
