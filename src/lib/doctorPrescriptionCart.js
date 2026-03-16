function toId(value) {
  return value ? String(value) : "";
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeProduct(product = {}) {
  const medicineId = toId(product?.medicineId || product?._id || product?.id);
  return {
    _id: medicineId || toId(product?.medicineMasterId || product?.id),
    medicineId,
    pharmacyId: toId(product?.pharmacyId || product?.pharmacy?._id || product?.pharmacy),
    name: String(product?.name || ""),
    brand: String(product?.brand || ""),
    company: String(product?.company || ""),
    composition: String(product?.composition || ""),
    price: toNumber(product?.price),
    mrp: toNumber(product?.mrp),
    img: String(product?.img || ""),
    prescriptionRequired: !!product?.prescriptionRequired,
    productKind: String(product?.productKind || ""),
    quantity: 1,
  };
}

function selectAddableProduct(item = {}, preferredPharmacyId = "") {
  const preferredPharmacy = toId(preferredPharmacyId);
  const brand = normalizeProduct(item?.matchedBrand);
  const generic = normalizeProduct(item?.generic);
  const samePharmacy = (product) =>
    !!product?.medicineId &&
    !!product?.pharmacyId &&
    (!preferredPharmacy || product.pharmacyId === preferredPharmacy);

  const preferredChoice = item?.switchedToGeneric && item?.genericAvailable ? generic : brand;
  const fallbackChoice = item?.switchedToGeneric && item?.genericAvailable ? brand : generic;
  const chosen = [preferredChoice, fallbackChoice].find((product) => samePharmacy(product)) || null;

  return {
    product: chosen
      ? {
          ...chosen,
          name: chosen.name || item?.prescribedMedicine || "Medicine",
        }
      : null,
    source: chosen?.medicineId && chosen.medicineId === generic?.medicineId ? "generic" : "brand",
    brandReady: samePharmacy(brand),
    genericReady: samePharmacy(generic),
  };
}

export function getDoctorPrescriptionCartSummary(doctorPrescription = null) {
  const cartDraft = doctorPrescription?.cartDraft || null;
  const items = Array.isArray(cartDraft?.items) ? cartDraft.items : [];
  const preferredPharmacyId = toId(cartDraft?.preferredPharmacyId);

  const resolvedItems = items.map((item, index) => {
    const choice = selectAddableProduct(item, preferredPharmacyId);
    return {
      id: toId(item?._id) || `rx_item_${index}`,
      prescribedMedicine: String(item?.prescribedMedicine || ""),
      choice,
      row: item,
    };
  });

  const addableProducts = resolvedItems
    .map((entry) => entry.choice?.product)
    .filter((product) => !!product?.medicineId && !!product?.pharmacyId);

  return {
    prescriptionId: toId(doctorPrescription?._id),
    branding: String(doctorPrescription?.branding || "GoDavaii Rx"),
    createdAt: doctorPrescription?.createdAt || doctorPrescription?.sentToPatientAt || null,
    diagnosis: String(doctorPrescription?.diagnosis || ""),
    complaint: String(doctorPrescription?.complaint || ""),
    medicineCount: Array.isArray(doctorPrescription?.medicines)
      ? doctorPrescription.medicines.length
      : items.length,
    preferredPharmacyId,
    resolvedItems,
    addableProducts,
    addableCount: addableProducts.length,
    unavailableCount: Math.max(items.length - addableProducts.length, 0),
  };
}
