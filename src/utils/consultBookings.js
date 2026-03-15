const STORAGE_KEY = "gd_consult_bookings_v1";

function parseSlotTo24Hour(slot) {
  const value = String(slot || "").trim();
  const plainMatch = value.match(/^(\d{1,2}):(\d{2})$/);
  if (plainMatch) {
    return String(plainMatch[1]).padStart(2, "0") + ":" + plainMatch[2];
  }
  const meridiemMatch = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!meridiemMatch) return "00:00";
  let hour = Number(meridiemMatch[1]);
  const minute = meridiemMatch[2];
  const meridiem = meridiemMatch[3].toUpperCase();
  if (meridiem === "PM" && hour !== 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  return String(hour).padStart(2, "0") + ":" + minute;
}

export function getConsultDateTimeValue(consult) {
  if (consult?.date) {
    const slot24 = parseSlotTo24Hour(consult.slot);
    const localDate = new Date(`${consult.date}T${slot24}:00`);
    if (!Number.isNaN(localDate.getTime())) return localDate;
  }
  if (consult?.bookedFor) {
    const bookedFor = new Date(consult.bookedFor);
    if (!Number.isNaN(bookedFor.getTime())) return bookedFor;
  }
  return null;
}

export function formatConsultDateTime(consult) {
  const value = getConsultDateTimeValue(consult);
  if (!value) return consult?.dateLabel || consult?.date || "Upcoming consult";
  return value.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function getConsultStatusMeta(consult) {
  const status = String(consult?.status || "pending").toLowerCase();
  if (["accepted", "upcoming", "confirmed"].includes(status)) {
    return {
      label: "Confirmed",
      helper: "Doctor has accepted. Join near the scheduled time.",
      accent: "#065F46",
      bg: "#ECFDF5",
      border: "#A7F3D0",
    };
  }
  if (status === "live_now") {
    return {
      label: "Live now",
      helper: "Your consult window is active.",
      accent: "#1D4ED8",
      bg: "#EFF6FF",
      border: "#BFDBFE",
    };
  }
  if (status === "completed") {
    return {
      label: "Completed",
      helper: "Consult finished successfully.",
      accent: "#475569",
      bg: "#F8FAFC",
      border: "#CBD5E1",
    };
  }
  if (["cancelled", "rejected"].includes(status)) {
    return {
      label: "Closed",
      helper: "This consult is no longer active.",
      accent: "#991B1B",
      bg: "#FEF2F2",
      border: "#FECACA",
    };
  }
  return {
    label: "Awaiting doctor",
    helper: "Payment is done. Waiting for doctor acceptance.",
    accent: "#92400E",
    bg: "#FFFBEB",
    border: "#FCD34D",
  };
}

function normalizeConsultBooking(consult) {
  const dateTime = getConsultDateTimeValue(consult);
  const id = String(consult?.id || consult?._id || consult?.bookingId || "");
  const slot = consult?.slot || (dateTime ? dateTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : "");
  const mode = consult?.mode === "call" ? "audio" : consult?.mode || "video";
  return {
    ...consult,
    id,
    bookingId: String(consult?.bookingId || id),
    mode,
    slot,
    bookedFor: consult?.bookedFor || (dateTime ? dateTime.toISOString() : ""),
    dateLabel: consult?.dateLabel || (dateTime ? dateTime.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : consult?.date || ""),
    paymentStatus: consult?.paymentStatus || "paid",
    status: consult?.status || "pending",
    createdAt: consult?.createdAt || new Date().toISOString(),
  };
}

export function readStoredConsultBookings() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw.map(normalizeConsultBooking).filter((consult) => consult.id);
  } catch {
    return [];
  }
}

export function writeStoredConsultBookings(bookings) {
  const normalized = bookings.map(normalizeConsultBooking).filter((consult) => consult.id).slice(0, 20);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function upsertStoredConsultBooking(consult) {
  const normalized = normalizeConsultBooking(consult);
  const current = readStoredConsultBookings().filter((item) => item.id !== normalized.id);
  return writeStoredConsultBookings([normalized, ...current]);
}

export function mergeConsultBookings(primary = [], fallback = []) {
  const map = new Map();
  fallback.map(normalizeConsultBooking).forEach((consult) => {
    if (consult.id) map.set(consult.id, consult);
  });
  primary.map(normalizeConsultBooking).forEach((consult) => {
    if (consult.id) map.set(consult.id, { ...map.get(consult.id), ...consult });
  });
  return Array.from(map.values());
}

export function sortConsultBookings(bookings = []) {
  return [...bookings].sort((left, right) => {
    const leftDate = getConsultDateTimeValue(left);
    const rightDate = getConsultDateTimeValue(right);
    if (!leftDate && !rightDate) return 0;
    if (!leftDate) return 1;
    if (!rightDate) return -1;
    return leftDate.getTime() - rightDate.getTime();
  });
}