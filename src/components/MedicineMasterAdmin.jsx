import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  Box, Button, Card, CardContent, Chip, Divider, Grid, Stack, TextField, Typography,
  FormControlLabel, Checkbox, MenuItem, Select, InputLabel, FormControl
} from "@mui/material";

// ✅ FIX: Use CRA env (same as AdminDashboard)
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

const TYPE_OPTIONS = ["Tablet", "Capsule", "Syrup", "Injection", "Drops", "Cream", "Other"];

export default function MedicineMasterAdmin() {
  const token = localStorage.getItem("adminToken") || "";
  const fileRef = useRef(null);

  const [tab, setTab] = useState("approved"); // approved | pending
  const [q, setQ] = useState("");
  const [list, setList] = useState([]);

  const [form, setForm] = useState({
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
  });

  const [images, setImages] = useState([]);
  const [msg, setMsg] = useState("");

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
    } catch (e) {
      // ✅ Prevent blank screen due to unhandled errors
      setList([]);
      setMsg(e?.response?.data?.error || "❌ Failed to load medicines. Check API_BASE_URL / token.");
      console.error("MedicineMasterAdmin fetchList error:", e);
    }
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line
  }, [tab]);

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

  const addMaster = async () => {
    try {
      setMsg("Uploading...");
      const imgUrls = images.length ? await uploadMany(images) : [];

      const payload = {
        ...form,
        price: Number(form.price || 0),
        mrp: Number(form.mrp || 0),
        discount: Number(form.discount || 0),
        gstRate: Number(form.gstRate || 0),
        packCount: Number(form.packCount || 0),
        images: imgUrls,
        category: form.category
          ? form.category.split(",").map(s => s.trim()).filter(Boolean)
          : [],
        ...(form.type === "Other"
          ? { customType: form.customType || "" }
          : { customType: "" }),
      };

      await axios.post(`${API_BASE_URL}/api/medicine-master/admin`, payload, { headers });

      setMsg("✅ Master medicine added!");
      setForm({
        name: "", brand: "", composition: "", company: "",
        price: "", mrp: "", discount: "",
        category: "", type: "Tablet", customType: "",
        prescriptionRequired: false, productKind: "branded",
        hsn: "3004", gstRate: 5, packCount: "", packUnit: "",
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

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={800}>Medicine Master</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant={tab === "approved" ? "contained" : "outlined"} onClick={() => setTab("approved")}>Approved</Button>
          <Button variant={tab === "pending" ? "contained" : "outlined"} onClick={() => setTab("pending")}>Pending</Button>
        </Stack>
      </Stack>

      <Card sx={{ mb: 2, bgcolor: "#16181a" }}>
        <CardContent>
          <Typography fontWeight={800} sx={{ mb: 1 }}>
            {tab === "approved" ? "Add Master Medicine (Admin)" : "Pending Requests (Approve/Reject)"}
          </Typography>

          {tab === "approved" && (
            <>
              <Grid container spacing={1}>
                <Grid item xs={12} md={4}>
                  <TextField fullWidth label="Name" value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField fullWidth label="Brand" value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })} />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField fullWidth label="Composition" value={form.composition}
                    onChange={(e) => setForm({ ...form, composition: e.target.value })} />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField fullWidth label="Company" value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })} />
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField fullWidth label="Price" value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })} />
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField fullWidth label="MRP" value={form.mrp}
                    onChange={(e) => setForm({ ...form, mrp: e.target.value })} />
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField fullWidth label="Discount %" value={form.discount}
                    onChange={(e) => setForm({ ...form, discount: e.target.value })} />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Category (comma separated)"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="Fever, Pain, Cold"
                  />
                </Grid>

                <Grid item xs={12} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Type</InputLabel>
                    <Select label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                      {TYPE_OPTIONS.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="Custom Type (if Other)"
                    value={form.customType}
                    disabled={form.type !== "Other"}
                    onChange={(e) => setForm({ ...form, customType: e.target.value })}
                  />
                </Grid>

                <Grid item xs={12} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Product Kind</InputLabel>
                    <Select
                      label="Product Kind"
                      value={form.productKind}
                      onChange={(e) => setForm({ ...form, productKind: e.target.value })}
                    >
                      <MenuItem value="branded">Branded</MenuItem>
                      <MenuItem value="generic">Generic</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={3}>
                  <TextField fullWidth label="HSN" value={form.hsn}
                    onChange={(e) => setForm({ ...form, hsn: e.target.value })} />
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField fullWidth label="GST %" value={form.gstRate}
                    onChange={(e) => setForm({ ...form, gstRate: e.target.value })} />
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField fullWidth label="Pack Count" value={form.packCount}
                    onChange={(e) => setForm({ ...form, packCount: e.target.value })} />
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField fullWidth label="Pack Unit" value={form.packUnit}
                    onChange={(e) => setForm({ ...form, packUnit: e.target.value })} placeholder="10 tablets / 60 ml" />
                </Grid>

                <Grid item xs={12} md={4}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={form.prescriptionRequired}
                        onChange={(e) => setForm({ ...form, prescriptionRequired: e.target.checked })}
                      />
                    }
                    label="Prescription Required"
                  />
                </Grid>

                <Grid item xs={12}>
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
                </Grid>
              </Grid>

              <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                <Button variant="contained" onClick={addMaster}>Add to Master</Button>
                <Button variant="outlined" onClick={fetchList}>Refresh</Button>
                <Typography sx={{ ml: 1, alignSelf: "center" }}>{msg}</Typography>
              </Stack>

              <Divider sx={{ my: 2 }} />
            </>
          )}

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
