import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ClipboardList,
  FileText,
  HeartPulse,
  Phone,
  Plus,
  Save,
  Shield,
  UserRound,
  Users,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const API = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const VAULT_KEY = "gd_health_vault_v1";
const DEEP = "#0C5A3E";
const MID = "#0E7A4F";

function safeParse(json, fallback) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

function defaultVault(user) {
  return {
    profile: {
      name: user?.name || "",
      dob: user?.dob || "",
      gender: user?.gender || "",
      bloodGroup: "",
      heightCm: "",
      weightKg: "",
    },
    emergency: { name: "", relation: "", phone: "" },
    conditions: [],
    allergies: [],
    medications: [],
    vitals: [],
    reports: [],
    family: [],
    notes: "",
  };
}

function Pill({ text, tone = "green", onRemove }) {
  const styles =
    tone === "red"
      ? { bg: "#FEF2F2", bd: "#FECACA", cl: "#B91C1C" }
      : tone === "blue"
        ? { bg: "#EFF6FF", bd: "#BFDBFE", cl: "#1D4ED8" }
        : { bg: "#ECFDF5", bd: "#BBF7D0", cl: "#065F46" };
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        borderRadius: 999,
        border: `1px solid ${styles.bd}`,
        background: styles.bg,
        color: styles.cl,
        fontSize: 11,
        fontWeight: 800,
        padding: "5px 10px",
      }}
    >
      <span>{text}</span>
      {onRemove && (
        <button
          onClick={onRemove}
          style={{ border: "none", background: "transparent", color: styles.cl, cursor: "pointer", fontWeight: 900 }}
        >
          ×
        </button>
      )}
    </div>
  );
}

function Card({ title, icon, right, children }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.92)",
        border: "1px solid rgba(12,90,62,0.10)",
        borderRadius: 18,
        boxShadow: "0 6px 24px rgba(2,10,7,0.06)",
        padding: 14,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 10, background: "#ECFDF5", display: "grid", placeItems: "center", color: DEEP }}>
            {icon}
          </div>
          <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 13.5, fontWeight: 900, color: "#0B1F16" }}>{title}</div>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function HealthVault() {
  const { user } = useAuth();
  const [vault, setVault] = useState(() => defaultVault(user));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  const [conditionInput, setConditionInput] = useState("");
  const [allergyInput, setAllergyInput] = useState("");
  const [medInput, setMedInput] = useState({ name: "", dose: "", timing: "" });
  const [familyInput, setFamilyInput] = useState({ name: "", relation: "", age: "" });
  const [reportInput, setReportInput] = useState({ title: "", type: "", date: "" });

  const completeness = useMemo(() => {
    let score = 0;
    if (vault.profile?.bloodGroup) score += 10;
    if (vault.profile?.heightCm && vault.profile?.weightKg) score += 10;
    if (vault.emergency?.phone) score += 20;
    if (vault.conditions?.length) score += 10;
    if (vault.allergies?.length) score += 10;
    if (vault.medications?.length) score += 15;
    if (vault.reports?.length) score += 15;
    if (vault.family?.length) score += 10;
    return Math.min(score, 100);
  }, [vault]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const local = safeParse(localStorage.getItem(VAULT_KEY), null);
      if (mounted && local) setVault(local);
      try {
        const r = await axios.get(`${API}/api/health-vault/me`);
        const data = r?.data;
        if (mounted && data && typeof data === "object") {
          setVault({ ...defaultVault(user), ...data });
        }
      } catch {
        // local fallback stays
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [user]);

  useEffect(() => {
    localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
  }, [vault]);

  async function saveVault() {
    setSaving(true);
    setStatus("");
    try {
      await axios.put(`${API}/api/health-vault/me`, vault);
      setStatus("Saved to cloud");
    } catch {
      setStatus("Saved locally (backend pending)");
    } finally {
      setSaving(false);
      setTimeout(() => setStatus(""), 2200);
    }
  }

  function addCondition() {
    const v = conditionInput.trim();
    if (!v) return;
    setVault((p) => ({ ...p, conditions: [...p.conditions, v] }));
    setConditionInput("");
  }

  function addAllergy() {
    const v = allergyInput.trim();
    if (!v) return;
    setVault((p) => ({ ...p, allergies: [...p.allergies, v] }));
    setAllergyInput("");
  }

  function addMedication() {
    if (!medInput.name.trim()) return;
    setVault((p) => ({ ...p, medications: [...p.medications, { ...medInput, id: Date.now().toString() }] }));
    setMedInput({ name: "", dose: "", timing: "" });
  }

  function addFamily() {
    if (!familyInput.name.trim()) return;
    setVault((p) => ({ ...p, family: [...p.family, { ...familyInput, id: Date.now().toString() }] }));
    setFamilyInput({ name: "", relation: "", age: "" });
  }

  function addReport() {
    if (!reportInput.title.trim()) return;
    setVault((p) => ({ ...p, reports: [...p.reports, { ...reportInput, id: Date.now().toString() }] }));
    setReportInput({ title: "", type: "", date: "" });
  }

  function exportSummary() {
    const summary = [
      `Name: ${vault.profile.name || "-"}`,
      `Blood Group: ${vault.profile.bloodGroup || "-"}`,
      `Emergency: ${vault.emergency.name || "-"} (${vault.emergency.phone || "-"})`,
      `Conditions: ${vault.conditions.join(", ") || "-"}`,
      `Allergies: ${vault.allergies.join(", ") || "-"}`,
      `Medications: ${vault.medications.map((m) => `${m.name} ${m.dose || ""}`.trim()).join(", ") || "-"}`,
    ].join("\n");
    navigator.clipboard?.writeText(summary).then(() => setStatus("Summary copied"));
  }

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", minHeight: "100vh", background: "linear-gradient(180deg,#ECFDF5 0%,#EFF6FF 50%,#F8FAFC 100%)", paddingBottom: 120, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: `linear-gradient(135deg,${DEEP} 0%,#083D28 100%)`, color: "#fff", padding: "14px 16px", boxShadow: "0 10px 24px rgba(12,90,62,0.22)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 14, background: "rgba(0,217,126,0.16)", display: "grid", placeItems: "center" }}>
              <Shield style={{ width: 20, height: 20, color: "#00D97E" }} />
            </div>
            <div>
              <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 900 }}>Health Vault</div>
              <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.75)", fontWeight: 700 }}>Private health records for family</div>
            </div>
          </div>
          <button onClick={exportSummary} style={{ border: "1px solid rgba(255,255,255,0.22)", background: "rgba(255,255,255,0.12)", color: "#fff", borderRadius: 999, padding: "6px 10px", fontSize: 10.5, fontWeight: 800, cursor: "pointer" }}>
            Export
          </button>
        </div>
      </div>

      <div style={{ padding: 14, display: "grid", gap: 12 }}>
        <Card
          title="Vault Status"
          icon={<Activity style={{ width: 15, height: 15 }} />}
          right={<Pill text={`${completeness}% Complete`} tone={completeness > 70 ? "green" : completeness > 40 ? "blue" : "red"} />}
        >
          <div style={{ fontSize: 12, color: "#475569", fontWeight: 700, marginBottom: 8 }}>
            Keep this updated for faster doctor consult, safer medicine checks, and better AI guidance.
          </div>
          <div style={{ height: 8, borderRadius: 999, background: "#E2E8F0", overflow: "hidden" }}>
            <div style={{ width: `${completeness}%`, height: "100%", background: `linear-gradient(90deg,${DEEP},${MID})` }} />
          </div>
        </Card>

        <Card title="Profile Snapshot" icon={<UserRound style={{ width: 15, height: 15 }} />}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input value={vault.profile.name} onChange={(e) => setVault((p) => ({ ...p, profile: { ...p.profile, name: e.target.value } }))} placeholder="Name" style={inputStyle()} />
            <input value={vault.profile.dob} onChange={(e) => setVault((p) => ({ ...p, profile: { ...p.profile, dob: e.target.value } }))} placeholder="DOB (YYYY-MM-DD)" style={inputStyle()} />
            <input value={vault.profile.gender} onChange={(e) => setVault((p) => ({ ...p, profile: { ...p.profile, gender: e.target.value } }))} placeholder="Gender" style={inputStyle()} />
            <input value={vault.profile.bloodGroup} onChange={(e) => setVault((p) => ({ ...p, profile: { ...p.profile, bloodGroup: e.target.value } }))} placeholder="Blood Group" style={inputStyle()} />
            <input value={vault.profile.heightCm} onChange={(e) => setVault((p) => ({ ...p, profile: { ...p.profile, heightCm: e.target.value } }))} placeholder="Height (cm)" style={inputStyle()} />
            <input value={vault.profile.weightKg} onChange={(e) => setVault((p) => ({ ...p, profile: { ...p.profile, weightKg: e.target.value } }))} placeholder="Weight (kg)" style={inputStyle()} />
          </div>
        </Card>

        <Card title="Emergency Contact" icon={<Phone style={{ width: 15, height: 15 }} />}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input value={vault.emergency.name} onChange={(e) => setVault((p) => ({ ...p, emergency: { ...p.emergency, name: e.target.value } }))} placeholder="Contact name" style={inputStyle()} />
            <input value={vault.emergency.relation} onChange={(e) => setVault((p) => ({ ...p, emergency: { ...p.emergency, relation: e.target.value } }))} placeholder="Relation" style={inputStyle()} />
            <input value={vault.emergency.phone} onChange={(e) => setVault((p) => ({ ...p, emergency: { ...p.emergency, phone: e.target.value } }))} placeholder="Phone number" style={{ ...inputStyle(), gridColumn: "1 / span 2" }} />
          </div>
        </Card>

        <Card title="Medical Conditions" icon={<HeartPulse style={{ width: 15, height: 15 }} />}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {vault.conditions.map((c, i) => (
              <Pill key={`${c}-${i}`} text={c} onRemove={() => setVault((p) => ({ ...p, conditions: p.conditions.filter((_, idx) => idx !== i) }))} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={conditionInput} onChange={(e) => setConditionInput(e.target.value)} placeholder="Add condition (e.g. Diabetes)" style={{ ...inputStyle(), flex: 1 }} />
            <button onClick={addCondition} style={addBtnStyle()}><Plus style={{ width: 14, height: 14 }} /></button>
          </div>
        </Card>

        <Card title="Allergies" icon={<AlertTriangle style={{ width: 15, height: 15 }} />}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {vault.allergies.map((a, i) => (
              <Pill key={`${a}-${i}`} text={a} tone="red" onRemove={() => setVault((p) => ({ ...p, allergies: p.allergies.filter((_, idx) => idx !== i) }))} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={allergyInput} onChange={(e) => setAllergyInput(e.target.value)} placeholder="Add allergy (e.g. Penicillin)" style={{ ...inputStyle(), flex: 1 }} />
            <button onClick={addAllergy} style={addBtnStyle()}><Plus style={{ width: 14, height: 14 }} /></button>
          </div>
        </Card>

        <Card title="Current Medications" icon={<ClipboardList style={{ width: 15, height: 15 }} />}>
          <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
            {vault.medications.map((m) => (
              <div key={m.id} style={{ border: "1px solid #E2E8F0", borderRadius: 12, padding: 10, background: "#fff" }}>
                <div style={{ fontSize: 12.5, fontWeight: 900, color: "#0B1F16" }}>{m.name}</div>
                <div style={{ fontSize: 11.5, color: "#475569", fontWeight: 700 }}>{m.dose || "-"} · {m.timing || "-"}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8 }}>
            <input value={medInput.name} onChange={(e) => setMedInput((p) => ({ ...p, name: e.target.value }))} placeholder="Medicine" style={inputStyle()} />
            <input value={medInput.dose} onChange={(e) => setMedInput((p) => ({ ...p, dose: e.target.value }))} placeholder="Dose" style={inputStyle()} />
            <input value={medInput.timing} onChange={(e) => setMedInput((p) => ({ ...p, timing: e.target.value }))} placeholder="Timing" style={inputStyle()} />
            <button onClick={addMedication} style={addBtnStyle()}><Plus style={{ width: 14, height: 14 }} /></button>
          </div>
        </Card>

        <Card title="Reports & Documents" icon={<FileText style={{ width: 15, height: 15 }} />}>
          <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
            {vault.reports.map((r) => (
              <div key={r.id} style={{ border: "1px solid #E2E8F0", borderRadius: 12, padding: 10, background: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 900, color: "#0B1F16" }}>{r.title}</div>
                  <div style={{ fontSize: 11.5, color: "#64748B", fontWeight: 700 }}>{r.type || "Report"} {r.date ? `· ${r.date}` : ""}</div>
                </div>
                <button onClick={() => setVault((p) => ({ ...p, reports: p.reports.filter((x) => x.id !== r.id) }))} style={{ border: "none", background: "transparent", color: "#B91C1C", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8 }}>
            <input value={reportInput.title} onChange={(e) => setReportInput((p) => ({ ...p, title: e.target.value }))} placeholder="Report title" style={inputStyle()} />
            <input value={reportInput.type} onChange={(e) => setReportInput((p) => ({ ...p, type: e.target.value }))} placeholder="Type" style={inputStyle()} />
            <input value={reportInput.date} onChange={(e) => setReportInput((p) => ({ ...p, date: e.target.value }))} placeholder="Date" style={inputStyle()} />
            <button onClick={addReport} style={addBtnStyle()}><Plus style={{ width: 14, height: 14 }} /></button>
          </div>
        </Card>

        <Card title="Family Profiles" icon={<Users style={{ width: 15, height: 15 }} />}>
          <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
            {vault.family.map((f) => (
              <div key={f.id} style={{ border: "1px solid #E2E8F0", borderRadius: 12, padding: 10, background: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 900, color: "#0B1F16" }}>{f.name}</div>
                  <div style={{ fontSize: 11.5, color: "#64748B", fontWeight: 700 }}>{f.relation || "-"} {f.age ? `· ${f.age} yrs` : ""}</div>
                </div>
                <button onClick={() => setVault((p) => ({ ...p, family: p.family.filter((x) => x.id !== f.id) }))} style={{ border: "none", background: "transparent", color: "#B91C1C", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8 }}>
            <input value={familyInput.name} onChange={(e) => setFamilyInput((p) => ({ ...p, name: e.target.value }))} placeholder="Name" style={inputStyle()} />
            <input value={familyInput.relation} onChange={(e) => setFamilyInput((p) => ({ ...p, relation: e.target.value }))} placeholder="Relation" style={inputStyle()} />
            <input value={familyInput.age} onChange={(e) => setFamilyInput((p) => ({ ...p, age: e.target.value }))} placeholder="Age" style={inputStyle()} />
            <button onClick={addFamily} style={addBtnStyle()}><Plus style={{ width: 14, height: 14 }} /></button>
          </div>
        </Card>

        <Card title="Clinical Notes" icon={<FileText style={{ width: 15, height: 15 }} />}>
          <textarea
            value={vault.notes}
            onChange={(e) => setVault((p) => ({ ...p, notes: e.target.value }))}
            placeholder="Any ongoing treatment plan, surgery history, lifestyle notes..."
            rows={4}
            style={{ ...inputStyle(), width: "100%", resize: "vertical", minHeight: 88, paddingTop: 10 }}
          />
        </Card>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={saveVault}
          disabled={saving || loading}
          style={{
            height: 48,
            borderRadius: 14,
            border: "none",
            background: saving || loading ? "#CBD5E1" : `linear-gradient(135deg,${DEEP},${MID})`,
            color: "#fff",
            fontSize: 14,
            fontWeight: 900,
            fontFamily: "'Sora',sans-serif",
            cursor: saving || loading ? "not-allowed" : "pointer",
            boxShadow: "0 8px 22px rgba(12,90,62,0.28)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <Save style={{ width: 15, height: 15 }} />
          {saving ? "Saving..." : "Save Vault"}
        </motion.button>

        {(status || loading) && (
          <div style={{ fontSize: 11.5, fontWeight: 800, color: loading ? "#64748B" : "#0F766E" }}>
            {loading ? "Loading vault..." : status}
          </div>
        )}
      </div>
    </div>
  );
}

function inputStyle() {
  return {
    height: 36,
    borderRadius: 10,
    border: "1px solid rgba(12,90,62,0.18)",
    background: "#fff",
    padding: "0 10px",
    fontSize: 12.5,
    fontWeight: 700,
    color: "#0B1F16",
    outline: "none",
    width: "100%",
  };
}

function addBtnStyle() {
  return {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: "none",
    background: `linear-gradient(135deg,${DEEP},${MID})`,
    color: "#fff",
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
    boxShadow: "0 6px 14px rgba(12,90,62,0.2)",
  };
}

