import { useVisitorCountry } from "../hooks/usePricing";

export default function PricingStatus() {
  const { status, retry } = useVisitorCountry();
  if (status === "ready") return null;
  return <span role="status" className="academy-pricing-status">
    {status === "error" ? <>We couldn’t load your local fees. <button type="button" onClick={retry}>Retry fees</button></> : "Loading your fees…"}
  </span>;
}
