// src/components/MedicineMasterAdmin.jsx
// FULLY REPLACEABLE — Fix pack size crash + dark theme visibility
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  FormControl,
  FormControlLabel,
  Checkbox,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

// ✅ Reuse same constants as PharmacyDashboard
import { TYPE_OPTIONS, PACK_SIZES_BY_TYPE } from "../constants/packSizes";
import { CUSTOMER_CATEGORIES } from "../constants/customerCategories";

// ✅ (Optional) If you already use these in your project
import BrandAutocomplete from "./fields/BrandAutocomplete";
import CompositionAutocomplete from "./fields/CompositionAutocomplete";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

const splitComps = (s = "") =>
  String(s)
    .split("+")
    .map((x) => x.trim())
    .filter(Boolean);

const joinComps = (arr = []) => (arr || []).map((s) => s.trim()).filter(Boolean).join(" + ");

// ✅ Normalize PACK_SIZES options (can be string OR object)
const normalizePackOpt = (opt) => {
  if (!opt) return null;
  if (typeof opt === "string") {
    // e.g. "10 tablets" OR "10|tablet"
    if (opt.includes("|")) {
      const [c, u] = opt.split("|");
      return { count: Number(c || 0), unit: String(u || "").trim() };
    }
    return { label: opt, key: opt };
  }
  if (typeof opt === "object") {
    const count = Number(opt.count ?? opt.packCount ?? 0);
    const unit = String(opt.unit ?? opt.packUnit ?? "").trim();
    const label =
      opt.label ||
      (count && unit ? `${count} ${unit}` : unit ? `${unit}` : count ? `${count}` : "Pack");
    return { count, unit, label, key: `${count}|${unit}` };
  }
  return { label: String(opt), key: String(opt) };
};

const packLabel = (opt) => {
  if (!opt) return "";
  if (typeof opt === "string") return opt;
  const count = opt.count ?? opt.packCount ?? "";
  const unit = opt.unit ?? opt.packUnit ?? "";
  if (count && unit) return `${count} ${unit}`;
  if (unit) return `${unit}`;
  if (count) return `${count}`;
  return opt.label || "";
};

// ✅ Common dark field styling (fix invisible white text on dark cards)
const darkFieldSx = {
  "& .MuiInputLabel-root": { color: "#cbd5e1" },
  "& .MuiInputLabel-root.Mui-focused": { color: "#e2e8f0" },
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "#334155" },
  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#475569" },
  "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#94a3b8" },
  "& .MuiInputBase-input": { color: "#ffffff" },
  "& .MuiSelect-select": { color: "#ffffff" },
  "& .MuiSvgIcon-root": { color: "#cbd5e1" },
  "& .MuiFormHelperText-root": { color: "#94a3b8" },
};

export default function MedicineMasterAdmin() {
  const fileRef = useRef(null);

  const [tab, setTab] = useState("approved"); // approved/pending
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);

  const [images, setImages] = useState([]);

  const [form, setForm] = useState({
    // aligned with backend model fields
    name: "",
    brand: "",
    composition: "",
    company: "",
    price: "",
    mrp: "",
    discount: "",
    category: "", // comma separated
    type: "Tablet",
    customType: "",
    prescriptionRequired: false,
    productKind: "branded",
    hsn: "3004",
    gstRate: 5,
    packCount: "",
    packUnit: "",
    description: "",
  });

  // ✅ pack options depend on type
  const packOptions = useMemo(() => {
    const raw = PACK_SIZES_BY_TYPE?.[form.type] || [];
    return raw.map(normalizePackOpt).filter(Boolean);
  }, [form.type]);

  // ✅ Build select value as string key to avoid MUI object-value crash
  const packValue = useMemo(() => {
    const c = form.packCount;
    const u = form.packUnit;
    if (!c && !u) return "";
    return `${Number(c || 0)}|${String(u || "").trim()}`;
  }, [form.packCount, form.packUnit]);

  const headers = useMemo(() => {
    const token = localStorage.getItem("adminToken") || localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchList = async () => {
    try {
      setLoading(true);
      setMsg("");
      const status = tab === "pending" ? "pending" : "approved";
      const res = await axios.get(`${API_BASE_URL}/api/medicine-master/admin/all`, {
        params: { q, status },
        headers,
      });
      setList(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setMsg(e?.response?.data?.error || "❌ Failed to load medicines. Check API_BASE_URL / token.");
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const handleTypeChange = (newType) => {
    // ✅ reset pack when type changes
    setForm((p) => ({
      ...p,
      type: newType,
      packCount: "",
      packUnit: "",
    }));
  };

  const handlePackSelect = (val) => {
    // val: "count|unit"
    if (!val) {
      setForm((p) => ({ ...p, packCount: "", packUnit: "" }));
      return;
    }
    const [c, u] = String(val).split("|");
    setForm((p) => ({ ...p, packCount: Number(c || 0), packUnit: String(u || "").trim() }));
  };

  const addMaster = async () => {
    try {
      setMsg("");
      const payload = {
        ...form,
        price: Number(form.price || 0),
        mrp: Number(form.mrp || 0),
        discount: Number(form.discount || 0),
        gstRate: Number(form.gstRate || 0),
        packCount: Number(form.packCount || 0),
        packUnit: String(form.packUnit || ""),
        category: form.category
          ? form.category.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        ...(form.type === "Other" ? { customType: form.customType || "" } : { customType: "" }),
        images: [], // (if you upload to cloud, set URLs here)
        description: form.description || "",
      };

      await axios.post(`${API_BASE_URL}/api/medicine-master/admin`, payload, { headers });

      setMsg("✅ Master medicine added!");
      setForm({
        name: "",
        brand: "",
        composition: "",
        company: "",
        price: "",
        mrp: "",
        discount: "",
        category: "",
        type: "Tablet",
        customType: "",
        prescriptionRequired: false,
        productKind: "branded",
        hsn: "3004",
        gstRate: 5,
        packCount: "",
        packUnit: "",
        description: "",
      });
      setImages([]);
      if (fileRef.current) fileRef.current.value = "";
      fetchList();
    } catch (e) {
      setMsg(e?.response?.data?.error || "❌ Failed to add master medicine.");
      // console error helps you debug quickly
      // eslint-disable-next-line no-console
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

  return (
    <Box sx={{ color: "#e5e7eb" }}>
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

      <Card sx={{ mb: 2, bgcolor: "#16181a", border: "1px solid #243041" }}>
        <CardContent>
          <Typography fontWeight={800} sx={{ mb: 1 }}>
            {tab === "approved" ? "Add Master Medicine (Admin)" : "Pending Requests (Approve/Reject)"}
          </Typography>

          {tab === "approved" && (
            <>
              <Grid container spacing={1}>
                <Grid item xs={12} md={4}>
                  <TextField
                    sx={darkFieldSx}
                    fullWidth
                    label="Medicine Name"
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  {/* if you don't have BrandAutocomplete, replace with TextField */}
                  {BrandAutocomplete ? (
                    <BrandAutocomplete
                      value={form.brand}
                      onChange={(v) => setForm((p) => ({ ...p, brand: v || "" }))}
                      textFieldProps={{ fullWidth: true, sx: darkFieldSx, label: "Brand" }}
                    />
                  ) : (
                    <TextField
                      sx={darkFieldSx}
                      fullWidth
                      label="Brand"
                      value={form.brand}
                      onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))}
                    />
                  )}
                </Grid>

                <Grid item xs={12} md={4}>
                  {CompositionAutocomplete ? (
                    <CompositionAutocomplete
                      value={splitComps(form.composition)}
                      onChange={(arr) => setForm((p) => ({ ...p, composition: joinComps(arr) }))}
                      textFieldProps={{ fullWidth: true, sx: darkFieldSx, label: "Composition (Salts)" }}
                    />
                  ) : (
                    <TextField
                      sx={darkFieldSx}
                      fullWidth
                      label="Composition"
                      value={form.composition}
                      onChange={(e) => setForm((p) => ({ ...p, composition: e.target.value }))}
                    />
                  )}
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    sx={darkFieldSx}
                    fullWidth
                    label="Company / Manufacturer"
                    value={form.company}
                    onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    sx={darkFieldSx}
                    fullWidth
                    label="Selling Price"
                    value={form.price}
                    onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    sx={darkFieldSx}
                    fullWidth
                    label="MRP"
                    value={form.mrp}
                    onChange={(e) => setForm((p) => ({ ...p, mrp: e.target.value }))}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    sx={darkFieldSx}
                    fullWidth
                    label="Discount (%)"
                    value={form.discount}
                    onChange={(e) => setForm((p) => ({ ...p, discount: e.target.value }))}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    sx={darkFieldSx}
                    fullWidth
                    label="Category (comma separated)"
                    value={form.category}
                    onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <FormControl fullWidth sx={darkFieldSx}>
                    <InputLabel>Type</InputLabel>
                    <Select
                      value={form.type}
                      label="Type"
                      onChange={(e) => handleTypeChange(e.target.value)}
                    >
                      {TYPE_OPTIONS.map((t) => (
                        <MenuItem key={t} value={t}>
                          {t}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {form.type === "Other" && (
                  <Grid item xs={12} md={4}>
                    <TextField
                      sx={darkFieldSx}
                      fullWidth
                      label="Custom Type (if Other)"
                      value={form.customType}
                      onChange={(e) => setForm((p) => ({ ...p, customType: e.target.value }))}
                    />
                  </Grid>
                )}

                {/* ✅ FIXED: Pack Size dropdown (no crash) */}
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth sx={darkFieldSx}>
                    <InputLabel>Pack Size</InputLabel>
                    <Select
                      value={packValue}
                      label="Pack Size"
                      onChange={(e) => handlePackSelect(e.target.value)}
                    >
                      <MenuItem value="">
                        <em>None</em>
                      </MenuItem>
                      {packOptions.map((o) => (
                        <MenuItem key={o.key} value={o.key}>
                          {o.label || packLabel(o)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    sx={darkFieldSx}
                    fullWidth
                    label="HSN Code"
                    value={form.hsn}
                    onChange={(e) => setForm((p) => ({ ...p, hsn: e.target.value }))}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <FormControl fullWidth sx={darkFieldSx}>
                    <InputLabel>GST %</InputLabel>
                    <Select
                      value={form.gstRate}
                      label="GST %"
                      onChange={(e) => setForm((p) => ({ ...p, gstRate: e.target.value }))}
                    >
                      {[0, 5, 12, 18].map((g) => (
                        <MenuItem key={g} value={g}>
                          {g}%
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={12}>
                  <TextField
                    sx={darkFieldSx}
                    fullWidth
                    label="Description (optional)"
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <FormControl fullWidth sx={darkFieldSx}>
                    <InputLabel>Product Kind</InputLabel>
                    <Select
                      value={form.productKind}
                      label="Product Kind"
                      onChange={(e) => setForm((p) => ({ ...p, productKind: e.target.value }))}
                    >
                      <MenuItem value="branded">Branded</MenuItem>
                      <MenuItem value="generic">Generic</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={8}>
                  <FormControlLabel
                    sx={{ mt: 1 }}
                    control={
                      <Checkbox
                        checked={form.prescriptionRequired}
                        onChange={(e) => setForm((p) => ({ ...p, prescriptionRequired: e.target.checked }))}
                      />
                    }
                    label="Prescription Required"
                  />
                </Grid>

                <Grid item xs={12} md={12}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Button variant="outlined" component="label">
                      Upload Images
                      <input
                        ref={fileRef}
                        type="file"
                        hidden
                        multiple
                        accept="image/*"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          setImages(files);
                        }}
                      />
                    </Button>
                    <Typography variant="body2" sx={{ color: "#94a3b8" }}>
                      {images?.length ? `${images.length} file(s) selected` : "No images"}
                    </Typography>
                  </Stack>
                </Grid>

                <Grid item xs={12} md={12}>
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <Button variant="contained" onClick={addMaster}>
                      Add To Master
                    </Button>
                    <Button variant="outlined" onClick={fetchList}>
                      Refresh
                    </Button>
                  </Stack>
                </Grid>
              </Grid>

              {msg && (
                <Typography sx={{ mt: 1 }} color={msg.includes("✅") ? "success.main" : "error.main"}>
                  {msg}
                </Typography>
              )}
            </>
          )}

          {tab === "pending" && (
            <>
              <Typography variant="body2" sx={{ color: "#94a3b8", mb: 1 }}>
                Pending medicines list — approve/reject.
              </Typography>

              {msg && (
                <Typography sx={{ mb: 1 }} color={msg.includes("✅") ? "success.main" : "error.main"}>
                  {msg}
                </Typography>
              )}

              <Button variant="outlined" onClick={fetchList} disabled={loading}>
                {loading ? "Loading..." : "Refresh"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card sx={{ bgcolor: "#0f1115", border: "1px solid #243041" }}>
        <CardContent>
          <Stack direction="row" spacing={1} sx={{ mb: 1 }} alignItems="center">
            <TextField
              sx={darkFieldSx}
              size="small"
              fullWidth
              label="Search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <Button variant="contained" onClick={fetchList}>
              Search
            </Button>
          </Stack>

          <Divider sx={{ my: 1, borderColor: "#243041" }} />

          {!list?.length ? (
            <Typography sx={{ color: "#94a3b8" }}>{loading ? "Loading..." : "No records."}</Typography>
          ) : (
            <Stack spacing={1}>
              {list.map((m) => (
                <Card key={m._id} sx={{ bgcolor: "#111827", border: "1px solid #1f2937" }}>
                  <CardContent sx={{ py: 1.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                      <Box>
                        <Typography fontWeight={800}>
                          {m.name}{" "}
                          <Typography component="span" sx={{ color: "#94a3b8", fontWeight: 500 }}>
                            {m.brand ? `• ${m.brand}` : ""}
                          </Typography>
                        </Typography>
                        <Typography variant="body2" sx={{ color: "#94a3b8" }}>
                          {m.composition || "-"} • {m.type || "-"} •{" "}
                          {m.packCount && m.packUnit ? `${m.packCount} ${m.packUnit}` : "No pack"}
                        </Typography>
                      </Box>

                      {tab === "pending" ? (
                        <Stack direction="row" spacing={1}>
                          <Button color="success" variant="contained" onClick={() => approve(m._id)}>
                            Approve
                          </Button>
                          <Button color="error" variant="outlined" onClick={() => reject(m._id)}>
                            Reject
                          </Button>
                        </Stack>
                      ) : (
                        <Typography variant="body2" sx={{ color: "#22c55e" }}>
                          Approved
                        </Typography>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
