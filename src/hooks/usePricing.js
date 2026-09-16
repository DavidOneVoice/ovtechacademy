import { getCoursePricing } from "../data/pricing";
// October cohort fees are quoted in NGN; do not substitute old regional prices.
const usePricing = (course = "data-analytics") => getCoursePricing(course);
export default usePricing;
