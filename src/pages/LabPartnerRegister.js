import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FlaskConical, UserPlus } from "lucide-react";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const DEEP = "#0C5A3E";
const MID = "#0E7A4F";

export default function LabPartnerRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    organization: "",
    city: "Noida",
    pincode: "",
    labAddress: "",
    areas: "",
    licenseNumber: "",
    licenseAuthority: "",
    licenseValidUpto: "",
    gstNumber: "",
    panNumber: "",
    password: "",
  });
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  function onChange(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setSuccess("");

    if (!form.name.trim() || !form.email.trim() || !form.phone.trim() || !form.password.trim() || !form.licenseNumber.trim() || !form.labAddress.trim() || !form.pincode.trim()) {
      setError("Please fill all required fields including license and lab address.");
      return;
    }
    if (!documents.length) {
      setError("Please upload at least one verification document.");
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("name", form.name.trim());
      fd.append("email", form.email.trim());
      fd.append("phone", form.phone.trim());
      fd.append("organization", form.organization.trim());
      fd.append("city", form.city.trim() || "Noida");
      fd.append("pincode", form.pincode.trim());
      fd.append("labAddress", form.labAddress.trim());
      fd.append("licenseNumber", form.licenseNumber.trim());
      fd.append("licenseAuthority", form.licenseAuthority.trim());
      fd.append("licenseValidUpto", form.licenseValidUpto.trim());
      fd.append("gstNumber", form.gstNumber.trim());
      fd.append("panNumber", form.panNumber.trim());
      fd.append(
        "areas",
        form.areas
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean)
          .join(",")
      );
      fd.append("password", form.password);
      documents.forEach((file) => fd.append("documents", file));

      await axios.post(`${API_BASE_URL}/api/lab-partners/register`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setSuccess("Registration submitted for compliance verification. You can login after admin approval.");
      setTimeout(() => navigate("/lab-partner/login"), 1200);
    } catch (err) {
      setError(err?.response?.data?.error || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", minHeight: "100vh", padding: 14, background: "linear-gradient(180deg,#ECFDF5 0%,#E6F4FF 50%,#F8FAFC 100%)" }}>
      <div style={{ background: "linear-gradient(135deg,#0B4D35,#0A623E)", borderRadius: 20, padding: 14, color: "#fff", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 14, background: "rgba(0,217,126,0.18)", display: "grid", placeItems: "center" }}>
            <FlaskConical style={{ width: 18, height: 18 }} />
          </div>
          <div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 900, fontSize: 18 }}>Lab Partner Registration</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>Join GoDavaii diagnostics operations network.</div>
          </div>
        </div>
      </div>

      <form onSubmit={onSubmit} style={{ background: "rgba(255,255,255,0.92)", border: "1px solid rgba(12,90,62,0.08)", borderRadius: 20, padding: 14 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <input value={form.name} onChange={(e) => onChange("name", e.target.value)} placeholder="Full name*" style={inputStyle} />
          <input value={form.email} onChange={(e) => onChange("email", e.target.value)} placeholder="Email*" style={inputStyle} />
          <input value={form.phone} onChange={(e) => onChange("phone", e.target.value)} placeholder="Phone*" style={inputStyle} />
          <input value={form.organization} onChange={(e) => onChange("organization", e.target.value)} placeholder="Lab / Organization name" style={inputStyle} />
          <input value={form.city} onChange={(e) => onChange("city", e.target.value)} placeholder="City" style={inputStyle} />
          <input value={form.pincode} onChange={(e) => onChange("pincode", e.target.value)} placeholder="Pincode*" style={inputStyle} />
          <input value={form.labAddress} onChange={(e) => onChange("labAddress", e.target.value)} placeholder="Lab Address*" style={inputStyle} />
          <input value={form.areas} onChange={(e) => onChange("areas", e.target.value)} placeholder="Service areas (comma separated)" style={inputStyle} />
          <input value={form.licenseNumber} onChange={(e) => onChange("licenseNumber", e.target.value)} placeholder="NABL/State License Number*" style={inputStyle} />
          <input value={form.licenseAuthority} onChange={(e) => onChange("licenseAuthority", e.target.value)} placeholder="License Issuing Authority" style={inputStyle} />
          <input type="date" value={form.licenseValidUpto} onChange={(e) => onChange("licenseValidUpto", e.target.value)} placeholder="License Valid Upto" style={inputStyle} />
          <input value={form.gstNumber} onChange={(e) => onChange("gstNumber", e.target.value)} placeholder="GST Number" style={inputStyle} />
          <input value={form.panNumber} onChange={(e) => onChange("panNumber", e.target.value)} placeholder="PAN Number" style={inputStyle} />
          <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setDocuments(Array.from(e.target.files || []))} style={inputStyle} />
          {!!documents.length ? <div style={{ fontSize: 11, color: "#0F766E", fontWeight: 800 }}>{documents.length} document(s) selected</div> : null}
          <input type="password" value={form.password} onChange={(e) => onChange("password", e.target.value)} placeholder="Password*" style={inputStyle} />
        </div>

        {error ? <div style={{ marginTop: 8, fontSize: 12, color: "#B91C1C", fontWeight: 800 }}>{error}</div> : null}
        {success ? <div style={{ marginTop: 8, fontSize: 12, color: "#166534", fontWeight: 800 }}>{success}</div> : null}

        <motion.button whileTap={{ scale: 0.98 }} type="submit" disabled={loading} style={{ marginTop: 10, width: "100%", height: 42, border: "none", borderRadius: 12, background: loading ? "#CBD5E1" : `linear-gradient(135deg,${DEEP},${MID})`, color: "#fff", fontFamily: "'Sora',sans-serif", fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, cursor: loading ? "not-allowed" : "pointer" }}>
          <UserPlus style={{ width: 15, height: 15 }} /> {loading ? "Submitting..." : "Submit for Verification"}
        </motion.button>
      </form>

      <div style={{ marginTop: 10, textAlign: "center", fontSize: 12, color: "#64748B", fontWeight: 700 }}>
        Already registered? <button onClick={() => navigate("/lab-partner/login")} style={{ border: "none", background: "transparent", color: DEEP, fontWeight: 900, cursor: "pointer" }}>Lab Partner Login</button>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  height: 38,
  borderRadius: 10,
  border: "1.5px solid #D1D5DB",
  padding: "0 10px",
  fontSize: 12.5,
  fontWeight: 700,
  outline: "none",
  background: "#fff",
};
