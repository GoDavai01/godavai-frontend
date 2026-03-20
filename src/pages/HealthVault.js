import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { AlertTriangle, ClipboardList, Download, FileText, HeartPulse, Phone, Pill, Plus, Save, Shield, Stethoscope, UserRound, Users, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import DoctorPrescriptionViewDialog from "../components/DoctorPrescriptionViewDialog";
import { getUserAuthToken } from "../lib/userAuth";

const API = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const VAULT_KEY = "gd_health_vault_v2";
const DEEP = "#0C5A3E";
const MID = "#0E7A4F";

function safeParse(json, fallback) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

function makeMember(seed = {}) {
  return {
    id: seed.id || String(Date.now() + Math.random()),
    relation: seed.relation || "Self",
    profile: {
      name: seed.profile?.name || "",
      dob: seed.profile?.dob || "",
      gender: seed.profile?.gender || "",
      bloodGroup: seed.profile?.bloodGroup || "",
      heightCm: seed.profile?.heightCm || "",
      weightKg: seed.profile?.weightKg || "",
    },
    emergency: seed.emergency || { name: "", relation: "", phone: "" },
    conditions: seed.conditions || [],
    allergies: seed.allergies || [],
    medications: seed.medications || [],
    reports: seed.reports || [],
    notes: seed.notes || "",
  };
}

function defaultVault(user) {
  const self = makeMember({
    relation: "Self",
    profile: { name: user?.name || "", dob: user?.dob || "", gender: user?.gender || "" },
  });
  return { members: [self], activeMemberId: self.id };
}

function normalizeVault(raw, user) {
  if (!raw || typeof raw !== "object") return defaultVault(user);
  if (Array.isArray(raw.members) && raw.members.length) {
    const members = raw.members.map((m) => makeMember(m));
    return { members, activeMemberId: raw.activeMemberId || members[0].id };
  }
  // back-compat with old single-profile shape
  const single = makeMember({
    relation: "Self",
    profile: raw.profile || {},
    emergency: raw.emergency || {},
    conditions: raw.conditions || [],
    allergies: raw.allergies || [],
    medications: raw.medications || [],
    reports: raw.reports || [],
    notes: raw.notes || "",
  });
  const family = (raw.family || []).map((f) =>
    makeMember({
      relation: f.relation || "Family",
      profile: { name: f.name || "", dob: f.dob || "", gender: f.gender || "", bloodGroup: f.bloodGroup || "" },
      conditions: f.conditions || [],
      allergies: f.allergies || [],
      medications: f.medications || [],
      reports: f.reports || [],
      notes: f.notes || "",
    })
  );
  return { members: [single, ...family], activeMemberId: single.id };
}

function chipStyle(tone = "green") {
  if (tone === "red") return { bg: "#FEF2F2", bd: "#FECACA", cl: "#B91C1C" };
  if (tone === "blue") return { bg: "#EFF6FF", bd: "#BFDBFE", cl: "#1D4ED8" };
  return { bg: "#ECFDF5", bd: "#BBF7D0", cl: "#065F46" };
}

function Chip({ text, tone = "green", onRemove }) {
  const s = chipStyle(tone);
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999, border: `1px solid ${s.bd}`, background: s.bg, color: s.cl, fontSize: 11, fontWeight: 800, padding: "5px 10px" }}>
      <span>{text}</span>
      {onRemove && (
        <button onClick={onRemove} style={{ border: "none", background: "transparent", cursor: "pointer", color: s.cl, display: "grid", placeItems: "center", padding: 0 }}>
          <X style={{ width: 12, height: 12 }} />
        </button>
      )}
    </div>
  );
}

function Card({ title, icon, right, children }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.92)", border: "1px solid rgba(12,90,62,0.10)", borderRadius: 18, boxShadow: "0 6px 24px rgba(2,10,7,0.06)", padding: 14 }}>
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

function textInputStyle() {
  return { height: 36, borderRadius: 10, border: "1px solid rgba(12,90,62,0.18)", background: "#fff", padding: "0 10px", fontSize: 12.5, fontWeight: 700, color: "#0B1F16", outline: "none", width: "100%" };
}

function miniBtnStyle() {
  return { width: 36, height: 36, borderRadius: 10, border: "none", background: `linear-gradient(135deg,${DEEP},${MID})`, color: "#fff", cursor: "pointer", display: "grid", placeItems: "center", boxShadow: "0 6px 14px rgba(12,90,62,0.2)" };
}

function resolveFileUrl(url) {
  const src = String(url || "").trim();
  if (!src) return "";
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  return `${API}${src.startsWith("/") ? "" : "/"}${src}`;
}

function getVaultReportViewUrl(memberId, reportId) {
  if (!memberId || !reportId) return "";
  return `${API}/api/health-vault/me/members/${encodeURIComponent(memberId)}/reports/${encodeURIComponent(reportId)}/file`;
}

async function openSecureFile(url) {
  const token = localStorage.getItem("token");
  if (!url || !token) return;
  const res = await axios.get(url, {
    responseType: "blob",
    headers: { Authorization: `Bearer ${token}` },
  });
  const blobUrl = window.URL.createObjectURL(res.data);
  window.open(blobUrl, "_blank", "noopener,noreferrer");
  setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);
}

export default function HealthVault() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [vault, setVault] = useState(() => defaultVault(user));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [editBasic, setEditBasic] = useState(false);
  const [editEmergency, setEditEmergency] = useState(false);
  const [newMember, setNewMember] = useState({ name: "", relation: "", dob: "" });
  const [showNewMember, setShowNewMember] = useState(false);
  const [conditionInput, setConditionInput] = useState("");
  const [allergyInput, setAllergyInput] = useState("");
  const [medInput, setMedInput] = useState({ name: "", dose: "", timing: "" });
  const [reportInput, setReportInput] = useState({ title: "", type: "", date: "", category: "Lab Report" });
  const [reportFile, setReportFile] = useState(null);
  const [doctorPrescriptions, setDoctorPrescriptions] = useState([]);
  const [rxLoading, setRxLoading] = useState(false);
  const [viewingRx, setViewingRx] = useState(null);
  const rxSectionRef = useRef(null);
  const location = useLocation();

  const activeMember = useMemo(
    () => vault.members.find((m) => m.id === vault.activeMemberId) || vault.members[0],
    [vault]
  );

  const completeness = useMemo(() => {
    if (!activeMember) return 0;
    let score = 0;
    if (activeMember.profile?.bloodGroup) score += 12;
    if (activeMember.profile?.heightCm && activeMember.profile?.weightKg) score += 12;
    if (activeMember.emergency?.phone) score += 18;
    if (activeMember.conditions?.length) score += 14;
    if (activeMember.allergies?.length) score += 14;
    if (activeMember.medications?.length) score += 15;
    if (activeMember.reports?.length) score += 15;
    return Math.min(score, 100);
  }, [activeMember]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const local = safeParse(localStorage.getItem(VAULT_KEY), null);
      if (mounted && local) setVault(normalizeVault(local, user));
      try {
        const r = await axios.get(`${API}/api/health-vault/me`);
        if (mounted && r?.data) setVault(normalizeVault(r.data, user));
      } catch {
        // local fallback
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [user]);

  useEffect(() => {
    localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
  }, [vault]);

  // Fetch doctor prescriptions for current user
  useEffect(() => {
    const token = getUserAuthToken();
    if (!token) return;
    let cancelled = false;
    async function fetchRx() {
      setRxLoading(true);
      try {
        const { data } = await axios.get(`${API}/api/prescriptions/patient/mine`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled) setDoctorPrescriptions(Array.isArray(data?.prescriptions) ? data.prescriptions : []);
      } catch (err) {
        console.error("Health Vault: Failed to load prescriptions", err?.response?.status, err?.message);
      } finally {
        if (!cancelled) setRxLoading(false);
      }
    }
    fetchRx();
    return () => { cancelled = true; };
  }, [user?._id, user?.userId]);

  // Auto-scroll to prescriptions section if navigated from homepage
  useEffect(() => {
    if (location?.state?.openTab === "prescriptions" && rxSectionRef.current) {
      setTimeout(() => rxSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 400);
    }
  }, [location?.state, rxLoading]);

  function patchActiveMember(patch) {
    setVault((prev) => ({
      ...prev,
      members: prev.members.map((m) => (m.id === prev.activeMemberId ? { ...m, ...patch } : m)),
    }));
  }

  function addMember() {
    if (!newMember.name.trim()) return;
    const m = makeMember({
      relation: newMember.relation || "Family",
      profile: { name: newMember.name.trim(), dob: newMember.dob || "" },
    });
    setVault((prev) => ({ ...prev, members: [...prev.members, m], activeMemberId: m.id }));
    setNewMember({ name: "", relation: "", dob: "" });
    setShowNewMember(false);
  }

  function removeMember(id) {
    setVault((prev) => {
      if (prev.members.length <= 1) {
        setStatus("At least one profile is required");
        return prev;
      }
      const target = prev.members.find((m) => m.id === id);
      if (target?.relation === "Self") {
        setStatus("Self profile cannot be deleted");
        return prev;
      }
      const members = prev.members.filter((m) => m.id !== id);
      const activeMemberId = prev.activeMemberId === id ? members[0]?.id : prev.activeMemberId;
      return { ...prev, members, activeMemberId };
    });
  }

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
    patchActiveMember({ conditions: [...(activeMember.conditions || []), v] });
    setConditionInput("");
  }

  function addAllergy() {
    const v = allergyInput.trim();
    if (!v) return;
    patchActiveMember({ allergies: [...(activeMember.allergies || []), v] });
    setAllergyInput("");
  }

  function addMedication() {
    if (!medInput.name.trim()) return;
    patchActiveMember({ medications: [...(activeMember.medications || []), { ...medInput, id: String(Date.now()) }] });
    setMedInput({ name: "", dose: "", timing: "" });
  }

  function addReport() {
    if (!reportInput.title.trim() && !reportFile) return;
    const report = {
      ...reportInput,
      title: reportInput.title.trim() || reportFile?.name || "Untitled report",
      id: String(Date.now()),
      fileName: reportFile?.name || "",
      mimeType: reportFile?.type || "",
      fileSize: reportFile?.size || 0,
    };
    patchActiveMember({ reports: [...(activeMember.reports || []), report] });
    setReportInput({ title: "", type: "", date: "", category: "Lab Report" });
    setReportFile(null);
  }

  if (!activeMember) return null;

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", minHeight: "100vh", background: "linear-gradient(180deg,#ECFDF5 0%,#EFF6FF 50%,#F8FAFC 100%)", paddingBottom: 120, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: `linear-gradient(135deg,${DEEP} 0%,#083D28 100%)`, color: "#fff", padding: "14px 16px", boxShadow: "0 10px 24px rgba(12,90,62,0.22)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 14, background: "rgba(0,217,126,0.16)", display: "grid", placeItems: "center" }}>
            <Shield style={{ width: 20, height: 20, color: "#00D97E" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 900 }}>Health Vault</div>
            <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.75)", fontWeight: 700 }}>Family-safe profiles, summary-first UI</div>
          </div>
        </div>
      </div>

      <div style={{ padding: 14, display: "grid", gap: 12 }}>
        <Card
          title="Family Profiles"
          icon={<Users style={{ width: 15, height: 15 }} />}
          right={
            <button onClick={() => setShowNewMember((v) => !v)} style={{ border: "none", borderRadius: 999, background: "#ECFDF5", color: DEEP, fontSize: 11, fontWeight: 900, padding: "6px 10px", cursor: "pointer" }}>
              + Add Member
            </button>
          }
        >
          <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
            {vault.members.map((m) => (
              <div key={m.id} style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, overflow: "hidden", border: m.id === vault.activeMemberId ? "none" : "1px solid rgba(12,90,62,0.18)" }}>
                <button
                  onClick={() => setVault((p) => ({ ...p, activeMemberId: m.id }))}
                  style={{
                    flexShrink: 0,
                    height: 34,
                    border: "none",
                    background: m.id === vault.activeMemberId ? `linear-gradient(135deg,${DEEP},${MID})` : "#fff",
                    color: m.id === vault.activeMemberId ? "#fff" : "#1E3A2E",
                    padding: "0 12px",
                    fontSize: 11.5,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  {m.profile?.name || "Unnamed"} · {m.relation || "Member"}
                </button>
                {m.relation !== "Self" && (
                  <button
                    onClick={() => removeMember(m.id)}
                    style={{
                      width: 30,
                      height: 34,
                      border: "none",
                      borderLeft: "1px solid rgba(12,90,62,0.12)",
                      background: m.id === vault.activeMemberId ? "rgba(255,255,255,0.16)" : "#F8FAFC",
                      color: m.id === vault.activeMemberId ? "#fff" : "#B91C1C",
                      cursor: "pointer",
                      display: "grid",
                      placeItems: "center",
                    }}
                    aria-label="Delete member"
                  >
                    <X style={{ width: 12, height: 12 }} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {showNewMember && (
            <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8 }}>
              <input value={newMember.name} onChange={(e) => setNewMember((p) => ({ ...p, name: e.target.value }))} placeholder="Name" style={textInputStyle()} />
              <input value={newMember.relation} onChange={(e) => setNewMember((p) => ({ ...p, relation: e.target.value }))} placeholder="Relation" style={textInputStyle()} />
              <input value={newMember.dob} onChange={(e) => setNewMember((p) => ({ ...p, dob: e.target.value }))} placeholder="DOB" style={textInputStyle()} />
              <button onClick={addMember} style={miniBtnStyle()}><Plus style={{ width: 14, height: 14 }} /></button>
            </div>
          )}
        </Card>

        <Card
          title="Profile Snapshot"
          icon={<UserRound style={{ width: 15, height: 15 }} />}
          right={<button onClick={() => setEditBasic((v) => !v)} style={toggleBtn(editBasic)}>{editBasic ? "Done" : "Edit"}</button>}
        >
          {!editBasic ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12, fontWeight: 700, color: "#334155" }}>
              <div>Name: {activeMember.profile.name || "-"}</div>
              <div>DOB: {activeMember.profile.dob || "-"}</div>
              <div>Gender: {activeMember.profile.gender || "-"}</div>
              <div>Blood: {activeMember.profile.bloodGroup || "-"}</div>
              <div>Height: {activeMember.profile.heightCm || "-"} cm</div>
              <div>Weight: {activeMember.profile.weightKg || "-"} kg</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input value={activeMember.profile.name} onChange={(e) => patchActiveMember({ profile: { ...activeMember.profile, name: e.target.value } })} placeholder="Name" style={textInputStyle()} />
              <input value={activeMember.profile.dob} onChange={(e) => patchActiveMember({ profile: { ...activeMember.profile, dob: e.target.value } })} placeholder="DOB" style={textInputStyle()} />
              <input value={activeMember.profile.gender} onChange={(e) => patchActiveMember({ profile: { ...activeMember.profile, gender: e.target.value } })} placeholder="Gender" style={textInputStyle()} />
              <input value={activeMember.profile.bloodGroup} onChange={(e) => patchActiveMember({ profile: { ...activeMember.profile, bloodGroup: e.target.value } })} placeholder="Blood Group" style={textInputStyle()} />
              <input value={activeMember.profile.heightCm} onChange={(e) => patchActiveMember({ profile: { ...activeMember.profile, heightCm: e.target.value } })} placeholder="Height (cm)" style={textInputStyle()} />
              <input value={activeMember.profile.weightKg} onChange={(e) => patchActiveMember({ profile: { ...activeMember.profile, weightKg: e.target.value } })} placeholder="Weight (kg)" style={textInputStyle()} />
            </div>
          )}
        </Card>

        <Card
          title="Emergency Contact"
          icon={<Phone style={{ width: 15, height: 15 }} />}
          right={<button onClick={() => setEditEmergency((v) => !v)} style={toggleBtn(editEmergency)}>{editEmergency ? "Done" : "Edit"}</button>}
        >
          {!editEmergency ? (
            <div style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>
              {activeMember.emergency.name || "-"} ({activeMember.emergency.relation || "-"}) · {activeMember.emergency.phone || "-"}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input value={activeMember.emergency.name} onChange={(e) => patchActiveMember({ emergency: { ...activeMember.emergency, name: e.target.value } })} placeholder="Contact name" style={textInputStyle()} />
              <input value={activeMember.emergency.relation} onChange={(e) => patchActiveMember({ emergency: { ...activeMember.emergency, relation: e.target.value } })} placeholder="Relation" style={textInputStyle()} />
              <input value={activeMember.emergency.phone} onChange={(e) => patchActiveMember({ emergency: { ...activeMember.emergency, phone: e.target.value } })} placeholder="Phone number" style={{ ...textInputStyle(), gridColumn: "1 / span 2" }} />
            </div>
          )}
        </Card>

        <Card title="Medical Conditions" icon={<HeartPulse style={{ width: 15, height: 15 }} />} right={<Chip text={`${completeness}% Complete`} tone={completeness > 70 ? "green" : completeness > 40 ? "blue" : "red"} />}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {(activeMember.conditions || []).map((c, i) => (
              <Chip key={`${c}-${i}`} text={c} onRemove={() => patchActiveMember({ conditions: activeMember.conditions.filter((_, idx) => idx !== i) })} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={conditionInput} onChange={(e) => setConditionInput(e.target.value)} placeholder="Add condition" style={{ ...textInputStyle(), flex: 1 }} />
            <button onClick={addCondition} style={miniBtnStyle()}><Plus style={{ width: 14, height: 14 }} /></button>
          </div>
        </Card>

        <Card title="Allergies" icon={<AlertTriangle style={{ width: 15, height: 15 }} />}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {(activeMember.allergies || []).map((a, i) => (
              <Chip key={`${a}-${i}`} text={a} tone="red" onRemove={() => patchActiveMember({ allergies: activeMember.allergies.filter((_, idx) => idx !== i) })} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={allergyInput} onChange={(e) => setAllergyInput(e.target.value)} placeholder="Add allergy" style={{ ...textInputStyle(), flex: 1 }} />
            <button onClick={addAllergy} style={miniBtnStyle()}><Plus style={{ width: 14, height: 14 }} /></button>
          </div>
        </Card>

        <Card title="Current Medications" icon={<ClipboardList style={{ width: 15, height: 15 }} />}>
          <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
            {(activeMember.medications || []).map((m) => (
              <div key={m.id} style={{ border: "1px solid #E2E8F0", borderRadius: 12, padding: 10, background: "#fff", display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 900, color: "#0B1F16" }}>{m.name}</div>
                  <div style={{ fontSize: 11.5, color: "#64748B", fontWeight: 700 }}>{m.dose || "-"} · {m.timing || "-"}</div>
                </div>
                <button onClick={() => patchActiveMember({ medications: activeMember.medications.filter((x) => x.id !== m.id) })} style={{ border: "none", background: "transparent", color: "#B91C1C", cursor: "pointer" }}>
                  <X style={{ width: 14, height: 14 }} />
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8 }}>
            <input value={medInput.name} onChange={(e) => setMedInput((p) => ({ ...p, name: e.target.value }))} placeholder="Medicine" style={textInputStyle()} />
            <input value={medInput.dose} onChange={(e) => setMedInput((p) => ({ ...p, dose: e.target.value }))} placeholder="Dose" style={textInputStyle()} />
            <input value={medInput.timing} onChange={(e) => setMedInput((p) => ({ ...p, timing: e.target.value }))} placeholder="Timing" style={textInputStyle()} />
            <button onClick={addMedication} style={miniBtnStyle()}><Plus style={{ width: 14, height: 14 }} /></button>
          </div>
        </Card>

        {/* Doctor Prescriptions */}
        <div ref={rxSectionRef}>
          <Card title="Doctor Prescriptions" icon={<Stethoscope style={{ width: 15, height: 15 }} />}>
            {rxLoading ? (
              <div style={{ padding: 20, textAlign: "center", fontSize: 12, fontWeight: 700, color: "#64748B" }}>
                Loading prescriptions...
              </div>
            ) : doctorPrescriptions.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", fontSize: 12, fontWeight: 700, color: "#94A3B8" }}>
                No prescriptions yet. Doctor prescriptions will appear here after consultations.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {doctorPrescriptions.map((rx) => {
                  const issuedDate = rx.issuedDateLabel || (rx.issuedAt ? new Date(rx.issuedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "");
                  const medCount = Array.isArray(rx.medicines) ? rx.medicines.length : 0;
                  return (
                    <div key={rx._id} style={{ border: "1px solid #BBF7D0", borderRadius: 16, padding: 14, background: "linear-gradient(135deg,#F0FDF4,#FFFFFF)", position: "relative" }}>
                      {/* Header row */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 12, background: "#DCFCE7", display: "grid", placeItems: "center", flexShrink: 0 }}>
                          <span style={{ fontSize: 14, fontWeight: 900, color: "#15803D" }}>Rx</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 900, color: "#0B1F16" }}>
                            Dr. {rx.doctorName || "Doctor"}
                          </div>
                          <div style={{ fontSize: 10.5, color: "#64748B", fontWeight: 700 }}>
                            {rx.doctorSpecialty || ""} {issuedDate ? `· ${issuedDate}` : ""}
                          </div>
                        </div>
                      </div>

                      {/* Diagnosis + Medicines count */}
                      {(rx.diagnosis || medCount > 0) && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                          {rx.diagnosis && (
                            <span style={{ fontSize: 10, fontWeight: 800, color: "#166534", background: "#DCFCE7", padding: "3px 10px", borderRadius: 999 }}>
                              {rx.diagnosis}
                            </span>
                          )}
                          <span style={{ fontSize: 10, fontWeight: 800, color: "#0E7A4F", background: "#E6F5EF", padding: "3px 10px", borderRadius: 999 }}>
                            {medCount} medicine{medCount !== 1 ? "s" : ""}
                          </span>
                        </div>
                      )}

                      {/* Medicine list preview */}
                      {medCount > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                          {rx.medicines.slice(0, 4).map((med, i) => (
                            <span key={i} style={{ fontSize: 10, fontWeight: 700, color: "#475569", background: "#F1F5F9", padding: "2px 8px", borderRadius: 8, border: "1px solid #E2E8F0" }}>
                              <Pill style={{ width: 9, height: 9, display: "inline", marginRight: 3, verticalAlign: "middle" }} />
                              {med.prescribed}
                            </span>
                          ))}
                          {medCount > 4 && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8" }}>+{medCount - 4} more</span>
                          )}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setViewingRx(rx)}
                          style={{ height: 30, padding: "0 12px", borderRadius: 999, border: "1px solid #BBF7D0", background: "#fff", color: "#166534", fontSize: 10.5, fontWeight: 900, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}
                        >
                          <FileText style={{ width: 12, height: 12 }} />
                          View Prescription
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            const token = rx.exportToken || "";
                            const pdfUrl = `${API}/api/prescriptions/detail/${rx._id}/pdf${token ? `?exportToken=${token}` : ""}`;
                            window.open(pdfUrl, "_blank");
                          }}
                          style={{ height: 30, padding: "0 12px", borderRadius: 999, border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#334155", fontSize: 10.5, fontWeight: 900, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}
                        >
                          <Download style={{ width: 12, height: 12 }} />
                          Download PDF
                        </motion.button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Prescription View Dialog */}
        {viewingRx && (
          <DoctorPrescriptionViewDialog
            open={!!viewingRx}
            onOpenChange={(isOpen) => { if (!isOpen) setViewingRx(null); }}
            prescription={viewingRx}
          />
        )}

        <Card title="Reports & Documents" icon={<FileText style={{ width: 15, height: 15 }} />}>
          <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
            {(activeMember.reports || []).map((r) => (
              <div key={r.id} style={{ border: "1px solid #E2E8F0", borderRadius: 12, padding: 10, background: "#fff", display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 900, color: "#0B1F16" }}>{r.title}</div>
                  <div style={{ fontSize: 11.5, color: "#64748B", fontWeight: 700 }}>{r.category || r.type || "Report"} {r.date ? `· ${r.date}` : ""}</div>
                  {(r.fileName || r.mimeType) && (
                    <div style={{ fontSize: 10.5, color: "#0F766E", fontWeight: 800, marginTop: 2 }}>
                      {r.fileName || "Attached file"} {r.fileSize ? `(${Math.round(r.fileSize / 1024)} KB)` : ""}
                    </div>
                  )}
                  {r.fileUrl ? (
                    <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button
                        onClick={() => {
                          const fileUrl = getVaultReportViewUrl(activeMember.id, r.id) || resolveFileUrl(r.fileUrl);
                          if (fileUrl) {
                            openSecureFile(fileUrl).catch(() => {
                              window.open(resolveFileUrl(r.fileUrl), "_blank", "noopener,noreferrer");
                            });
                          }
                        }}
                        style={{ border: "1px solid #A7F3D0", background: "#ECFDF5", color: "#065F46", borderRadius: 999, height: 26, padding: "0 10px", fontSize: 10.5, fontWeight: 900, cursor: "pointer" }}
                      >
                        Open
                      </button>
                      <button
                        onClick={() => navigate(`/ai?autovaultMember=${encodeURIComponent(activeMember.id)}&autovaultReport=${encodeURIComponent(r.id)}&autourl=${encodeURIComponent(resolveFileUrl(r.fileUrl || ""))}&autoname=${encodeURIComponent(r.fileName || r.title || "vault-report")}&source=vault-report&run=${Date.now()}`)}
                        style={{ border: "1px solid #C4B5FD", background: "#F5F3FF", color: "#5B21B6", borderRadius: 999, height: 26, padding: "0 10px", fontSize: 10.5, fontWeight: 900, cursor: "pointer" }}
                      >
                        Analyze in AI
                      </button>
                    </div>
                  ) : null}
                </div>
                <button onClick={() => patchActiveMember({ reports: activeMember.reports.filter((x) => x.id !== r.id) })} style={{ border: "none", background: "transparent", color: "#B91C1C", cursor: "pointer" }}>
                  <X style={{ width: 14, height: 14 }} />
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8 }}>
            <input value={reportInput.title} onChange={(e) => setReportInput((p) => ({ ...p, title: e.target.value }))} placeholder="Report title" style={textInputStyle()} />
            <input value={reportInput.type} onChange={(e) => setReportInput((p) => ({ ...p, type: e.target.value }))} placeholder="Type" style={textInputStyle()} />
            <input value={reportInput.date} onChange={(e) => setReportInput((p) => ({ ...p, date: e.target.value }))} placeholder="Date" style={textInputStyle()} />
            <button onClick={addReport} style={miniBtnStyle()}><Plus style={{ width: 14, height: 14 }} /></button>
          </div>
          <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
            <select value={reportInput.category} onChange={(e) => setReportInput((p) => ({ ...p, category: e.target.value }))} style={{ ...textInputStyle(), width: 160 }}>
              <option>Lab Report</option>
              <option>Prescription</option>
              <option>Discharge Summary</option>
              <option>Imaging Report</option>
              <option>Other Document</option>
            </select>
            <label style={{ ...textInputStyle(), width: "auto", display: "inline-flex", alignItems: "center", cursor: "pointer", padding: "0 10px", gap: 6 }}>
              <FileText style={{ width: 13, height: 13, color: DEEP }} />
              <span style={{ fontSize: 11.5, fontWeight: 800, color: "#14532D" }}>{reportFile ? "Change file" : "Attach file"}</span>
              <input type="file" accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.doc,.docx" style={{ display: "none" }} onChange={(e) => setReportFile(e.target.files?.[0] || null)} />
            </label>
            {reportFile && (
              <div style={{ fontSize: 11, fontWeight: 800, color: "#0F766E" }}>
                {reportFile.name}
              </div>
            )}
          </div>
          <div style={{ marginTop: 6, fontSize: 11, color: "#64748B", fontWeight: 700 }}>
            You can add old lab reports, prescriptions, and medical documents for future AI analysis.
          </div>
        </Card>

        <Card title="Clinical Notes" icon={<FileText style={{ width: 15, height: 15 }} />}>
          <textarea value={activeMember.notes || ""} onChange={(e) => patchActiveMember({ notes: e.target.value })} placeholder="Doctor advice, surgery history, lifestyle notes..." rows={4} style={{ ...textInputStyle(), width: "100%", resize: "vertical", minHeight: 88, paddingTop: 10 }} />
        </Card>

        <motion.button whileTap={{ scale: 0.97 }} onClick={saveVault} disabled={saving || loading} style={{ height: 48, borderRadius: 14, border: "none", background: saving || loading ? "#CBD5E1" : `linear-gradient(135deg,${DEEP},${MID})`, color: "#fff", fontSize: 14, fontWeight: 900, fontFamily: "'Sora',sans-serif", cursor: saving || loading ? "not-allowed" : "pointer", boxShadow: "0 8px 22px rgba(12,90,62,0.28)", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
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

function toggleBtn(active) {
  return {
    border: active ? "none" : "1px solid rgba(12,90,62,0.18)",
    borderRadius: 999,
    background: active ? `linear-gradient(135deg,${DEEP},${MID})` : "#fff",
    color: active ? "#fff" : "#14532D",
    fontSize: 11,
    fontWeight: 900,
    padding: "5px 10px",
    cursor: "pointer",
  };
}
