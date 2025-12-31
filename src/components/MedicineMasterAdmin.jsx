// src/components/admin/MedicineMasterAdmin.jsx
// MedicineMasterAdmin.jsx (FULLY REPLACEABLE)
// Make Admin Medicine Master form behave like PharmacyDashboard "Request New Medicine"

import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  Box, Button, Card, CardContent, Chip, Divider, Grid, Stack, TextField, Typography,
  FormControlLabel, Checkbox, MenuItem, Select, InputLabel, FormControl
} from "@mui/material";

// ✅ Reuse same components used in PharmacyDashboard
import BrandAutocomplete from "./fields/BrandAutocomplete";
import CompositionAutocomplete from "./fields/CompositionAutocomplete";

// ✅ Reuse same constants (as in PharmacyDashboard)
import { TYPE_OPTIONS, PACK_SIZES_BY_TYPE } from "../constants/packSizes";
import { CUSTOMER_CATEGORIES } from "../constants/customerCategories";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

// ---- helpers (same pattern as PharmacyDashboard) ----
const splitComps = (s = "") => String(s).split("+").map(x => x.trim()).filter(Boolean);
const joinComps = (arr = []) => arr.map(s => s.trim()).filter(Boolean).join(" + ");

const keepUnlessExplicitClear = (prev, next) =>
  next === null ? "" : (typeof next === "string" && next.trim() === "" ? prev : next);

export default function MedicineMasterAdmin() {
  const token = localStorage.getItem("adminToken") || "";
  const fileRef = useRef(null);

  const [tab, setTab] = useState("approved"); // approved | pending
  const [q, setQ] = useState("");
  const [list, setList] = useState([]);
  const [msg, setMsg] = useState("");

  // ✅ Admin form = Pharmacy-style
  const [form, setForm] = useState({
    productKind: "branded", // branded | generic
    name: "",
    brand: "",
    composition: "",
    compositions: [],

    company: "",
    price: "",
    mrp: "",
    discount: "",

    category: [],           // multi-select categories
    customCategory: "",     // if "Other"
    type: "Tablet",
    customType: "",
    packCount: "",
    packUnit: "",

    prescriptionRequired: false,
    hsn: "3004",
    gstRate: 5,
  });

  const [images, setImages] = useState([]);

  const headers = useMemo(
    () => ({ Authorization: `Bearer ${token}` }),
    [token]
  );

  const fetchList = async () => {
    try {
      const status = tab === "pending" ? "pending" : "approved";
      const res = await axios.get(
        `${API_BASE_URL}/api/medicine-master/admin/all?q=${encodeURIComponent(q)}&status=${status}`,
        { headers }
      );
      setList(res.data || []);
      setMsg("");
    } catch (e) {
      setList([]);
      setMsg(e?.response?.data?.error || "❌ Failed to load medicines. Check API_BASE_URL / token.");
      console.error("MedicineMasterAdmin fetchList error:", e);
    }
  };

  useEffect(() => { fetchList(); /* eslint-disable-next-line */ }, [tab]);

  const uploadMany = async (files) => {
    const urls = [];
    for (const f of files) {
      const fd = new FormData();
      fd.append("file", f);
      const r = await axios.post(`${API_BASE_URL}/api/upload`, fd, { headers });
      if (r?.data?.url) urls.push(r.data.url);
    }
    return urls;
  };

  const computedCategory = () => {
    const cats = Array.isArray(form.category) ? form.category : [];
    if (cats.includes("Other")) {
      const custom = (form.customCategory || "").trim();
      return [...cats.filter(c => c !== "Other"), ...(custom ? [custom] : [])];
    }
    return cats;
  };

  const computedType = () => {
    if (form.type === "Other") return (form.customType || "").trim() || "Other";
    return form.type || "Tablet";
  };

  const addMaster = async () => {
    try {
      setMsg("Uploading...");
      const imgUrls = images.length ? await uploadMany(images) : [];

      const compositionValue =
        form.compositions?.length ? joinComps(form.compositions) : (form.composition || "");

      const payload = {
        // identity
        productKind: form.productKind,
        name: (form.name || form.brand || compositionValue || "").trim(),
        brand: form.productKind === "generic" ? "" : (form.brand || "").trim(),
        composition: (compositionValue || "").trim(),
        company: (form.company || "").trim(),

        // commerce
        price: Number(form.price || 0),
        mrp: Number(form.mrp || 0),
        discount: Number(form.discount || 0),

        // catalog
        category: computedCategory(),
        type: computedType(),
        customType: form.type === "Other" ? (form.customType || "") : "",

        // compliance
        prescriptionRequired: !!form.prescriptionRequired,
        hsn: String(form.hsn || "3004").replace(/[^\d]/g, "") || "3004",
        gstRate: Number(form.gstRate || 0),

        // pack
        packCount: Number(form.packCount || 0),
        packUnit: (form.packUnit || "").trim(),

        // media
        images: imgUrls,
      };

      await axios.post(`${API_BASE_URL}/api/medicine-master/admin`, payload, { headers });

      setMsg("✅ Master medicine added!");
      setForm({
        productKind: "branded",
        name: "", brand: "", composition: "", compositions: [],
        company: "", price: "", mrp: "", discount: "",
        category: [], customCategory: "",
        type: "Tablet", customType: "",
        packCount: "", packUnit: "",
        prescriptionRequired: false,
        hsn: "3004", gstRate: 5,
      });
      setImages([]);
      if (fileRef.current) fileRef.current.value = "";
      fetchList();
    } catch (e) {
      setMsg(e?.response?.data?.error || "❌ Failed to add master medicine.");
      console.error("MedicineMasterAdmin addMaster error:", e);
    }
  };

  const approve = async (id) => {
    try {
      await axios.patch(`${API_BASE_URL}/api/medicine-master/${id}/approve`, {}, { headers });
      fetchList();
    } catch (e) {
      setMsg(e?.response?.data?.error || "❌ Approve failed.");
    }
  };

  const reject = async (id) => {
    try {
      await axios.patch(`${API_BASE_URL}/api/medicine-master/${id}/reject`, {}, { headers });
      fetchList();
    } catch (e) {
      setMsg(e?.response?.data?.error || "❌ Reject failed.");
    }
  };

  // pack size dropdown options based on type
  const packOptions = PACK_SIZES_BY_TYPE?.[form.type] || [];

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={800}>Medicine Master</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant={tab === "approved" ? "contained" : "outlined"} onClick={() => setTab("approved")}>
            Approved
          </Button>
          <Button variant={tab === "pending" ? "contained" : "outlined"} onClick={() => setTab("pending")}>
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
              {/* ✅ Pharmacy-style form */}
              <Box
  sx={{ mt: 1, pb: 2, bgcolor: "#212325", border: "1px solid #1d8f72", borderRadius: 2, p: 2 }}
>

                <Stack spacing={2}>
                  {/* Brand Type */}
                  <FormControl fullWidth>
                    <InputLabel>Brand Type</InputLabel>
                    <Select
                      label="Brand Type"
                      value={form.productKind}
                      onChange={(e) => {
                        const v = e.target.value;
                        setForm(f => ({
                          ...f,
                          productKind: v,
                          brand: v === "generic" ? "" : f.brand,
                          name: v === "generic"
                            ? (f.name || f.composition || "")
                            : (f.name || f.brand || "")
                        }));
                      }}
                    >
                      <MenuItem value="branded">Branded</MenuItem>
                      <MenuItem value="generic">Generic</MenuItem>
                    </Select>
                  </FormControl>

                  {/* Brand (only for branded) */}
                  {form.productKind === "branded" && (
                    <BrandAutocomplete
                      value={form.brand}
                      onValueChange={(val) =>
                        setForm(f => {
                          const nextBrand = keepUnlessExplicitClear(f.brand, val);
                          return { ...f, brand: nextBrand, name: f.name || nextBrand };
                        })
                      }
                      onPrefill={(p) =>
                        setForm(f => ({
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

                  {/* Name (always available) */}
                  <TextField
                    fullWidth
                    label="Medicine Name"
                    value={form.name}
                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  />

                  {/* Composition autocomplete (supports multi-composition) */}
                  <CompositionAutocomplete
                    value={form.composition}
                    onValueChange={(val) =>
                      setForm(f => ({
                        ...f,
                        composition: keepUnlessExplicitClear(f.composition, val),
                        compositions: splitComps(val || f.composition || "")
                      }))
                    }
                    onAddComposition={(c) =>
                      setForm(f => {
                        const next = Array.from(new Set([...(f.compositions || []), c])).filter(Boolean);
                        return { ...f, compositions: next, composition: joinComps(next) };
                      })
                    }
                    compositions={form.compositions || []}
                    onRemoveComposition={(c) =>
                      setForm(f => {
                        const next = (f.compositions || []).filter(x => x !== c);
                        return { ...f, compositions: next, composition: joinComps(next) };
                      })
                    }
                  />

                  <TextField
                    fullWidth
                    label="Company / Manufacturer"
                    value={form.company}
                    onChange={(e) => setForm(f => ({ ...f, company: e.target.value }))}
                  />

                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        label="Selling Price"
                        value={form.price}
                        onChange={(e) => setForm(f => ({ ...f, price: e.target.value }))}
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        label="MRP"
                        value={form.mrp}
                        onChange={(e) => setForm(f => ({ ...f, mrp: e.target.value }))}
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        label="Discount (%)"
                        value={form.discount}
                        onChange={(e) => setForm(f => ({ ...f, discount: e.target.value }))}
                      />
                    </Grid>
                  </Grid>

                  {/* Category (multi-select) */}
                  <FormControl fullWidth>
                    <InputLabel>Category</InputLabel>
                    <Select
                      multiple
                      label="Category"
                      value={form.category}
                      onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}
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
                      onChange={(e) => setForm(f => ({ ...f, customCategory: e.target.value }))}
                    />
                  )}

                  {/* Type + pack */}
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth>
                        <InputLabel>Type</InputLabel>
                        <Select
                          label="Type"
                          value={form.type}
                          onChange={(e) => setForm(f => ({ ...f, type: e.target.value }))}
                        >
                          {TYPE_OPTIONS.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth>
                        <InputLabel>Pack Size</InputLabel>
                        <Select
                          label="Pack Size"
                          value={form.packUnit || ""}
                          onChange={(e) => setForm(f => ({ ...f, packUnit: e.target.value }))}
                        >
                          <MenuItem value="">Select</MenuItem>
                          {(packOptions || []).map((opt) => (
                            <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>

                  {form.type === "Other" && (
                    <TextField
                      fullWidth
                      label="Custom Type"
                      value={form.customType}
                      onChange={(e) => setForm(f => ({ ...f, customType: e.target.value }))}
                    />
                  )}

                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Pack Count"
                        value={form.packCount}
                        onChange={(e) => setForm(f => ({ ...f, packCount: e.target.value }))}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Pack Unit (optional)"
                        value={form.packUnit}
                        onChange={(e) => setForm(f => ({ ...f, packUnit: e.target.value }))}
                        placeholder="10 tablets / 60 ml"
                      />
                    </Grid>
                  </Grid>

                  {/* Rx + HSN/GST */}
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={4}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={form.prescriptionRequired}
                            onChange={(e) => setForm(f => ({ ...f, prescriptionRequired: e.target.checked }))}
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
                        onChange={(e) => setForm(f => ({ ...f, hsn: e.target.value }))}
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <FormControl fullWidth>
                        <InputLabel>GST Rate</InputLabel>
                        <Select
                          label="GST Rate"
                          value={form.gstRate}
                          onChange={(e) => setForm(f => ({ ...f, gstRate: e.target.value }))}
                        >
                          {[0, 5, 12, 18].map(g => <MenuItem key={g} value={g}>{g}%</MenuItem>)}
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>

                  {/* Images */}
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
                    <Button variant="contained" onClick={addMaster}>Add to Master</Button>
                    <Button variant="outlined" onClick={fetchList}>Refresh</Button>
                    <Typography sx={{ ml: 1, alignSelf: "center" }}>{msg}</Typography>
                  </Stack>
                </Stack>
              </Box>

              <Divider sx={{ my: 2 }} />
            </>
          )}

          {/* Search + list */}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 2 }}>
            <TextField fullWidth label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
            <Button variant="outlined" onClick={fetchList}>Search</Button>
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
                        {m.prescriptionRequired ? <Chip size="small" color="warning" label="Rx Required" /> : null}
                        {Array.isArray(m.category) ? m.category.slice(0, 4).map((c) => (
                          <Chip key={c} size="small" label={c} />
                        )) : null}
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        Status: {m.status} • By: {m.createdByType}
                      </Typography>
                    </Box>

                    {tab === "pending" && (
                      <Stack direction="row" spacing={1}>
                        <Button variant="contained" onClick={() => approve(m._id)}>Approve</Button>
                        <Button variant="outlined" color="error" onClick={() => reject(m._id)}>Reject</Button>
                      </Stack>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            ))}

            {list.length === 0 && (
              <Typography color="text.secondary">No records.</Typography>
            )}
          </Stack>

          {msg ? <Typography sx={{ mt: 2 }}>{msg}</Typography> : null}
        </CardContent>
      </Card>
    </Box>
  );
}
