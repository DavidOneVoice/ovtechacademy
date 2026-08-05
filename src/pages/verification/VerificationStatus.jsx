const COPY = {
  loading: ["Verifying certificate...", ""],
  "not-found": ["Certificate Not Found", "We could not find an approved certificate matching this certificate ID."],
  "not-valid": ["Certificate Not Valid", "This certificate is not currently valid."],
  incomplete: ["Certificate Record Incomplete", "This certificate record is approved but is missing required public information."],
  error: ["Unable to Verify Certificate", "We could not complete the verification request. Please try again later."],
};

export default function VerificationStatus({ status }) {
  const [title, message] = COPY[status];
  return <section className={`verification-card verification-state ${status}`} role={status === "loading" ? "status" : "alert"}>
    <div className="status-icon" aria-hidden="true">{status === "loading" ? "…" : "!"}</div>
    <h2>{title}</h2>
    {message && <p>{message}</p>}
    {status === "not-found" && <p>Please check the certificate ID and try again.</p>}
  </section>;
}
