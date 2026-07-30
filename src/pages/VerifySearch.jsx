import { useState } from "react";
import { useNavigate } from "react-router-dom";
import VerificationLayout from "./verification/VerificationLayout";
import { isCertificateIdValid, normalizeCertificateId } from "../services/publicCertificates";

export default function VerifySearch() {
  const [value, setValue] = useState(""); const [error, setError] = useState(""); const navigate = useNavigate();
  const submit = (event) => {
    event.preventDefault(); const certificateId = normalizeCertificateId(value);
    if (!certificateId) return setError("Please enter a certificate ID.");
    if (!isCertificateIdValid(certificateId)) return setError("Enter a valid certificate ID, for example OVT-SD-2026-000001.");
    navigate(`/verify/${encodeURIComponent(certificateId)}`);
  };
  return <VerificationLayout><section className="verification-card search-card"><p className="eyebrow">Official certificate lookup</p><h1>Verify a Certificate</h1><p>Enter the certificate ID printed below the QR code.</p><form onSubmit={submit} noValidate><label htmlFor="certificate-id">Certificate ID</label><input id="certificate-id" value={value} onChange={(event) => { setValue(event.target.value); setError(""); }} placeholder="OVT-SD-2026-000001" autoCapitalize="characters" aria-describedby={error ? "certificate-error" : undefined} />{error && <p id="certificate-error" className="form-error">{error}</p>}<button type="submit">Verify Certificate</button></form></section></VerificationLayout>;
}
