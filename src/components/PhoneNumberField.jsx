import { useEffect, useRef, useState } from "react";
import { PHONE_COUNTRIES, getPhoneCountry, getPhoneExample, validateWhatsAppNumber } from "../data/phoneNumbers.js";

export default function PhoneNumberField({ phoneCountry = "", whatsapp = "", onChange, disabled = false }) {
  const input = useRef(null);
  const [touched, setTouched] = useState(false);
  const country = getPhoneCountry(phoneCountry);
  let number = null, error = "";
  try { number = validateWhatsAppNumber({ phoneCountry, whatsapp }); }
  catch (issue) { error = issue.message; }
  useEffect(() => { input.current?.setCustomValidity(error); }, [error]);
  const blur = () => {
    setTouched(true);
    // A pasted international number or a domestic trunk zero is shown as the
    // national number, keeping the selected prefix visible exactly once.
    if (number && number.phoneNationalNumber !== whatsapp) {
      onChange({ target: { name: "whatsapp", value: number.phoneNationalNumber } });
    }
  };
  const help = phoneCountry === "NG" ? "Enter 10 digits after +234, without the first 0."
    : phoneCountry === "UG" ? "Enter 9 digits after +256, without the first 0."
      : country ? "Enter the number after the selected country code." : "Select the country your WhatsApp number belongs to first.";
  return <fieldset className="academy-phone-field">
    <legend>WhatsApp number <span className="academy-required">(required)</span></legend>
    <div className="academy-phone-controls">
      <label htmlFor="whatsapp-country">Country code
        <select id="whatsapp-country" name="phoneCountry" value={phoneCountry} required disabled={disabled}
          aria-describedby="whatsapp-help" onChange={(event) => { setTouched(false); onChange(event); }}>
          <option value="">Select country code</option>
          {PHONE_COUNTRIES.map((item) => <option key={item.code} value={item.code}>{item.name} ({item.callingCode})</option>)}
        </select>
      </label>
      <label htmlFor="whatsapp-number">Phone number
        <span className="academy-phone-input">
          {country && <span className="academy-phone-prefix" aria-hidden="true">{country.callingCode}</span>}
          <input ref={input} id="whatsapp-number" name="whatsapp" type="tel" inputMode="tel" autoComplete="tel-national"
            value={whatsapp} onChange={onChange} onBlur={blur} onInvalid={() => setTouched(true)} required maxLength={40}
            disabled={disabled || !country} placeholder={country ? getPhoneExample(phoneCountry) : "Choose country code first"}
            aria-describedby={`whatsapp-help${touched && error ? " whatsapp-error" : ""}`}
            aria-invalid={touched && Boolean(error)} />
        </span>
      </label>
    </div>
    <p id="whatsapp-help" className="academy-phone-help">{help} We’ll use this number for WhatsApp follow-up.</p>
    {touched && error && country && <p id="whatsapp-error" className="academy-phone-error" role="alert">{error}</p>}
    {number && <p className="academy-phone-preview" aria-live="polite">Your WhatsApp number: <strong>{number.whatsapp}</strong></p>}
  </fieldset>;
}
