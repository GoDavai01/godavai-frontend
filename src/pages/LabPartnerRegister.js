import React, { useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronDown, FlaskConical, Languages, ShieldCheck, UserPlus } from "lucide-react";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const DEEP = "#0C5A3E";
const MID = "#0E7A4F";

const languageOptions = [
  { key: "hinglish", label: "Hinglish" },
  { key: "english", label: "English" },
  { key: "hindi", label: "हिन्दी" },
  { key: "other", label: "Other Languages" },
];

const futureLanguages = ["Bengali", "Marathi", "Tamil", "Telugu", "Kannada", "Punjabi", "Gujarati"];

const copy = {
  hinglish: {
    title: "Lab Registration",
    subtitle: "Simple step-1 form. Verification ke baad hi activation hota hai.",
    step1: "Step 1: Short Public Registration",
    step2: "Step 2: Full Verification Before Activation",
    step2Sub: "Step 2 internal hai (admin/ops verification). Is stage ke baad hi lab Live hota hai.",
    note: "Important: Form submit karne ka matlab approval ya live hona nahi hai.",
    fullName: "Aapka Naam",
    phone: "Mobile Number",
    email: "Email ID",
    labName: "Lab / Diagnostic Centre ka Naam",
    city: "City",
    address: "Poora Address",
    serviceAreas: "Aap kin areas mein service dete ho? (optional)",
    homeCollection: "Kya aap home sample collection karte ho?",
    licenseNumber: "Registration / License Number",
    uploadLabel: "Ek basic proof document upload karo",
    uploadHelpTitle: "Preferred: Lab Registration Certificate",
    uploadHelpListTitle: "Aap inme se koi ek upload kar sakte ho:",
    uploadHelpList: [
      "Lab Registration Certificate",
      "Diagnostic Centre Registration Certificate",
      "NABL Certificate (agar hai)",
      "GST Certificate",
      "Lab Letterhead / Business Proof (agar registration copy abhi ready nahi hai)",
    ],
    uploadHelpFooter: "Full verification documents activation se pehle zaroor liye jayenge.",
    consent:
      "Main confirm karta/karti hoon ki di gayi details sahi hain. GoDavaii verification ke liye mujhse contact kar sakta hai.",
    yes: "Yes",
    no: "No",
    submit: "Apply Now",
    submitting: "Submit ho raha hai...",
    success:
      "Application submit ho gayi. Status: Applied -> Under Review. Lab abhi live nahi hai. Full verification ke baad hi activation hoga.",
    requiredField: "Please sab required fields fill karo.",
    requiredDoc: "Please ek basic proof document upload karo.",
    requiredConsent: "Consent checkbox mandatory hai.",
    loginText: "Already registered?",
    loginBtn: "Lab Partner Login",
    otherLangMsg: "Other languages support coming soon. Filhaal form English fallback me dikh raha hai.",
  },
  english: {
    title: "Lab Registration",
    subtitle: "Simple step-1 form. Activation happens only after verification.",
    step1: "Step 1: Short Public Registration",
    step2: "Step 2: Full Verification Before Activation",
    step2Sub: "Step 2 is internal (admin/ops verification). Lab becomes Live only after this.",
    note: "Important: Form submission does not mean approval or go-live.",
    fullName: "Full Name",
    phone: "Phone Number",
    email: "Email Address",
    labName: "Lab / Diagnostic Centre Name",
    city: "City",
    address: "Full Address",
    serviceAreas: "Service Areas (optional)",
    homeCollection: "Do you offer home sample collection?",
    licenseNumber: "Registration / License Number",
    uploadLabel: "Upload any one basic proof document",
    uploadHelpTitle: "Preferred: Lab Registration Certificate",
    uploadHelpListTitle: "You may upload any one of the following:",
    uploadHelpList: [
      "Lab Registration Certificate",
      "Diagnostic Centre Registration Certificate",
      "NABL Certificate (if available)",
      "GST Certificate",
      "Lab Letterhead / Business Proof (if registration copy is not ready yet)",
    ],
    uploadHelpFooter: "Full verification documents will be required before activation.",
    consent: "I confirm that the details provided are correct. GoDavaii may contact me for verification.",
    yes: "Yes",
    no: "No",
    submit: "Apply Now",
    submitting: "Submitting...",
    success:
      "Application submitted. Status: Applied -> Under Review. The lab is not live yet. Activation happens only after full verification.",
    requiredField: "Please fill all required fields.",
    requiredDoc: "Please upload one basic proof document.",
    requiredConsent: "Consent is required.",
    loginText: "Already registered?",
    loginBtn: "Lab Partner Login",
    otherLangMsg: "Other languages support is coming soon. Form is currently shown in English fallback.",
  },
  hindi: {
    title: "लैब रजिस्ट्रेशन",
    subtitle: "सरल स्टेप-1 फॉर्म। एक्टिवेशन केवल सत्यापन के बाद होगा।",
    step1: "स्टेप 1: छोटा पब्लिक रजिस्ट्रेशन फॉर्म",
    step2: "स्टेप 2: एक्टिवेशन से पहले पूर्ण सत्यापन",
    step2Sub: "स्टेप 2 आंतरिक है (एडमिन/ऑप्स सत्यापन)। इसके बाद ही लैब Live होगी।",
    note: "महत्वपूर्ण: फॉर्म सबमिट करने का मतलब अनुमोदन या गो-लाइव नहीं है।",
    fullName: "आपका नाम",
    phone: "मोबाइल नंबर",
    email: "ईमेल आईडी",
    labName: "लैब / डायग्नोस्टिक सेंटर का नाम",
    city: "शहर",
    address: "पूरा पता",
    serviceAreas: "आप किन क्षेत्रों में सेवा देते हैं? (वैकल्पिक)",
    homeCollection: "क्या आप घर से सैंपल कलेक्शन की सुविधा देते हैं?",
    licenseNumber: "रजिस्ट्रेशन / लाइसेंस नंबर",
    uploadLabel: "कोई एक बेसिक प्रमाण दस्तावेज़ अपलोड करें",
    uploadHelpTitle: "प्राथमिक दस्तावेज़: लैब रजिस्ट्रेशन सर्टिफिकेट",
    uploadHelpListTitle: "आप इनमें से कोई एक अपलोड कर सकते हैं:",
    uploadHelpList: [
      "लैब रजिस्ट्रेशन सर्टिफिकेट",
      "डायग्नोस्टिक सेंटर रजिस्ट्रेशन सर्टिफिकेट",
      "NABL सर्टिफिकेट (यदि उपलब्ध हो)",
      "GST सर्टिफिकेट",
      "लैब लेटरहेड / बिज़नेस प्रूफ (यदि रजिस्ट्रेशन कॉपी अभी उपलब्ध नहीं है)",
    ],
    uploadHelpFooter: "एक्टिवेशन से पहले पूर्ण सत्यापन दस्तावेज़ आवश्यक होंगे।",
    consent: "मैं पुष्टि करता/करती हूँ कि दी गई जानकारी सही है। GoDavaii सत्यापन के लिए मुझसे संपर्क कर सकता है।",
    yes: "हाँ",
    no: "नहीं",
    submit: "अभी आवेदन करें",
    submitting: "सबमिट हो रहा है...",
    success:
      "आवेदन सफलतापूर्वक सबमिट हो गया। स्टेटस: Applied -> Under Review। लैब अभी Live नहीं है। पूर्ण सत्यापन के बाद ही एक्टिवेशन होगा।",
    requiredField: "कृपया सभी आवश्यक फ़ील्ड भरें।",
    requiredDoc: "कृपया एक बेसिक प्रमाण दस्तावेज़ अपलोड करें।",
    requiredConsent: "सहमति देना आवश्यक है।",
    loginText: "पहले से रजिस्टर्ड हैं?",
    loginBtn: "लैब पार्टनर लॉगिन",
    otherLangMsg: "अन्य भाषाओं का समर्थन जल्द आएगा। अभी फॉर्म English fallback में दिखाया जा रहा है।",
  },
};

export default function LabPartnerRegister() {
  const navigate = useNavigate();
  const [language, setLanguage] = useState("hinglish");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    labName: "",
    city: "",
    address: "",
    serviceAreas: "",
    homeCollectionAvailable: "yes",
    licenseNumber: "",
    consentAccepted: false,
  });
  const [document, setDocument] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const t = useMemo(() => {
    if (language === "hinglish") return copy.hinglish;
    if (language === "hindi") return copy.hindi;
    return copy.english;
  }, [language]);

  function onChange(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setSuccess("");

    if (!form.name.trim() || !form.phone.trim() || !form.email.trim() || !form.labName.trim() || !form.city.trim() || !form.address.trim() || !form.licenseNumber.trim()) {
      setError(t.requiredField);
      return;
    }
    if (!document) {
      setError(t.requiredDoc);
      return;
    }
    if (!form.consentAccepted) {
      setError(t.requiredConsent);
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("name", form.name.trim());
      fd.append("phone", form.phone.trim());
      fd.append("email", form.email.trim());
      fd.append("organization", form.labName.trim());
      fd.append("labName", form.labName.trim());
      fd.append("city", form.city.trim());
      fd.append("labAddress", form.address.trim());
      fd.append("serviceAreas", form.serviceAreas.trim());
      fd.append("areas", form.serviceAreas.trim());
      fd.append("homeCollectionAvailable", form.homeCollectionAvailable);
      fd.append("licenseNumber", form.licenseNumber.trim());
      fd.append("consentAccepted", String(!!form.consentAccepted));
      fd.append("preferredLanguage", language);
      fd.append("documents", document);

      await axios.post(`${API_BASE_URL}/api/lab-partners/register`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setSuccess(t.success);
      setForm({
        name: "",
        phone: "",
        email: "",
        labName: "",
        city: "",
        address: "",
        serviceAreas: "",
        homeCollectionAvailable: "yes",
        licenseNumber: "",
        consentAccepted: false,
      });
      setDocument(null);
    } catch (err) {
      setError(err?.response?.data?.error || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", minHeight: "100vh", padding: 14, background: "linear-gradient(180deg,#ECFDF5 0%,#E6F4FF 50%,#F8FAFC 100%)", fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
      <div style={{ background: "linear-gradient(135deg,#0B4D35,#0A623E)", borderRadius: 20, padding: 14, color: "#fff", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 14, background: "rgba(0,217,126,0.18)", display: "grid", placeItems: "center" }}>
              <FlaskConical style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 900, fontSize: 18 }}>{t.title}</div>
              <div style={{ fontSize: 12, opacity: 0.9 }}>{t.subtitle}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Languages style={{ width: 14, height: 14 }} />
            <div style={{ position: "relative" }}>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                style={{ height: 34, borderRadius: 10, border: "1px solid rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.14)", color: "#fff", fontWeight: 800, fontSize: 12, padding: "0 28px 0 10px", outline: "none", appearance: "none", cursor: "pointer" }}
              >
                {languageOptions.map((opt) => (
                  <option key={opt.key} value={opt.key} style={{ color: "#111827" }}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown style={{ width: 13, height: 13, position: "absolute", right: 8, top: 10, pointerEvents: "none" }} />
            </div>
          </div>
        </div>
      </div>

      {language === "other" ? (
        <div style={{ marginBottom: 10, background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 14, padding: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#1D4ED8" }}>{t.otherLangMsg}</div>
          <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {futureLanguages.map((lang) => (
              <span key={lang} style={{ fontSize: 10.5, fontWeight: 800, borderRadius: 999, border: "1px solid #DBEAFE", background: "#fff", color: "#1E3A8A", padding: "4px 8px" }}>
                {lang}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div style={{ background: "#fff", border: "1px solid rgba(12,90,62,0.10)", borderRadius: 16, padding: 12, marginBottom: 10 }}>
        <div style={{ display: "grid", gap: 7 }}>
          <div style={stepTitleStyle}><ShieldCheck style={{ width: 13, height: 13 }} /> {t.step1}</div>
          <div style={stepSubStyle}>{t.note}</div>
          <div style={{ ...stepTitleStyle, marginTop: 4 }}><ShieldCheck style={{ width: 13, height: 13 }} /> {t.step2}</div>
          <div style={stepSubStyle}>{t.step2Sub}</div>
        </div>
      </div>

      <form onSubmit={onSubmit} style={{ background: "rgba(255,255,255,0.94)", border: "1px solid rgba(12,90,62,0.1)", borderRadius: 20, padding: 14 }}>
        <div style={{ display: "grid", gap: 9 }}>
          <input value={form.name} onChange={(e) => onChange("name", e.target.value)} placeholder={t.fullName} style={inputStyle} />
          <input value={form.phone} onChange={(e) => onChange("phone", e.target.value)} placeholder={t.phone} style={inputStyle} />
          <input value={form.email} onChange={(e) => onChange("email", e.target.value)} placeholder={t.email} style={inputStyle} />
          <input value={form.labName} onChange={(e) => onChange("labName", e.target.value)} placeholder={t.labName} style={inputStyle} />
          <input value={form.city} onChange={(e) => onChange("city", e.target.value)} placeholder={t.city} style={inputStyle} />
          <input value={form.address} onChange={(e) => onChange("address", e.target.value)} placeholder={t.address} style={inputStyle} />
          <input value={form.serviceAreas} onChange={(e) => onChange("serviceAreas", e.target.value)} placeholder={t.serviceAreas} style={inputStyle} />

          <div style={fieldCardStyle}>
            <div style={fieldLabelStyle}>{t.homeCollection}</div>
            <div style={{ display: "flex", gap: 8 }}>
              {["yes", "no"].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onChange("homeCollectionAvailable", opt)}
                  style={{
                    height: 34,
                    borderRadius: 10,
                    border: form.homeCollectionAvailable === opt ? "none" : "1px solid #D1D5DB",
                    background: form.homeCollectionAvailable === opt ? "linear-gradient(135deg,#0C5A3E,#0E7A4F)" : "#fff",
                    color: form.homeCollectionAvailable === opt ? "#fff" : "#1F2937",
                    fontSize: 12,
                    fontWeight: 900,
                    padding: "0 14px",
                    cursor: "pointer",
                  }}
                >
                  {opt === "yes" ? t.yes : t.no}
                </button>
              ))}
            </div>
          </div>

          <input value={form.licenseNumber} onChange={(e) => onChange("licenseNumber", e.target.value)} placeholder={t.licenseNumber} style={inputStyle} />

          <div style={fieldCardStyle}>
            <div style={fieldLabelStyle}>{t.uploadLabel}</div>
            <div style={{ fontSize: 11, color: "#0F766E", fontWeight: 800 }}>{t.uploadHelpTitle}</div>
            <div style={{ marginTop: 4, fontSize: 11, color: "#475569", fontWeight: 700 }}>{t.uploadHelpListTitle}</div>
            <ul style={{ margin: "6px 0 0 18px", padding: 0, color: "#334155", fontSize: 11.2, fontWeight: 700, lineHeight: 1.6 }}>
              {t.uploadHelpList.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div style={{ marginTop: 6, fontSize: 11, color: "#1E3A8A", fontWeight: 800 }}>{t.uploadHelpFooter}</div>
            <label style={{ marginTop: 8, display: "inline-flex", alignItems: "center", borderRadius: 10, border: "1px solid #D1D5DB", background: "#fff", height: 36, padding: "0 12px", cursor: "pointer", fontSize: 12, fontWeight: 900, color: "#0B1F16" }}>
              {document ? document.name : t.uploadLabel}
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setDocument(e.target.files?.[0] || null)}
                style={{ display: "none" }}
              />
            </label>
          </div>

          <label style={{ display: "flex", alignItems: "start", gap: 8, fontSize: 12, color: "#334155", fontWeight: 700 }}>
            <input
              type="checkbox"
              checked={form.consentAccepted}
              onChange={(e) => onChange("consentAccepted", e.target.checked)}
              style={{ marginTop: 2 }}
            />
            <span>{t.consent}</span>
          </label>
        </div>

        {error ? <div style={{ marginTop: 9, fontSize: 12, color: "#B91C1C", fontWeight: 800 }}>{error}</div> : null}
        {success ? <div style={{ marginTop: 9, fontSize: 12, color: "#166534", fontWeight: 800 }}>{success}</div> : null}

        <motion.button whileTap={{ scale: 0.98 }} type="submit" disabled={loading} style={{ marginTop: 12, width: "100%", height: 44, border: "none", borderRadius: 12, background: loading ? "#CBD5E1" : `linear-gradient(135deg,${DEEP},${MID})`, color: "#fff", fontFamily: "'Sora',sans-serif", fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, cursor: loading ? "not-allowed" : "pointer" }}>
          <UserPlus style={{ width: 15, height: 15 }} /> {loading ? t.submitting : t.submit}
        </motion.button>
      </form>

      <div style={{ marginTop: 12, textAlign: "center", fontSize: 12, color: "#64748B", fontWeight: 700 }}>
        {t.loginText}{" "}
        <button onClick={() => navigate("/lab-partner/login")} style={{ border: "none", background: "transparent", color: DEEP, fontWeight: 900, cursor: "pointer" }}>
          {t.loginBtn}
        </button>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  height: 39,
  borderRadius: 10,
  border: "1.5px solid #D1D5DB",
  padding: "0 10px",
  fontSize: 12.5,
  fontWeight: 700,
  outline: "none",
  background: "#fff",
};

const fieldCardStyle = {
  borderRadius: 12,
  border: "1px solid #E2E8F0",
  background: "#F8FAFC",
  padding: 10,
};

const fieldLabelStyle = {
  fontSize: 12,
  fontWeight: 900,
  color: "#0B1F16",
  marginBottom: 6,
};

const stepTitleStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12,
  fontWeight: 900,
  color: "#14532D",
};

const stepSubStyle = {
  fontSize: 11,
  fontWeight: 700,
  color: "#475569",
  lineHeight: 1.45,
};
