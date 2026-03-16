import React from "react";
import { CalendarDays, ClipboardList, FileText, Pill, ShieldAlert, TestTube2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

function formatFollowUpDate(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function buildMedicineInstruction(medicine = {}) {
  return [medicine.dosage, medicine.frequency, medicine.duration].map((value) => String(value || "").trim()).filter(Boolean).join(" • ");
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

export default function DoctorPrescriptionViewDialog({ prescription, open, onOpenChange }) {
  const medicines = Array.isArray(prescription?.medicines) ? prescription.medicines : [];
  const testsAdvised = Array.isArray(prescription?.testsAdvised) ? prescription.testsAdvised.filter(Boolean) : [];
  const followUpDate = formatFollowUpDate(prescription?.followUpDate);

  return (
    <Dialog open={!!open} onOpenChange={onOpenChange}>
      <DialogContent
        style={{
          maxWidth: 560,
          width: "calc(100vw - 24px)",
          borderRadius: 24,
          padding: 0,
          overflow: "hidden",
          background: "linear-gradient(180deg,#F7FFF9 0%,#FFFFFF 38%)",
          border: "1px solid rgba(16,185,129,0.14)",
        }}
      >
        <div style={{ padding: 20 }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Sora',sans-serif", fontSize: 20, color: "#0F172A" }}>
              {prescription?.branding || "Doctor Prescription"}
            </DialogTitle>
          </DialogHeader>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            {prescription?.diagnosis ? (
              <span
                style={{
                  background: "#DCFCE7",
                  color: "#166534",
                  borderRadius: 999,
                  padding: "6px 10px",
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
                  background: "#ECFDF5",
                  color: "#166534",
                  borderRadius: 999,
                  padding: "6px 10px",
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                Follow-up: {followUpDate}
              </span>
            ) : null}
          </div>

          {prescription?.complaint ? (
            <div style={{ marginTop: 18 }}>
              <SectionLabel icon={ClipboardList} label="Complaint" />
              <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.55, color: "#334155", fontWeight: 600 }}>
                {prescription.complaint}
              </div>
            </div>
          ) : null}

          {medicines.length > 0 ? (
            <div style={{ marginTop: 20 }}>
              <SectionLabel icon={Pill} label="Medicines" />
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
                {medicines.map((medicine, index) => {
                  const instruction = buildMedicineInstruction(medicine);
                  return (
                    <div
                      key={`${medicine?.prescribed || "medicine"}-${index}`}
                      style={{
                        border: "1px solid rgba(148,163,184,0.18)",
                        borderRadius: 18,
                        padding: 14,
                        background: "#FFFFFF",
                        boxShadow: "0 6px 18px rgba(15,23,42,0.04)",
                      }}
                    >
                      <div style={{ fontSize: 15, fontWeight: 900, color: "#0F172A", fontFamily: "'Sora',sans-serif" }}>
                        {medicine?.prescribed || `Medicine ${index + 1}`}
                      </div>
                      {medicine?.salt ? (
                        <div style={{ marginTop: 3, fontSize: 12, color: "#64748B", fontWeight: 700 }}>
                          {medicine.salt}
                        </div>
                      ) : null}
                      {instruction ? (
                        <div style={{ marginTop: 8, fontSize: 12, color: "#166534", fontWeight: 800 }}>
                          {instruction}
                        </div>
                      ) : null}
                      {medicine?.howToTake ? (
                        <div style={{ marginTop: 8, fontSize: 12, color: "#334155", fontWeight: 700 }}>
                          How to take: {medicine.howToTake}
                        </div>
                      ) : null}
                      {medicine?.notes ? (
                        <div style={{ marginTop: 6, fontSize: 12, color: "#475569", fontWeight: 600 }}>
                          Notes: {medicine.notes}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {testsAdvised.length > 0 ? (
            <div style={{ marginTop: 20 }}>
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
            <div style={{ marginTop: 20 }}>
              <SectionLabel icon={ShieldAlert} label="Precautions" />
              <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.55, color: "#334155", fontWeight: 600 }}>
                {prescription.precautions}
              </div>
            </div>
          ) : null}

          {!medicines.length && !testsAdvised.length && !prescription?.precautions && !prescription?.complaint ? (
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
              marginTop: 20,
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
      </DialogContent>
    </Dialog>
  );
}
