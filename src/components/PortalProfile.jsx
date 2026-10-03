import { useEffect, useRef, useState } from "react";
import PhoneNumberField from "./PhoneNumberField";
import PortalPin from "./PortalPin";
import { portalRequest, requirePortalStudent } from "../lms/portalClient";
import { buildPortalProfilePayload, getPortalProfileForm, portalProfileContactChanged } from "../lms/portalProfile";

export default function PortalProfile({ student, pinRequired, onUpdated, onPinSaved }) {
  const [form, setForm] = useState(() => getPortalProfileForm(student));
  const [phoneEditing, setPhoneEditing] = useState(false);
  const [pin, setPin] = useState("");
  const [confirmationRequired, setConfirmationRequired] = useState(false);
  const [verification, setVerification] = useState(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const request = useRef(null);
  const original = getPortalProfileForm(student);
  const phoneEdited = form.phoneCountry !== original.phoneCountry || form.whatsapp !== original.whatsapp;
  const needsPin = pinRequired && (confirmationRequired || portalProfileContactChanged(student, form, { includePhone: phoneEdited }));
  useEffect(() => () => request.current?.abort(), []);

  const change = (event) => {
    setForm((previous) => ({ ...previous, [event.target.name]: event.target.value }));
    setError(""); setMessage("");
  };

  const submit = async (event) => {
    event.preventDefault();
    setError(""); setMessage("");
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    try {
      const response = verification
        ? await portalRequest("verifyProfile", { challenge: verification.challenge, code }, controller.signal)
        : await portalRequest("updateProfile", buildPortalProfilePayload(form, pinRequired ? pin : "", { includePhone: phoneEdited }), controller.signal);
      if (controller.signal.aborted) return;
      setPin("");
      if (response.verificationRequired && response.challenge) {
        setVerification({ challenge: response.challenge, email: response.email });
        setCode(""); setMessage(response.message);
      } else {
        const session = requirePortalStudent(response);
        setForm(getPortalProfileForm(session.student));
        setPhoneEditing(false);
        setConfirmationRequired(false);
        setVerification(null); setCode(""); setMessage(response.message || "Your profile has been updated.");
        onUpdated(session);
      }
    } catch (failure) {
      if (!controller.signal.aborted) {
        setPin(""); setError(failure.message);
        if (String(failure.code || "").toLowerCase().includes("pin_required")) setConfirmationRequired(true);
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  return <section className="portal-profile-card" aria-labelledby="portal-profile-title">
    <header><span>My profile</span><h2 id="portal-profile-title">Your enrollment details</h2><p>Keep your name, email and WhatsApp number correct. These are the details used to find your enrollment and send your PIN verification code.</p></header>
    <form className="portal-profile-form" onSubmit={submit}>
      <label>Full name<input required name="fullName" autoComplete="name" minLength={2} maxLength={150} value={form.fullName} onChange={change} disabled={busy || Boolean(verification)} /></label>
      <label>Registered email<input required name="email" type="email" autoComplete="email" maxLength={254} value={form.email} onChange={change} disabled={busy || Boolean(verification)} /></label>
      {phoneEditing ? <><PhoneNumberField phoneCountry={form.phoneCountry} whatsapp={form.whatsapp} onChange={change} disabled={busy || Boolean(verification)} /><button className="portal-text-button" type="button" disabled={busy || Boolean(verification)} onClick={() => { setPhoneEditing(false); setForm((previous) => ({ ...previous, phoneCountry: original.phoneCountry, whatsapp: original.whatsapp })); setPin(""); }}>Keep my saved phone number</button></> : <div className="portal-saved-phone"><span>WhatsApp/phone number</span><strong>{student.whatsapp || student.phone || student.phoneNumber || original.whatsapp || "Not provided"}</strong><button className="portal-text-button" type="button" disabled={busy || Boolean(verification)} onClick={() => setPhoneEditing(true)}>Edit phone number</button></div>}
      {pinRequired && !verification && <label>Current student PIN{!needsPin && <small>Optional for a name-only change</small>}<input required={needsPin} type="password" inputMode="numeric" autoComplete="current-password" pattern="[0-9]{6,10}" minLength={6} maxLength={10} value={pin} onChange={(event) => setPin(event.target.value)} disabled={busy} /><small>Confirm your current PIN to change your email or phone number. A verification code will be sent before the change is saved.</small></label>}
      {verification && <div className="portal-profile-verification"><p>Enter the six-digit code sent to <strong>{verification.email}</strong> to save your contact changes. Check your spam or junk folder too.</p><label>Email verification code<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} disabled={busy} /></label></div>}
      {message && <p className="portal-message" role="status">{message}</p>}
      {error && <p className="lms-error" role="alert">{error}</p>}
      <div className="portal-profile-actions"><button disabled={busy} type="submit">{busy ? "Saving…" : verification ? "Verify & save changes" : "Save profile"}</button>{verification && <button className="portal-text-button" disabled={busy} type="button" onClick={() => { setVerification(null); setCode(""); setPin(""); setMessage(""); setError(""); }}>Cancel verification</button>}</div>
    </form>
    <section className="portal-security" aria-labelledby="portal-security-title"><h3 id="portal-security-title">Student PIN</h3><p>{pinRequired ? "Your PIN is required when you sign in. You can use this same PIN to mark live-class attendance." : "Check your email and phone details above, then create a PIN. Once you create it, your portal will require it when you sign in."}</p><PortalPin key={`${student.id}:${student.email}`} studentId={student.id} email={student.email || form.email} onSaved={onPinSaved} /></section>
  </section>;
}
