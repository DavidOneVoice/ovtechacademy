import { useEffect } from "react";
import logo from "../../assets/certificate/OV logo 2.png";
import "./Verification.css";

export default function VerificationLayout({ children }) {
  useEffect(() => {
    document.title = "Certificate Verification | OVTech Academy";
    const description = "Verify an official OVTech Academy certificate record.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement("meta"); meta.name = "description"; document.head.append(meta); }
    meta.content = description;
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.append(canonical); }
    canonical.href = `https://ovtechacademy.com${window.location.pathname}`;
  }, []);

  return <main className="verification-page">
    <header className="verification-header"><img src={logo} alt="OVTech Academy logo" /><div><strong>OVTECH ACADEMY</strong><span>Certificate Verification</span></div></header>
    {children}
    <footer>www.ovtechacademy.com</footer>
  </main>;
}
