export async function paymentRequest(action, data = {}) {
  let response;
  try {
    response = await fetch("/api/payments", {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...data }),
    });
  } catch { throw new Error("We couldn’t connect. Check your internet connection and try again. If you already paid, do not pay again."); }
  let result;
  try { result = await response.json(); }
  catch { throw new Error("Online checkout is not available yet. Please contact admissions before making a payment."); }
  if (!response.ok) throw new Error(result.error || "We couldn’t process your request. Please try again.");
  return result;
}
export function goToCheckout(url) {
  const target = new URL(url);
  if (target.protocol !== "https:" || target.hostname !== "checkout.paystack.com") throw new Error("The checkout link could not be validated. Please contact admissions.");
  window.location.assign(target.href);
}
