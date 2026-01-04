// src/components/admin/MedicineMasterAdmin.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Stack,
  TextField,
  Typography,
  FormControlLabel,
  Checkbox,
  MenuItem,
  Select,
  InputLabel,
  FormControl,

  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";

import BrandAutocomplete from "./fields/BrandAutocomplete";
import CompositionAutocomplete from "./fields/CompositionAutocomplete";

import { TYPE_OPTIONS, PACK_SIZES_BY_TYPE } from "../constants/packSizes";
import { CUSTOMER_CATEGORIES } from "../constants/customerCategories";

// ✅ Normalize base so /api never duplicates
const RAW_BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const BASE = String(RAW_BASE).replace(/\/+$/, "").replace(/\/api\/?$/i, "");
const API = (path) => `${BASE}${path.startsWith("/") ? path : `/${path}`}`;

// ---- helpers ----
const splitComps = (s = "") =>
  String(s)
    .split("+")
    .map((x) => x.trim())
    .filter(Boolean);

const joinComps = (arr = []) =>
  arr
    .map((s) => String(s).trim())
    .filter(Boolean)
    .join(" + ");

const keepUnlessExplicitClear = (prev, next) =>
  next === null ? "" : typeof next === "string" && next.trim() === "" ? prev : next;

// ✅ NEW: parse money/number that may include commas (1,701.56) or spaces
const parseMoney = (val) => {
  if (val === null || val === undefined) return 0;
  const s = String(val).trim();
  if (!s) return 0;

  // remove commas + spaces. Keep digits, dot and minus only.
  const cleaned = s.replace(/,/g, "").replace(/[^\d.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
};

// ✅ pack helpers
const packLabel = (count, unit) => {
  const c = String(count || "").trim();
  const u = String(unit || "").trim().toLowerCase();
  if (!c && !u) return "";
  return u ? `${c} ${u}` : c;
};

const normalizePackOpt = (raw) => {
  if (!raw) return { count: "", unit: "", label: "" };
  if (typeof raw === "string") {
    const m = raw.trim().match(/^(\d+)(?:\s*([A-Za-z]+)s?)?$/);
    if (!m) return { count: "", unit: "", label: raw };
    const [, count, unit = ""] = m;
    const u = unit.toLowerCase();
    return { count, unit: u, label: u ? `${count} ${u}` : `${count}` };
  }
  const count = String(raw.count ?? "").trim();
  const unit = String(raw.unit ?? "").trim().toLowerCase();
  const label = raw.label || (count && unit ? `${count} ${unit}` : "");
  return { count, unit, label: String(label || "") };
};

// ✅ Robust token reader
const readToken = () => {
  const candidates = [
    localStorage.getItem("adminToken"),
    localStorage.getItem("token"),
    localStorage.getItem("accessToken"),
    localStorage.getItem("authToken"),
    sessionStorage.getItem("adminToken"),
    sessionStorage.getItem("token"),
    sessionStorage.getItem("accessToken"),
    sessionStorage.getItem("authToken"),
  ].filter(Boolean);

  for (let t of candidates) {
    t = String(t).trim();

    if (
      (t.startsWith("{") && t.endsWith("}")) ||
      (t.startsWith("[") && t.endsWith("]"))
    ) {
      try {
        const obj = JSON.parse(t);
        const maybe =
          obj?.token ||
          obj?.accessToken ||
          obj?.authToken ||
          obj?.adminToken ||
          obj?.data?.token;
        if (maybe) t = String(maybe).trim();
      } catch (_) {}
    }

    if (t.toLowerCase().startsWith("bearer ")) t = t.slice(7).trim();

    if (
      (t.startsWith('"') && t.endsWith('"')) ||
      (t.startsWith("'") && t.endsWith("'"))
    ) {
      t = t.slice(1, -1).trim();
    }

    if (t.split(".").length === 3) return t;
  }
  return "";
};

export default function MedicineMasterAdmin() {
  const fileRef = useRef(null);
  const editFileRef = useRef(null);

  const [tab, setTab] = useState("approved");
  const [q, setQ] = useState("");
  const [list, setList] = useState([]);
  const [msg, setMsg] = useState("");

  // ✅ View dialog (for BOTH approved + pending)
  const [viewOpen, setViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState(null);
  const openView = (item) => {
    setViewItem(item);
    setViewOpen(true);
  };
  const closeView = () => {
    setViewOpen(false);
    setViewItem(null);
  };

  // ✅ Delete confirm dialog
  const [delOpen, setDelOpen] = useState(false);
  const [delItem, setDelItem] = useState(null);
  const openDelete = (item) => {
    setDelItem(item);
    setDelOpen(true);
  };
  const closeDelete = () => {
    setDelOpen(false);
    setDelItem(null);
  };

  // ✅ Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({
    productKind: "branded",
    name: "",
    brand: "",
    composition: "",
    compositions: [],

    company: "",
    price: "",
    mrp: "",
    discount: "",

    category: [],
    customCategory: "",
    type: "Tablet",
    customType: "",
    packCount: "",
    packUnit: "",

    prescriptionRequired: false,
    hsn: "3004",
    gstRate: 5,
  });

  const [editExistingImages, setEditExistingImages] = useState([]); // urls
  const [editNewImages, setEditNewImages] = useState([]); // File[]

  const openEdit = (item) => {
    const cat = Array.isArray(item?.category) ? item.category : [];
    const hasOther = cat.includes("Other");
    const compStr = String(item?.composition || "").trim();

    setEditId(item?._id || null);
    setEditForm({
      productKind: item?.productKind || "branded",
      name: item?.name || "",
      brand: item?.brand || "",
      composition: compStr,
      compositions: splitComps(compStr),

      company: item?.company || "",
      price: item?.price ?? "",
      mrp: item?.mrp ?? "",
      discount: item?.discount ?? "",

      category: cat,
      customCategory: hasOther ? "" : "", // keep as-is (other custom stored as category text)
      type: item?.type || "Tablet",
      customType: item?.customType || "",
      packCount: item?.packCount ?? "",
      packUnit: item?.packUnit || "",

      prescriptionRequired: !!item?.prescriptionRequired,
      hsn: item?.hsn || "3004",
      gstRate: item?.gstRate ?? 5,
    });

    setEditExistingImages(Array.isArray(item?.images) ? item.images : []);
    setEditNewImages([]);
    if (editFileRef.current) editFileRef.current.value = "";
    setEditOpen(true);
  };

  const closeEdit = () => {
    setEditOpen(false);
    setEditId(null);
    setEditNewImages([]);
    setEditExistingImages([]);
  };

  const [form, setForm] = useState({
    productKind: "branded",
    name: "",
    brand: "",
    composition: "",
    compositions: [],

    company: "",
    price: "",
    mrp: "",
    discount: "",

    category: [],
    customCategory: "",
    type: "Tablet",
    customType: "",
    packCount: "",
    packUnit: "",

    prescriptionRequired: false,
    hsn: "3004",
    gstRate: 5,
  });

  const [images, setImages] = useState([]);

  // ✅ Always use CLEAN token
  const token = useMemo(() => readToken(), []);
  const headers = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  const handle401 = () => {
    setMsg("Invalid or expired token. Please login again.");
    localStorage.removeItem("adminToken");
    localStorage.removeItem("token");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("authToken");
    sessionStorage.removeItem("adminToken");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("accessToken");
    sessionStorage.removeItem("authToken");
  };

  // ✅ Discount auto-calc (Add form) — NOW comma-safe
  useEffect(() => {
    const mrp = parseMoney(form.mrp);
    const price = parseMoney(form.price);

    if (mrp > 0 && price >= 0 && price <= mrp) {
      const disc = Math.round((((mrp - price) / mrp) * 100) * 100) / 100;
      setForm((f) =>
        String(f.discount) === String(disc) ? f : { ...f, discount: String(disc) }
      );
    } else {
      if (form.discount !== "") setForm((f) => ({ ...f, discount: "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.mrp, form.price]);

  // ✅ Discount auto-calc (Edit form) — NOW comma-safe
  useEffect(() => {
    if (!editOpen) return;

    const mrp = parseMoney(editForm.mrp);
    const price = parseMoney(editForm.price);

    if (mrp > 0 && price >= 0 && price <= mrp) {
      const disc = Math.round((((mrp - price) / mrp) * 100) * 100) / 100;
      setEditForm((f) =>
        String(f.discount) === String(disc) ? f : { ...f, discount: String(disc) }
      );
    } else {
      if (editForm.discount !== "") setEditForm((f) => ({ ...f, discount: "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editForm.mrp, editForm.price, editOpen]);

  const fetchList = async () => {
    try {
      const status = tab === "pending" ? "pending" : "approved";

      const res = await axios.get(
        API(`/api/medicine-master/admin/all?q=${encodeURIComponent(q)}&status=${status}`),
        { headers }
      );

      setList(res.data || []);
      setMsg("");
    } catch (e) {
      const status = e?.response?.status;

      if (status === 401) {
        handle401();
        setList([]);
        return;
      }

      setList([]);
      setMsg(
        e?.response?.data?.error ||
          e?.response?.data?.message ||
          (status ? `❌ Failed to load medicines. (HTTP ${status})` : "❌ Failed to load medicines.")
      );
      console.error("MedicineMasterAdmin fetchList error:", e);
    }
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // ✅ Upload with fetch
  const uploadMany = async (files) => {
    const urls = [];

    for (const f of files) {
      const fd = new FormData();
      fd.append("file", f);

      const resp = await fetch(API("/api/upload"), {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: fd,
      });

      const data = await resp.json().catch(() => ({}));

      if (resp.status === 401) {
        handle401();
        throw new Error("Invalid or expired token. Please login again.");
      }

      if (!resp.ok) {
        throw new Error(data?.message || data?.error || `Upload failed (HTTP ${resp.status})`);
      }

      if (data?.url) urls.push(data.url);
    }

    return urls;
  };

  const computedCategory = () => {
    const cats = Array.isArray(form.category) ? form.category : [];
    if (cats.includes("Other")) {
      const custom = (form.customCategory || "").trim();
      return [...cats.filter((c) => c !== "Other"), ...(custom ? [custom] : []), "Other"];
    }
    return cats;
  };

  const computedType = () => {
    if (form.type === "Other") return (form.customType || "").trim() || "Other";
    return form.type || "Tablet";
  };

  const computedEditCategory = () => {
    const cats = Array.isArray(editForm.category) ? editForm.category : [];
    if (cats.includes("Other")) {
      const custom = (editForm.customCategory || "").trim();
      return [...cats.filter((c) => c !== "Other"), ...(custom ? [custom] : []), "Other"];
    }
    return cats;
  };

  const computedEditType = () => {
    if (editForm.type === "Other") return (editForm.customType || "").trim() || "Other";
    return editForm.type || "Tablet";
  };

  const getDefaultPackForType = (typeVal) => {
    const opts = PACK_SIZES_BY_TYPE?.[typeVal] || [];
    const o = normalizePackOpt(opts?.[0]);
    return { count: o.count || "", unit: o.unit || "" };
  };

  const addMaster = async () => {
    try {
      if (!token) {
        handle401();
        return;
      }

      setMsg("Uploading...");
      const imgUrls = images.length ? await uploadMany(images) : [];

      const compositionValue = form.compositions?.length
        ? joinComps(form.compositions)
        : form.composition || "";

      const payload = {
        productKind: form.productKind,
        name: (form.name || form.brand || compositionValue || "").trim(),
        brand: form.productKind === "generic" ? "" : (form.brand || "").trim(),
        composition: (compositionValue || "").trim(),
        company: (form.company || "").trim(),

        // ✅ comma-safe
        price: parseMoney(form.price),
        mrp: parseMoney(form.mrp),
        discount: parseMoney(form.discount),

        category: computedCategory(),
        type: computedType(),
        customType: form.type === "Other" ? form.customType || "" : "",

        prescriptionRequired: !!form.prescriptionRequired,
        hsn: String(form.hsn || "3004").replace(/[^\d]/g, "") || "3004",
        gstRate: Number(form.gstRate || 0),

        packCount: parseMoney(form.packCount),
        packUnit: (form.packUnit || "").trim(),

        images: imgUrls,
      };

      await axios.post(API("/api/medicine-master/admin"), payload, { headers });

      setMsg("✅ Master medicine added!");
      setForm({
        productKind: "branded",
        name: "",
        brand: "",
        composition: "",
        compositions: [],
        company: "",
        price: "",
        mrp: "",
        discount: "",
        category: [],
        customCategory: "",
        type: "Tablet",
        customType: "",
        packCount: "",
        packUnit: "",
        prescriptionRequired: false,
        hsn: "3004",
        gstRate: 5,
      });
      setImages([]);
      if (fileRef.current) fileRef.current.value = "";
      fetchList();
    } catch (e) {
      const status = e?.response?.status;

      if (status === 401) {
        handle401();
        return;
      }

      const serverMsg = e?.response?.data?.error || e?.response?.data?.message;
      setMsg(
        serverMsg ||
          e?.message ||
          (status ? `❌ Failed to add master medicine. (HTTP ${status})` : "❌ Failed to add master medicine.")
      );
      console.error("MedicineMasterAdmin addMaster error:", e);
    }
  };

  const saveEdit = async () => {
    try {
      if (!token) {
        handle401();
        return;
      }
      if (!editId) return;

      setMsg("Updating...");

      const newUrls = editNewImages.length ? await uploadMany(editNewImages) : [];
      const finalImages = [...(editExistingImages || []), ...newUrls];

      const compositionValue = editForm.compositions?.length
        ? joinComps(editForm.compositions)
        : editForm.composition || "";

      const payload = {
        productKind: editForm.productKind,
        name: (editForm.name || editForm.brand || compositionValue || "").trim(),
        brand: editForm.productKind === "generic" ? "" : (editForm.brand || "").trim(),
        composition: (compositionValue || "").trim(),
        company: (editForm.company || "").trim(),

        // ✅ comma-safe
        price: parseMoney(editForm.price),
        mrp: parseMoney(editForm.mrp),
        discount: parseMoney(editForm.discount),

        category: computedEditCategory(),
        type: computedEditType(),
        customType: editForm.type === "Other" ? editForm.customType || "" : "",

        prescriptionRequired: !!editForm.prescriptionRequired,
        hsn: String(editForm.hsn || "3004").replace(/[^\d]/g, "") || "3004",
        gstRate: Number(editForm.gstRate || 0),

        packCount: parseMoney(editForm.packCount),
        packUnit: (editForm.packUnit || "").trim(),

        images: finalImages,
      };

      await axios.patch(API(`/api/medicine-master/admin/${editId}`), payload, { headers });

      setMsg("✅ Updated!");
      closeEdit();
      fetchList();
    } catch (e) {
      const status = e?.response?.status;

      if (status === 401) {
        handle401();
        return;
      }

      const serverMsg = e?.response?.data?.error || e?.response?.data?.message;
      setMsg(
        serverMsg ||
          e?.message ||
          (status ? `❌ Update failed. (HTTP ${status})` : "❌ Update failed.")
      );
      console.error("MedicineMasterAdmin saveEdit error:", e);
    }
  };

  const doDelete = async () => {
    try {
      if (!token) {
        handle401();
        return;
      }
      if (!delItem?._id) return;

      setMsg("Deleting...");
      await axios.delete(API(`/api/medicine-master/admin/${delItem._id}`), { headers });
      setMsg("✅ Deleted!");
      closeDelete();
      fetchList();
    } catch (e) {
      const status = e?.response?.status;

      if (status === 401) {
        handle401();
        return;
      }

      const serverMsg = e?.response?.data?.error || e?.response?.data?.message;
      setMsg(
        serverMsg ||
          e?.message ||
          (status ? `❌ Delete failed. (HTTP ${status})` : "❌ Delete failed.")
      );
      console.error("MedicineMasterAdmin doDelete error:", e);
    }
  };

  const approve = async (id) => {
    try {
      await axios.patch(API(`/api/medicine-master/${id}/approve`), {}, { headers });
      fetchList();
    } catch (e) {
      const status = e?.response?.status;

      if (status === 401) {
        handle401();
        return;
      }

      setMsg(
        e?.response?.data?.error ||
          e?.response?.data?.message ||
          (status ? `❌ Approve failed. (HTTP ${status})` : "❌ Approve failed.")
      );
    }
  };

  const reject = async (id) => {
    try {
      await axios.patch(API(`/api/medicine-master/${id}/reject`), {}, { headers });
      fetchList();
    } catch (e) {
      const status = e?.response?.status;

      if (status === 401) {
        handle401();
        return;
      }

      setMsg(
        e?.response?.data?.error ||
          e?.response?.data?.message ||
          (status ? `❌ Reject failed. (HTTP ${status})` : "❌ Reject failed.")
      );
    }
  };

  const packOptions = PACK_SIZES_BY_TYPE?.[form.type] || [];
  const editPackOptions = PACK_SIZES_BY_TYPE?.[editForm.type] || [];

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={800}>
          Medicine Master
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant={tab === "approved" ? "contained" : "outlined"}
            onClick={() => setTab("approved")}
          >
            Approved
          </Button>
          <Button
            variant={tab === "pending" ? "contained" : "outlined"}
            onClick={() => setTab("pending")}
          >
            Pending
          </Button>
        </Stack>
      </Stack>

      <Card sx={{ mb: 2, bgcolor: "#16181a" }}>
        <CardContent>
          <Typography fontWeight={800} sx={{ mb: 1 }}>
            {tab === "approved" ? "Add Master Medicine (Admin)" : "Pending Requests (Approve/Reject)"}
          </Typography>

          {tab === "approved" && (
            <>
              <Box
                sx={{
                  mt: 1,
                  pb: 2,
                  bgcolor: "#212325",
                  border: "1px solid #1d8f72",
                  borderRadius: 2,
                  p: 2,
                }}
              >
                <Stack spacing={2}>
                  <FormControl fullWidth>
                    <InputLabel>Brand Type</InputLabel>
                    <Select
                      label="Brand Type"
                      value={form.productKind}
                      onChange={(e) => {
                        const v = e.target.value;
                        setForm((f) => ({
                          ...f,
                          productKind: v,
                          brand: v === "generic" ? "" : f.brand,
                          name: v === "generic" ? f.name || f.composition || "" : f.name || f.brand || "",
                        }));
                      }}
                    >
                      <MenuItem value="branded">Branded</MenuItem>
                      <MenuItem value="generic">Generic</MenuItem>
                    </Select>
                  </FormControl>

                  {form.productKind === "branded" && (
                    <BrandAutocomplete
                      value={form.brand}
                      onValueChange={(val) =>
                        setForm((f) => {
                          const nextBrand = keepUnlessExplicitClear(f.brand, val);
                          return { ...f, brand: nextBrand, name: f.name || nextBrand };
                        })
                      }
                      onPrefill={(p) =>
                        setForm((f) => ({
                          ...f,
                          productKind: "branded",
                          name: f.name || p.name || f.brand,
                          type: p.type ?? f.type,
                          packCount: (p.packCount ?? f.packCount) + "",
                          packUnit: p.packUnit ?? f.packUnit,
                          hsn: p.hsn ?? f.hsn,
                          gstRate: p.gstRate ?? f.gstRate,
                        }))
                      }
                    />
                  )}

                  <TextField
                    fullWidth
                    label="Medicine Name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />

                  <CompositionAutocomplete
                    value={form.composition}
                    onValueChange={(val) =>
                      setForm((f) => ({
                        ...f,
                        composition: keepUnlessExplicitClear(f.composition, val),
                        compositions: splitComps(val || f.composition || ""),
                      }))
                    }
                    onAddComposition={(c) =>
                      setForm((f) => {
                        const next = Array.from(new Set([...(f.compositions || []), c])).filter(Boolean);
                        return { ...f, compositions: next, composition: joinComps(next) };
                      })
                    }
                    compositions={form.compositions || []}
                    onRemoveComposition={(c) =>
                      setForm((f) => {
                        const next = (f.compositions || []).filter((x) => x !== c);
                        return { ...f, compositions: next, composition: joinComps(next) };
                      })
                    }
                  />

                  <TextField
                    fullWidth
                    label="Company / Manufacturer"
                    value={form.company}
                    onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                  />

                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        label="Selling Price"
                        value={form.price}
                        onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        label="MRP"
                        value={form.mrp}
                        onChange={(e) => setForm((f) => ({ ...f, mrp: e.target.value }))}
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextField fullWidth label="Discount (%)" value={form.discount} disabled />
                    </Grid>
                  </Grid>

                  <FormControl fullWidth>
                    <InputLabel>Category</InputLabel>
                    <Select
                      multiple
                      label="Category"
                      value={form.category}
                      onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                      renderValue={(selected) => (selected || []).join(", ")}
                    >
                      {CUSTOMER_CATEGORIES.map((c) => (
                        <MenuItem key={c} value={c}>
                          <Checkbox checked={form.category.indexOf(c) > -1} />
                          <Typography>{c}</Typography>
                        </MenuItem>
                      ))}
                      <MenuItem value="Other">
                        <Checkbox checked={form.category.indexOf("Other") > -1} />
                        <Typography>Other</Typography>
                      </MenuItem>
                    </Select>
                  </FormControl>

                  {form.category.includes("Other") && (
                    <TextField
                      fullWidth
                      label="Custom Category"
                      value={form.customCategory}
                      onChange={(e) => setForm((f) => ({ ...f, customCategory: e.target.value }))}
                    />
                  )}

                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth>
                        <InputLabel>Type</InputLabel>
                        <Select
                          label="Type"
                          value={form.type}
                          onChange={(e) => {
                            const nextType = e.target.value;
                            const def = getDefaultPackForType(nextType);
                            setForm((f) => ({
                              ...f,
                              type: nextType,
                              packCount: def.count,
                              packUnit: def.unit,
                            }));
                          }}
                        >
                          {TYPE_OPTIONS.map((t) => (
                            <MenuItem key={t} value={t}>
                              {t}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth>
                        <InputLabel>Pack Size</InputLabel>
                        <Select
                          label="Pack Size"
                          value={packLabel(form.packCount, form.packUnit) || ""}
                          onChange={(e) => {
                            const opt = normalizePackOpt(e.target.value);
                            setForm((f) => ({ ...f, packCount: opt.count, packUnit: opt.unit }));
                          }}
                        >
                          <MenuItem value="">Select</MenuItem>
                          {(packOptions || []).map((raw) => {
                            const o = normalizePackOpt(raw);
                            return (
                              <MenuItem key={o.label || JSON.stringify(raw)} value={o.label}>
                                {o.label}
                              </MenuItem>
                            );
                          })}
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>

                  {form.type === "Other" && (
                    <TextField
                      fullWidth
                      label="Custom Type"
                      value={form.customType}
                      onChange={(e) => setForm((f) => ({ ...f, customType: e.target.value }))}
                    />
                  )}

                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Pack Count"
                        value={form.packCount}
                        onChange={(e) => setForm((f) => ({ ...f, packCount: e.target.value }))}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Pack Unit (optional)"
                        value={form.packUnit}
                        onChange={(e) => setForm((f) => ({ ...f, packUnit: e.target.value }))}
                      />
                    </Grid>
                  </Grid>

                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={4}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={form.prescriptionRequired}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, prescriptionRequired: e.target.checked }))
                            }
                          />
                        }
                        label="Prescription Required"
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        label="HSN Code"
                        value={form.hsn}
                        onChange={(e) => setForm((f) => ({ ...f, hsn: e.target.value }))}
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <FormControl fullWidth>
                        <InputLabel>GST Rate</InputLabel>
                        <Select
                          label="GST Rate"
                          value={form.gstRate}
                          onChange={(e) => setForm((f) => ({ ...f, gstRate: e.target.value }))}
                        >
                          {[0, 5, 12, 18].map((g) => (
                            <MenuItem key={g} value={g}>
                              {g}%
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>

                  <Stack direction="row" spacing={1} alignItems="center">
                    <Button variant="outlined" component="label">
                      Upload Images
                      <input
                        hidden
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => setImages(Array.from(e.target.files || []))}
                      />
                    </Button>
                    <Typography variant="body2" color="text.secondary">
                      {images.length ? `${images.length} selected` : "No images"}
                    </Typography>
                  </Stack>

                  <Stack direction="row" spacing={1}>
                    <Button variant="contained" onClick={addMaster}>
                      Add to Master
                    </Button>
                    <Button variant="outlined" onClick={fetchList}>
                      Refresh
                    </Button>
                    <Typography sx={{ ml: 1, alignSelf: "center" }}>{msg}</Typography>
                  </Stack>
                </Stack>
              </Box>

              <Divider sx={{ my: 2 }} />
            </>
          )}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 2 }}>
            <TextField fullWidth label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
            <Button variant="outlined" onClick={fetchList}>
              Search
            </Button>
          </Stack>

          <Stack spacing={1}>
            {list.map((m) => (
              <Card key={m._id} sx={{ bgcolor: "#212325" }}>
                <CardContent>
                  <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography fontWeight={800}>{m.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        ₹{m.price} / MRP ₹{m.mrp}
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
                        <Chip size="small" label={m.productKind} />
                        {m.prescriptionRequired ? (
                          <Chip size="small" color="warning" label="Rx Required" />
                        ) : null}
                        {Array.isArray(m.category)
                          ? m.category.slice(0, 4).map((c) => <Chip key={c} size="small" label={c} />)
                          : null}
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        Status: {m.status} • By: {m.createdByType}
                      </Typography>
                    </Box>

                    {/* ✅ ACTIONS */}
                    {tab === "pending" ? (
                      <Stack direction="row" spacing={1}>
                        <Button variant="outlined" onClick={() => openView(m)}>
                          View
                        </Button>
                        <Button variant="contained" onClick={() => approve(m._id)}>
                          Approve
                        </Button>
                        <Button variant="outlined" color="error" onClick={() => reject(m._id)}>
                          Reject
                        </Button>
                      </Stack>
                    ) : (
                      <Stack direction="row" spacing={1}>
                        <Button variant="outlined" onClick={() => openView(m)}>
                          View
                        </Button>
                        <Button variant="contained" onClick={() => openEdit(m)}>
                          Edit
                        </Button>
                        <Button variant="outlined" color="error" onClick={() => openDelete(m)}>
                          Delete
                        </Button>
                      </Stack>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            ))}

            {list.length === 0 && <Typography color="text.secondary">No records.</Typography>}
          </Stack>

          {msg ? <Typography sx={{ mt: 2 }}>{msg}</Typography> : null}
        </CardContent>
      </Card>

      {/* ✅ VIEW DIALOG */}
      <Dialog open={viewOpen} onClose={closeView} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Medicine Details</DialogTitle>

        <DialogContent dividers sx={{ bgcolor: "#111", color: "#fff" }}>
          {!viewItem ? (
            <Typography sx={{ color: "#aaa" }}>No data</Typography>
          ) : (
            <Stack spacing={2}>
              <Box>
                <Typography fontWeight={800} fontSize={18}>
                  {viewItem.name || "—"}
                </Typography>
                <Typography sx={{ color: "#aaa" }}>
                  {viewItem.productKind || "—"} • {viewItem.type || "—"}
                </Typography>
              </Box>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <Box
                  sx={{
                    flex: 1,
                    bgcolor: "#16181a",
                    p: 2,
                    borderRadius: 2,
                    border: "1px solid #2b2f33",
                  }}
                >
                  <Typography fontWeight={800} sx={{ mb: 1 }}>
                    Basic Info
                  </Typography>
                  <Typography sx={{ color: "#ccc" }}>Brand: {viewItem.brand || "—"}</Typography>
                  <Typography sx={{ color: "#ccc" }}>
                    Composition: {viewItem.composition || "—"}
                  </Typography>
                  <Typography sx={{ color: "#ccc" }}>Company: {viewItem.company || "—"}</Typography>
                  <Typography sx={{ color: "#ccc" }}>
                    Category: {(viewItem.category || []).join(", ") || "—"}
                  </Typography>
                  <Typography sx={{ color: "#ccc" }}>
                    Prescription Required: {viewItem.prescriptionRequired ? "Yes" : "No"}
                  </Typography>
                </Box>

                <Box
                  sx={{
                    flex: 1,
                    bgcolor: "#16181a",
                    p: 2,
                    borderRadius: 2,
                    border: "1px solid #2b2f33",
                  }}
                >
                  <Typography fontWeight={800} sx={{ mb: 1 }}>
                    Pack / Tax
                  </Typography>
                  <Typography sx={{ color: "#ccc" }}>
                    Pack: {viewItem.packCount || "—"} {viewItem.packUnit || ""}
                  </Typography>
                  <Typography sx={{ color: "#ccc" }}>HSN: {viewItem.hsn || "—"}</Typography>
                  <Typography sx={{ color: "#ccc" }}>
                    GST: {viewItem.gstRate ?? "—"}%
                  </Typography>
                </Box>
              </Stack>

              <Box
                sx={{
                  bgcolor: "#16181a",
                  p: 2,
                  borderRadius: 2,
                  border: "1px solid #2b2f33",
                }}
              >
                <Typography fontWeight={800} sx={{ mb: 1 }}>
                  Pricing
                </Typography>
                <Typography sx={{ color: "#ccc" }}>Selling Price: ₹{viewItem.price ?? "—"}</Typography>
                <Typography sx={{ color: "#ccc" }}>MRP: ₹{viewItem.mrp ?? "—"}</Typography>
                <Typography sx={{ color: "#ccc" }}>Discount: {viewItem.discount ?? "—"}%</Typography>
              </Box>

              <Box
                sx={{
                  bgcolor: "#16181a",
                  p: 2,
                  borderRadius: 2,
                  border: "1px solid #2b2f33",
                }}
              >
                <Typography fontWeight={800} sx={{ mb: 1 }}>
                  Images
                </Typography>

                {Array.isArray(viewItem.images) && viewItem.images.length > 0 ? (
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" },
                      gap: 1.5,
                    }}
                  >
                    {viewItem.images.map((url, idx) => (
                      <Box
                        key={idx}
                        component="img"
                        src={url}
                        alt={`medicine-${idx}`}
                        sx={{
                          width: "100%",
                          height: 160,
                          objectFit: "cover",
                          borderRadius: 2,
                          border: "1px solid #2b2f33",
                          bgcolor: "#0c0c0c",
                        }}
                      />
                    ))}
                  </Box>
                ) : (
                  <Typography sx={{ color: "#aaa" }}>No images uploaded</Typography>
                )}
              </Box>
            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ bgcolor: "#0f0f0f" }}>
          <Button onClick={closeView} variant="outlined">
            Close
          </Button>

          {/* Pending quick actions (unchanged behavior) */}
          {tab === "pending" && viewItem?._id && (
            <>
              <Button
                onClick={() => {
                  closeView();
                  reject(viewItem._id);
                }}
                color="error"
                variant="outlined"
              >
                Reject
              </Button>
              <Button
                onClick={() => {
                  closeView();
                  approve(viewItem._id);
                }}
                variant="contained"
              >
                Approve
              </Button>
            </>
          )}

          {/* Approved quick actions */}
          {tab === "approved" && viewItem?._id && (
            <>
              <Button
                onClick={() => {
                  closeView();
                  openEdit(viewItem);
                }}
                variant="contained"
              >
                Edit
              </Button>
              <Button
                onClick={() => {
                  closeView();
                  openDelete(viewItem);
                }}
                color="error"
                variant="outlined"
              >
                Delete
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* ✅ EDIT DIALOG */}
      <Dialog open={editOpen} onClose={closeEdit} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Edit Medicine</DialogTitle>

        <DialogContent dividers sx={{ bgcolor: "#111", color: "#fff" }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Brand Type</InputLabel>
              <Select
                label="Brand Type"
                value={editForm.productKind}
                onChange={(e) => {
                  const v = e.target.value;
                  setEditForm((f) => ({
                    ...f,
                    productKind: v,
                    brand: v === "generic" ? "" : f.brand,
                    name: v === "generic" ? f.name || f.composition || "" : f.name || f.brand || "",
                  }));
                }}
              >
                <MenuItem value="branded">Branded</MenuItem>
                <MenuItem value="generic">Generic</MenuItem>
              </Select>
            </FormControl>

            {editForm.productKind === "branded" && (
              <BrandAutocomplete
                value={editForm.brand}
                onValueChange={(val) =>
                  setEditForm((f) => {
                    const nextBrand = keepUnlessExplicitClear(f.brand, val);
                    return { ...f, brand: nextBrand, name: f.name || nextBrand };
                  })
                }
                onPrefill={(p) =>
                  setEditForm((f) => ({
                    ...f,
                    productKind: "branded",
                    name: f.name || p.name || f.brand,
                    type: p.type ?? f.type,
                    packCount: (p.packCount ?? f.packCount) + "",
                    packUnit: p.packUnit ?? f.packUnit,
                    hsn: p.hsn ?? f.hsn,
                    gstRate: p.gstRate ?? f.gstRate,
                  }))
                }
              />
            )}

            <TextField
              fullWidth
              label="Medicine Name"
              value={editForm.name}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
            />

            <CompositionAutocomplete
              value={editForm.composition}
              onValueChange={(val) =>
                setEditForm((f) => ({
                  ...f,
                  composition: keepUnlessExplicitClear(f.composition, val),
                  compositions: splitComps(val || f.composition || ""),
                }))
              }
              onAddComposition={(c) =>
                setEditForm((f) => {
                  const next = Array.from(new Set([...(f.compositions || []), c])).filter(Boolean);
                  return { ...f, compositions: next, composition: joinComps(next) };
                })
              }
              compositions={editForm.compositions || []}
              onRemoveComposition={(c) =>
                setEditForm((f) => {
                  const next = (f.compositions || []).filter((x) => x !== c);
                  return { ...f, compositions: next, composition: joinComps(next) };
                })
              }
            />

            <TextField
              fullWidth
              label="Company / Manufacturer"
              value={editForm.company}
              onChange={(e) => setEditForm((f) => ({ ...f, company: e.target.value }))}
            />

            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Selling Price"
                  value={editForm.price}
                  onChange={(e) => setEditForm((f) => ({ ...f, price: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="MRP"
                  value={editForm.mrp}
                  onChange={(e) => setEditForm((f) => ({ ...f, mrp: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth label="Discount (%)" value={editForm.discount} disabled />
              </Grid>
            </Grid>

            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                multiple
                label="Category"
                value={editForm.category}
                onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                renderValue={(selected) => (selected || []).join(", ")}
              >
                {CUSTOMER_CATEGORIES.map((c) => (
                  <MenuItem key={c} value={c}>
                    <Checkbox checked={editForm.category.indexOf(c) > -1} />
                    <Typography>{c}</Typography>
                  </MenuItem>
                ))}
                <MenuItem value="Other">
                  <Checkbox checked={editForm.category.indexOf("Other") > -1} />
                  <Typography>Other</Typography>
                </MenuItem>
              </Select>
            </FormControl>

            {editForm.category.includes("Other") && (
              <TextField
                fullWidth
                label="Custom Category"
                value={editForm.customCategory}
                onChange={(e) => setEditForm((f) => ({ ...f, customCategory: e.target.value }))}
              />
            )}

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Type</InputLabel>
                  <Select
                    label="Type"
                    value={editForm.type}
                    onChange={(e) => {
                      const nextType = e.target.value;
                      const def = getDefaultPackForType(nextType);
                      setEditForm((f) => ({
                        ...f,
                        type: nextType,
                        packCount: def.count,
                        packUnit: def.unit,
                      }));
                    }}
                  >
                    {TYPE_OPTIONS.map((t) => (
                      <MenuItem key={t} value={t}>
                        {t}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Pack Size</InputLabel>
                  <Select
                    label="Pack Size"
                    value={packLabel(editForm.packCount, editForm.packUnit) || ""}
                    onChange={(e) => {
                      const opt = normalizePackOpt(e.target.value);
                      setEditForm((f) => ({ ...f, packCount: opt.count, packUnit: opt.unit }));
                    }}
                  >
                    <MenuItem value="">Select</MenuItem>
                    {(editPackOptions || []).map((raw) => {
                      const o = normalizePackOpt(raw);
                      return (
                        <MenuItem key={o.label || JSON.stringify(raw)} value={o.label}>
                          {o.label}
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            {editForm.type === "Other" && (
              <TextField
                fullWidth
                label="Custom Type"
                value={editForm.customType}
                onChange={(e) => setEditForm((f) => ({ ...f, customType: e.target.value }))}
              />
            )}

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Pack Count"
                  value={editForm.packCount}
                  onChange={(e) => setEditForm((f) => ({ ...f, packCount: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Pack Unit (optional)"
                  value={editForm.packUnit}
                  onChange={(e) => setEditForm((f) => ({ ...f, packUnit: e.target.value }))}
                />
              </Grid>
            </Grid>

            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={editForm.prescriptionRequired}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, prescriptionRequired: e.target.checked }))
                      }
                    />
                  }
                  label="Prescription Required"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="HSN Code"
                  value={editForm.hsn}
                  onChange={(e) => setEditForm((f) => ({ ...f, hsn: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>GST Rate</InputLabel>
                  <Select
                    label="GST Rate"
                    value={editForm.gstRate}
                    onChange={(e) => setEditForm((f) => ({ ...f, gstRate: e.target.value }))}
                  >
                    {[0, 5, 12, 18].map((g) => (
                      <MenuItem key={g} value={g}>
                        {g}%
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            {/* Existing images */}
            <Box
              sx={{
                bgcolor: "#16181a",
                p: 2,
                borderRadius: 2,
                border: "1px solid #2b2f33",
              }}
            >
              <Typography fontWeight={800} sx={{ mb: 1 }}>
                Existing Images
              </Typography>

              {editExistingImages?.length ? (
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" },
                    gap: 1.5,
                  }}
                >
                  {editExistingImages.map((url, idx) => (
                    <Box key={idx} sx={{ position: "relative" }}>
                      <Box
                        component="img"
                        src={url}
                        alt={`existing-${idx}`}
                        sx={{
                          width: "100%",
                          height: 160,
                          objectFit: "cover",
                          borderRadius: 2,
                          border: "1px solid #2b2f33",
                          bgcolor: "#0c0c0c",
                        }}
                      />
                      <Button
                        size="small"
                        variant="contained"
                        color="error"
                        onClick={() =>
                          setEditExistingImages((arr) => arr.filter((x) => x !== url))
                        }
                        sx={{ position: "absolute", top: 8, right: 8 }}
                      >
                        Remove
                      </Button>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Typography sx={{ color: "#aaa" }}>No existing images</Typography>
              )}
            </Box>

            {/* Add new images */}
            <Stack direction="row" spacing={1} alignItems="center">
              <Button variant="outlined" component="label">
                Upload New Images
                <input
                  hidden
                  ref={editFileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setEditNewImages(Array.from(e.target.files || []))}
                />
              </Button>
              <Typography variant="body2" color="text.secondary">
                {editNewImages.length ? `${editNewImages.length} new selected` : "No new images"}
              </Typography>
            </Stack>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ bgcolor: "#0f0f0f" }}>
          <Button onClick={closeEdit} variant="outlined">
            Cancel
          </Button>
          <Button onClick={saveEdit} variant="contained">
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* ✅ DELETE CONFIRM DIALOG */}
      <Dialog open={delOpen} onClose={closeDelete} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 900 }}>Delete Medicine?</DialogTitle>
        <DialogContent dividers>
          <Typography>
            Do you really want to delete{" "}
            <b>{delItem?.name || "this medicine"}</b>?
          </Typography>
          <Typography sx={{ mt: 1, color: "text.secondary" }}>
            This will remove it from Master + Pharmacy Inventory + User/Medicine list everywhere.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDelete} variant="outlined">
            Cancel
          </Button>
          <Button onClick={doDelete} color="error" variant="contained">
            Yes, Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
