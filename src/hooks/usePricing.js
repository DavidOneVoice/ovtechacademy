import { useEffect, useSyncExternalStore } from "react";
import { getCoursePricing } from "../data/pricing.js";
import { visitorCountryStore } from "../services/visitorCountry.js";

export function useVisitorCountry() {
  const state = useSyncExternalStore(visitorCountryStore.subscribe, visitorCountryStore.getSnapshot, visitorCountryStore.getSnapshot);
  useEffect(() => { visitorCountryStore.load(); }, []);
  return { ...state, retry: visitorCountryStore.load };
}
export default function usePricing(course = "data-analytics") {
  const { countryCode } = useVisitorCountry();
  return getCoursePricing(course, countryCode);
}
