// src/lib/composition.js
export function buildCompositionKey(raw = "") {
  const s = String(raw || "")
    .toLowerCase()
    // keep letters/numbers/+/%/./ and spaces (drop other punctuation)
    .replace(/[^a-z0-9+.%/ ]+/g, " ")
    .replace(/\b(ip|bp|usp|sr|er|mr|od)\b/g, " ") // drop pharmacopoeia/release markers
    .replace(/\s+/g, " ")
    .trim();

  if (!s) return "";

  // Split combos by +, normalize each part, sort for order-independence
  const parts = s
    .split("+")
    .map((p) =>
      p
        .trim()
        .replace(/\s*mg\b/g, "mg")
        .replace(/\s*ml\b/g, "ml")
        .replace(/\s*g\b/g, "g")
        .replace(/\s*mcg\b/g, "mcg")
        .replace(/\s+/, " ")
        .trim()
    )
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  return parts.join(" + ");
}
