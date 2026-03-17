import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  CalendarDays,
  ClipboardList,
  Download,
  FileText,
  Pill,
  Share2,
  ShieldAlert,
  Stethoscope,
  TestTube2,
  UserRound,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { getUserAuthHeaders, getUserAuthToken } from "../lib/userAuth";

const API = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

function formatDate(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function toModeLabel(value) {
  const mode = String(value || "").trim().toLowerCase();
  if (mode === "video") return "Video consult";
  if (mode === "call" || mode === "audio") return "Audio consult";
  if (mode === "inperson") return "In-person visit";
  return String(value || "").trim();
}

function buildMedicineInstruction(medicine = {}) {
  return [medicine.dosage, medicine.frequency, medicine.duration].map((value) => String(value || "").trim()).filter(Boolean).join(" | ");
}

function buildPrescriptionFileName(prescription = {}) {
  const suffix = String(prescription?._id || "rx").slice(-8) || "rx";
  return `godavaii-prescription-${suffix}.pdf`;
}

function buildPrescriptionPdfUrl(prescription = {}) {
  const id = String(prescription?._id || "").trim();
  if (!id) return "";
  const params = new URLSearchParams();
  const exportToken = String(prescription?.exportToken || "").trim();
  if (exportToken) params.set("exportToken", exportToken);
  const query = params.toString();
  return `${API}/api/prescriptions/detail/${id}/pdf${query ? `?${query}` : ""}`;
}

function parseContentDispositionFileName(value = "") {
  const text = String(value || "");
  if (!text) return "";

  const utfMatch = text.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1]).trim();
    } catch (_) {
      return utfMatch[1].trim();
    }
  }

  const asciiMatch = text.match(/filename="?([^"]+)"?/i);
  return String(asciiMatch?.[1] || "").trim();
}

function downloadBlob(blob, fileName) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1500);
}

function buildShareText(prescription = {}, medicines = []) {
  const doctorLine = [prescription?.doctorName, prescription?.doctorSpecialty].map((value) => String(value || "").trim()).filter(Boolean).join(", ");
  const medicineLine = medicines.slice(0, 4).map((medicine) => medicine?.prescribed).filter(Boolean).join(", ");
  return [
    prescription?.branding || "GoDavaii Prescription",
    doctorLine ? `Doctor: ${doctorLine}` : "",
    prescription?.patientName ? `Patient: ${prescription.patientName}` : "",
    prescription?.diagnosis ? `Diagnosis: ${prescription.diagnosis}` : "",
    medicineLine ? `Medicines: ${medicineLine}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function SectionLabel({ icon: Icon, label }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11,
        fontWeight: 900,
        color: "#166534",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      }}
    >
      <Icon style={{ width: 14, height: 14 }} />
      {label}
    </div>
  );
}

function MetaTile({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div
      style={{
        borderRadius: 18,
        border: "1px solid rgba(16,185,129,0.12)",
        background: "#FFFFFF",
        padding: 14,
        boxShadow: "0 8px 22px rgba(15,23,42,0.04)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 10,
            background: "rgba(22,163,74,0.1)",
            display: "grid",
            placeItems: "center",
            color: "#166534",
            flexShrink: 0,
          }}
        >
          <Icon style={{ width: 14, height: 14 }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 900, color: "#4B7A62", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {label}
          </div>
          <div style={{ marginTop: 4, fontSize: 13, lineHeight: 1.45, color: "#0F172A", fontWeight: 700 }}>{value}</div>
        </div>
      </div>
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick, disabled, busy, variant = "solid" }) {
  const isSolid = variant === "solid";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      style={{
        flex: 1,
        minWidth: 150,
        height: 42,
        borderRadius: 999,
        border: isSolid ? "none" : "1px solid rgba(16,185,129,0.18)",
        background: disabled
          ? "#D1D5DB"
          : isSolid
          ? "linear-gradient(135deg,#0C5A3E,#0E7A4F)"
          : "#FFFFFF",
        color: disabled ? "#FFFFFF" : isSolid ? "#FFFFFF" : "#0C5A3E",
        fontSize: 12,
        fontWeight: 900,
        fontFamily: "'Sora',sans-serif",
        cursor: disabled || busy ? "not-allowed" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        boxShadow: isSolid && !disabled ? "0 8px 20px rgba(12,90,62,0.24)" : "none",
      }}
    >
      <Icon style={{ width: 15, height: 15 }} />
      {busy ? `${label}...` : label}
    </button>
  );
}

export default function DoctorPrescriptionViewDialog({ prescription, open, onOpenChange }) {
  const medicines = Array.isArray(prescription?.medicines) ? prescription.medicines : [];
  const testsAdvised = Array.isArray(prescription?.testsAdvised) ? prescription.testsAdvised.filter(Boolean) : [];
  const followUpDate = formatDate(prescription?.followUpDate);
  const issuedDate = formatDate(prescription?.issuedAt || prescription?.sentToPatientAt || prescription?.createdAt);
  const consultLine = useMemo(
    () =>
      [prescription?.appointmentDateLabel || prescription?.appointmentDate, prescription?.appointmentTime, toModeLabel(prescription?.consultMode)]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .join(" | "),
    [prescription?.appointmentDate, prescription?.appointmentDateLabel, prescription?.appointmentTime, prescription?.consultMode]
  );
  const doctorLine = useMemo(
    () =>
      [prescription?.doctorName, prescription?.doctorQualification, prescription?.doctorSpecialty]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .join(" | "),
    [prescription?.doctorName, prescription?.doctorQualification, prescription?.doctorSpecialty]
  );
  const [actionState, setActionState] = useState({ busy: false, type: "", message: "" });

  useEffect(() => {
    setActionState({ busy: false, type: "", message: "" });
  }, [open, prescription?._id]);

  const canExport = !!prescription?._id;

  async function fetchPrescriptionPdf() {
    const token = getUserAuthToken();
    const headers = getUserAuthHeaders(token);
    const url = buildPrescriptionPdfUrl(prescription);
    if (!url) throw new Error("Missing prescription id");

    const res = await axios.get(url, {
      headers: headers.Authorization ? headers : undefined,
      responseType: "blob",
      withCredentials: true,
    });
    const contentType = String(res?.headers?.["content-type"] || "application/pdf").trim() || "application/pdf";
    const blob = res?.data instanceof Blob ? res.data : new Blob([res.data], { type: contentType });
    const fileName =
      parseContentDispositionFileName(res?.headers?.["content-disposition"]) || buildPrescriptionFileName(prescription);
    return { blob, fileName };
  }

  async function handleDownload() {
    if (!canExport) return;
    setActionState({ busy: true, type: "download", message: "" });
    try {
      const { blob, fileName } = await fetchPrescriptionPdf();
      downloadBlob(blob, fileName);
      setActionState({ busy: false, type: "download", message: "Prescription PDF download start ho gaya." });
    } catch (_) {
      setActionState({ busy: false, type: "download", message: "Prescription PDF abhi download nahi ho paya." });
    }
  }

  async function handleShare() {
    if (!canExport) return;
    setActionState({ busy: true, type: "share", message: "" });
    const shareText = buildShareText(prescription, medicines);
    try {
      const { blob, fileName } = await fetchPrescriptionPdf();
      if (typeof navigator !== "undefined" && typeof File !== "undefined") {
        const file = new File([blob], fileName, { type: "application/pdf" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: prescription?.branding || "GoDavaii Prescription",
            text: shareText,
            files: [file],
          });
          setActionState({ busy: false, type: "share", message: "Prescription share sheet open ho gayi." });
          return;
        }
      }

      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({
          title: prescription?.branding || "GoDavaii Prescription",
          text: shareText,
        });
        setActionState({ busy: false, type: "share", message: "Prescription details share ho gayi." });
        return;
      }

      downloadBlob(blob, fileName);
      setActionState({
        busy: false,
        type: "share",
        message: "Native share unavailable tha, isliye PDF download kar diya gaya.",
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        setActionState({ busy: false, type: "share", message: "" });
        return;
      }

      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        try {
          await navigator.share({
            title: prescription?.branding || "GoDavaii Prescription",
            text: shareText,
          });
          setActionState({
            busy: false,
            type: "share",
            message: "PDF attach nahi ho paya, lekin prescription details share ho gayi.",
          });
          return;
        } catch (fallbackError) {
          if (fallbackError?.name === "AbortError") {
            setActionState({ busy: false, type: "share", message: "" });
            return;
          }
        }
      }

      setActionState({ busy: false, type: "share", message: "Prescription share abhi nahi ho paya." });
    }
  }

  return (
    <Dialog open={!!open} onOpenChange={onOpenChange}>
      <DialogContent
        style={{
          maxWidth: 680,
          width: "calc(100vw - 20px)",
          borderRadius: 28,
          padding: 0,
          overflow: "hidden",
          background: "linear-gradient(180deg,#F3FFF8 0%,#FFFFFF 42%)",
          border: "1px solid rgba(16,185,129,0.14)",
        }}
      >
        <div style={{ maxHeight: "calc(100vh - 28px)", overflowY: "auto" }}>
          <div style={{ padding: 22 }}>
            <DialogHeader>
              <DialogTitle style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, color: "#0F172A" }}>
                {prescription?.branding || "Doctor Prescription"}
              </DialogTitle>
            </DialogHeader>

            <div
              style={{
                marginTop: 14,
                borderRadius: 24,
                background: "linear-gradient(135deg,#0C5A3E,#0E7A4F)",
                padding: 18,
                color: "#FFFFFF",
                boxShadow: "0 18px 42px rgba(12,90,62,0.22)",
              }}
            >
              <div style={{ display: "flex", gap: 12, justifyContent: "space-between", flexWrap: "wrap" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: "#A7F3D0" }}>
                    Digital Rx
                  </div>
                  <div style={{ marginTop: 6, fontSize: 20, fontWeight: 900, fontFamily: "'Sora',sans-serif" }}>
                    {prescription?.doctorName || "Your doctor"}
                  </div>
                  {prescription?.doctorSpecialty ? (
                    <div style={{ marginTop: 4, fontSize: 12.5, fontWeight: 700, color: "#D1FAE5" }}>{prescription.doctorSpecialty}</div>
                  ) : null}
                </div>
                <div
                  style={{
                    alignSelf: "flex-start",
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.14)",
                    border: "1px solid rgba(255,255,255,0.18)",
                    padding: "8px 12px",
                    fontSize: 11,
                    fontWeight: 800,
                    color: "#ECFDF5",
                  }}
                >
                  {issuedDate ? `Issued ${issuedDate}` : "Shared on GoDavaii"}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                {prescription?.diagnosis ? (
                  <span
                    style={{
                      borderRadius: 999,
                      padding: "6px 10px",
                      background: "rgba(255,255,255,0.12)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    Diagnosis: {prescription.diagnosis}
                  </span>
                ) : null}
                {followUpDate ? (
                  <span
                    style={{
                      borderRadius: 999,
                      padding: "6px 10px",
                      background: "rgba(255,255,255,0.12)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    Follow-up: {followUpDate}
                  </span>
                ) : null}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginTop: 16 }}>
              <MetaTile icon={Stethoscope} label="Doctor" value={doctorLine} />
              <MetaTile icon={UserRound} label="Patient" value={prescription?.patientName} />
              <MetaTile icon={CalendarDays} label="Consult" value={consultLine} />
              <MetaTile icon={ClipboardList} label="Clinic" value={[prescription?.clinicName, prescription?.clinicAddress].filter(Boolean).join(", ")} />
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
              <ActionButton
                icon={Download}
                label="Download PDF"
                onClick={handleDownload}
                disabled={!canExport}
                busy={actionState.busy && actionState.type === "download"}
              />
              <ActionButton
                icon={Share2}
                label="Share"
                onClick={handleShare}
                disabled={!canExport}
                busy={actionState.busy && actionState.type === "share"}
                variant="outline"
              />
            </div>

            {actionState.message ? (
              <div
                style={{
                  marginTop: 12,
                  borderRadius: 14,
                  background: "#ECFDF5",
                  border: "1px solid rgba(16,185,129,0.14)",
                  padding: "10px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#166534",
                }}
              >
                {actionState.message}
              </div>
            ) : null}

            {prescription?.complaint ? (
              <div style={{ marginTop: 20 }}>
                <SectionLabel icon={ClipboardList} label="Complaint" />
                <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6, color: "#334155", fontWeight: 600 }}>
                  {prescription.complaint}
                </div>
              </div>
            ) : null}

            {prescription?.diagnosis ? (
              <div style={{ marginTop: 20 }}>
                <SectionLabel icon={Stethoscope} label="Diagnosis" />
                <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6, color: "#334155", fontWeight: 600 }}>
                  {prescription.diagnosis}
                </div>
              </div>
            ) : null}

            {medicines.length > 0 ? (
              <div style={{ marginTop: 22 }}>
                <SectionLabel icon={Pill} label="Medicines" />
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
                  {medicines.map((medicine, index) => {
                    const instruction = buildMedicineInstruction(medicine);
                    return (
                      <div
                        key={`${medicine?.prescribed || "medicine"}-${index}`}
                        style={{
                          border: "1px solid rgba(148,163,184,0.16)",
                          borderRadius: 20,
                          padding: 16,
                          background: "#FFFFFF",
                          boxShadow: "0 12px 26px rgba(15,23,42,0.05)",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 15.5, fontWeight: 900, color: "#0F172A", fontFamily: "'Sora',sans-serif" }}>
                              {medicine?.prescribed || `Medicine ${index + 1}`}
                            </div>
                            {medicine?.salt ? (
                              <div style={{ marginTop: 3, fontSize: 12, color: "#64748B", fontWeight: 700 }}>{medicine.salt}</div>
                            ) : null}
                          </div>
                          <div
                            style={{
                              flexShrink: 0,
                              borderRadius: 999,
                              padding: "5px 9px",
                              background: "#ECFDF5",
                              color: "#166534",
                              fontSize: 10,
                              fontWeight: 900,
                            }}
                          >
                            #{index + 1}
                          </div>
                        </div>

                        {instruction ? (
                          <div style={{ marginTop: 10, fontSize: 12, color: "#166534", fontWeight: 800 }}>{instruction}</div>
                        ) : null}
                        {medicine?.howToTake ? (
                          <div style={{ marginTop: 8, fontSize: 12, color: "#334155", fontWeight: 700 }}>
                            How to take: {medicine.howToTake}
                          </div>
                        ) : null}
                        {medicine?.notes ? (
                          <div style={{ marginTop: 7, fontSize: 12, color: "#475569", fontWeight: 600 }}>Notes: {medicine.notes}</div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {testsAdvised.length > 0 ? (
              <div style={{ marginTop: 22 }}>
                <SectionLabel icon={TestTube2} label="Tests Advised" />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  {testsAdvised.map((test) => (
                    <span
                      key={test}
                      style={{
                        background: "#F8FAFC",
                        border: "1px solid #E2E8F0",
                        borderRadius: 999,
                        padding: "6px 10px",
                        fontSize: 11,
                        fontWeight: 800,
                        color: "#334155",
                      }}
                    >
                      {test}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {prescription?.precautions ? (
              <div style={{ marginTop: 22 }}>
                <SectionLabel icon={ShieldAlert} label="Precautions" />
                <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6, color: "#334155", fontWeight: 600 }}>
                  {prescription.precautions}
                </div>
              </div>
            ) : null}

            {!medicines.length && !testsAdvised.length && !prescription?.precautions && !prescription?.complaint && !prescription?.diagnosis ? (
              <div
                style={{
                  marginTop: 18,
                  borderRadius: 18,
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  padding: 16,
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                }}
              >
                <FileText style={{ width: 18, height: 18, color: "#166534", flexShrink: 0 }} />
                <div style={{ fontSize: 12.5, color: "#475569", fontWeight: 700 }}>
                  Prescription details are still syncing. Please try again in a moment.
                </div>
              </div>
            ) : null}

            <div
              style={{
                marginTop: 22,
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 11,
                fontWeight: 800,
                color: "#4B7A62",
              }}
            >
              <CalendarDays style={{ width: 14, height: 14 }} />
              Shared by your doctor on GoDavaii
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
