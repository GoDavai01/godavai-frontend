import React, { useState } from "react";
import {
  Box, Button, TextField, Typography, Stepper, Step, StepLabel,
  Stack, Snackbar, Alert, FormControlLabel, Checkbox, InputLabel, MenuItem, Select, FormHelperText
} from "@mui/material";
import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

const initialForm = {
  name: "", ownerName: "", city: "", area: "", address: "",
  contact: "", email: "", password: "", pin: "", 
  open24: false, timingFromHour: "", timingFromMinute: "", timingFromAmPm: "",
  timingToHour: "", timingToMinute: "", timingToAmPm: "",
  qualification: "", stateCouncilReg: "", drugLicenseRetail: "", gstin: "",
  bankAccount: "", ifsc: "", bankName: "", accountHolder: "",
  declarationAccepted: false,
  businessContact: "", businessContactName: "", emergencyContact: "",
  lat: "", // for latitude
  lng: "", // for longitude
  formattedLocation: "", // to display a user-friendly location (optional)
};

const hours = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const minutes = ["00", "15", "30", "45"];
const selectMenuProps = {
  MenuProps: {
    anchorOrigin: { vertical: "top", horizontal: "left" },
    transformOrigin: { vertical: "bottom", horizontal: "left" },
    getContentAnchorEl: null
  }
};
const fileTypes = ".jpg,.jpeg,.png,.pdf";
const steps = [
  "Pharmacy & Owner Details",
  "Licenses & Credentials",
  "Identity & Address Verification",
  "Bank & Operations",
  "Declaration & Submit"
];
const requiredDocs = {
  qualificationCert: "Qualification Certificate (D.Pharm/B.Pharm/Pharm.D)",
  councilCert: "State Pharmacy Council Registration Certificate",
  retailLicense: "Retail Drug License (Form 20/21)",
  gstCert: "GST Certificate",
  identityProof: "Identity Proof (Aadhaar/PAN/Passport)",
  addressProof: "Address Proof (Utility bill/VoterID/Rent agreement)",
  photo: "Passport-size Photo",
};
const optionalDocs = {
  wholesaleLicense: "Wholesale Drug License (if applicable)",
  shopEstablishmentCert: "Shop Establishment Certificate (if regionally required)",
  tradeLicense: "Trade License (rare/optional)",
  digitalSignature: "Digital Signature (optional)",
};

function computeTimings(form) {
  if (form.open24) {
    return JSON.stringify({ is24Hours: true });
  }
  const open = `${form.timingFromHour}:${form.timingFromMinute} ${form.timingFromAmPm}`;
  const close = `${form.timingToHour}:${form.timingToMinute} ${form.timingToAmPm}`;
  return JSON.stringify({ is24Hours: false, open, close });
}

// Helper for snackbar severity
const getMsgSeverity = (msg) => {
  if (!msg) return "info";
  const lower = msg.toLowerCase();
  if (
    lower.includes("fail") ||
    lower.includes("error") ||
    lower.includes("required") ||
    lower.includes("highlighted") ||
    lower.includes("missing") ||
    lower.includes("invalid")
  ) return "error";
  if (
    lower.includes("success") ||
    lower.includes("submitted") ||
    lower.includes("approved")
  ) return "success";
  return "info";
};

// ===== StepContent Component (EXTRACTED) =====
const StepContent = React.memo(function StepContent({
  step, form, errors, handleChange, handleFile, handleTimingChange,
  fileErrors, requiredDocs, optionalDocs, selectMenuProps, hours, minutes, safe, files
}) {
  switch (step) {
    case 0:
      return (
        <Stack spacing={2}>
          <TextField label="Pharmacy Name" name="name" value={safe(form.name)}
            onChange={handleChange} required error={!!errors.name} helperText={errors.name ? "Required" : ""} />
          <TextField label="Pharmacist's Name (Owner)" name="ownerName" value={safe(form.ownerName)}
            onChange={handleChange} required error={!!errors.ownerName} helperText={errors.ownerName ? "Required" : ""} />
          <TextField label="City" name="city" value={safe(form.city)}
            onChange={handleChange} required error={!!errors.city} helperText={errors.city ? "Required" : ""} />
          <TextField label="Area" name="area" value={safe(form.area)}
            onChange={handleChange} required error={!!errors.area} helperText={errors.area ? "Required" : ""} />
          <TextField label="Full Address" name="address" value={safe(form.address)}
            onChange={handleChange} required error={!!errors.address} helperText={errors.address ? "Required" : ""} multiline minRows={2} />
            <Button
  variant={form.lat && form.lng ? "contained" : "outlined"}
  color="primary"
  sx={{ mt: 1, mb: 1 }}
  onClick={async () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported on this device/browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm(f => ({
          ...f,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          formattedLocation: `Lat: ${pos.coords.latitude.toFixed(5)}, Lng: ${pos.coords.longitude.toFixed(5)}`
        }));
      },
      (err) => {
        alert("Could not fetch location: " + err.message);
      }
    );
  }}
>
  {form.lat && form.lng ? "Location Set" : "Set Current Location"}
</Button>
{form.lat && form.lng && (
  <Typography fontSize={13} sx={{ color: "green", mb: 1 }}>
    Location: {form.formattedLocation}
  </Typography>
)}

          <TextField label="Contact Number" name="contact" value={safe(form.contact)}
            onChange={handleChange} required error={!!errors.contact} helperText={errors.contact ? "10-digit number" : ""} />
          <TextField label="Login Email" name="email" value={safe(form.email)}
            onChange={handleChange} required error={!!errors.email} helperText={errors.email ? "Valid email required" : ""} />
          <TextField label="Password" name="password" type="password" value={safe(form.password)}
            onChange={handleChange} required error={!!errors.password} helperText={errors.password ? "Min 6 characters" : ""} />
          <TextField
            label="Set 4-digit Login PIN"
            name="pin"
            value={safe(form.pin)}
            onChange={handleChange}
            required
            type="password"
            inputProps={{ maxLength: 4, inputMode: "numeric", pattern: "\\d{4}" }}
            error={!!errors.pin}
            helperText={errors.pin ? "PIN must be 4 digits, unique, not same as mobile" : ""}
          />

          <Box>
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.open24}
                  name="open24"
                  onChange={e => handleTimingChange("open24", e.target.checked)}
                />
              }
              label="Open 24 Hours"
            />
            {!form.open24 && (
              <Stack direction="row" spacing={2} alignItems="center" justifyContent="center">
                <Stack spacing={1} alignItems="center">
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>From</Typography>
                  <Select
                    value={safe(form.timingFromHour)}
                    onChange={e => handleTimingChange("timingFromHour", e.target.value)}
                    displayEmpty
                    size="small"
                    error={!!errors.pharmacyTimings}
                    sx={{ minWidth: 72 }}
                    {...selectMenuProps}
                  >
                    <MenuItem value="">HH</MenuItem>
                    {hours.map(h => <MenuItem key={h} value={h}>{h}</MenuItem>)}
                  </Select>
                  <Select
                    value={safe(form.timingFromMinute)}
                    onChange={e => handleTimingChange("timingFromMinute", e.target.value)}
                    displayEmpty
                    size="small"
                    error={!!errors.pharmacyTimings}
                    sx={{ minWidth: 72 }}
                    {...selectMenuProps}
                  >
                    <MenuItem value="">MM</MenuItem>
                    {minutes.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                  </Select>
                  <Select
                    value={safe(form.timingFromAmPm)}
                    onChange={e => handleTimingChange("timingFromAmPm", e.target.value)}
                    displayEmpty
                    size="small"
                    error={!!errors.pharmacyTimings}
                    sx={{ minWidth: 72 }}
                    {...selectMenuProps}
                  >
                    <MenuItem value="">AM/PM</MenuItem>
                    <MenuItem value="AM">AM</MenuItem>
                    <MenuItem value="PM">PM</MenuItem>
                  </Select>
                </Stack>
                <Stack alignItems="center" sx={{ pt: 2 }}>
                  <Typography variant="subtitle2">to</Typography>
                </Stack>
                <Stack spacing={1} alignItems="center">
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>To</Typography>
                  <Select
                    value={safe(form.timingToHour)}
                    onChange={e => handleTimingChange("timingToHour", e.target.value)}
                    displayEmpty
                    size="small"
                    error={!!errors.pharmacyTimings}
                    sx={{ minWidth: 72 }}
                    {...selectMenuProps}
                  >
                    <MenuItem value="">HH</MenuItem>
                    {hours.map(h => <MenuItem key={h} value={h}>{h}</MenuItem>)}
                  </Select>
                  <Select
                    value={safe(form.timingToMinute)}
                    onChange={e => handleTimingChange("timingToMinute", e.target.value)}
                    displayEmpty
                    size="small"
                    error={!!errors.pharmacyTimings}
                    sx={{ minWidth: 72 }}
                    {...selectMenuProps}
                  >
                    <MenuItem value="">MM</MenuItem>
                    {minutes.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                  </Select>
                  <Select
                    value={safe(form.timingToAmPm)}
                    onChange={e => handleTimingChange("timingToAmPm", e.target.value)}
                    displayEmpty
                    size="small"
                    error={!!errors.pharmacyTimings}
                    sx={{ minWidth: 72 }}
                    {...selectMenuProps}
                  >
                    <MenuItem value="">AM/PM</MenuItem>
                    <MenuItem value="AM">AM</MenuItem>
                    <MenuItem value="PM">PM</MenuItem>
                  </Select>
                </Stack>
              </Stack>
            )}
            {errors.pharmacyTimings && (
              <FormHelperText error>
                Please fill complete timings or select "24 Hours"
              </FormHelperText>
            )}
          </Box>
        </Stack>
      );
    case 1:
      return (
        <Stack spacing={2}>
          <TextField label="Pharmacy Qualification (D.Pharm/B.Pharm/Pharm.D)" name="qualification" value={safe(form.qualification)}
            onChange={handleChange} required error={!!errors.qualification} helperText={errors.qualification ? "Required" : ""} />
          <TextField label="State Pharmacy Council Reg. No." name="stateCouncilReg" value={safe(form.stateCouncilReg)}
            onChange={handleChange} required error={!!errors.stateCouncilReg} helperText={errors.stateCouncilReg ? "Required" : ""} />
          <TextField label="Retail Drug License No." name="drugLicenseRetail" value={safe(form.drugLicenseRetail)}
            onChange={handleChange} required error={!!errors.drugLicenseRetail} helperText={errors.drugLicenseRetail ? "Required" : ""} />
          <TextField label="GST Registration Number (GSTIN)" name="gstin" value={safe(form.gstin)}
            onChange={handleChange} required error={!!errors.gstin} helperText={errors.gstin ? "Required" : ""} />
          {Object.keys(requiredDocs).map(k => (
            <Box key={k}>
              <InputLabel required>{requiredDocs[k]}</InputLabel>
              <input type="file" accept={fileTypes} onChange={e => handleFile(e, k)} />
              {files[k] instanceof File && (
                <Typography variant="caption" color="primary">
                  {files[k].name}
                </Typography>
              )}
              <Typography color="error" variant="caption">
                {fileErrors[k] || (errors[k] && "Required")}
              </Typography>
            </Box>
          ))}
          {Object.keys(optionalDocs).map(k => (
            <Box key={k}>
              <InputLabel>{optionalDocs[k]}</InputLabel>
              <input type="file" accept={fileTypes} onChange={e => handleFile(e, k)} />
              {files[k] instanceof File && (
                <Typography variant="caption" color="primary">
                  {files[k].name}
                </Typography>
              )}
              <Typography color="error" variant="caption">
                {fileErrors[k]}
              </Typography>
            </Box>
          ))}
        </Stack>
      );
    case 2:
      return (
        <Stack spacing={2}>
          <InputLabel required>Identity Proof (Aadhaar/PAN/Passport)</InputLabel>
          <input type="file" accept={fileTypes} onChange={e => handleFile(e, "identityProof")} />
          {files.identityProof instanceof File && (
            <Typography variant="caption" color="primary">
              {files.identityProof.name}
            </Typography>
          )}
          <Typography color="error" variant="caption">{fileErrors.identityProof || (errors.identityProof && "Required")}</Typography>

          <InputLabel required>Address Proof (Utility bill/VoterID/Rent agreement)</InputLabel>
          <input type="file" accept={fileTypes} onChange={e => handleFile(e, "addressProof")} />
          {files.addressProof instanceof File && (
            <Typography variant="caption" color="primary">
              {files.addressProof.name}
            </Typography>
          )}
          <Typography color="error" variant="caption">{fileErrors.addressProof || (errors.addressProof && "Required")}</Typography>

          <InputLabel required>Passport-size Photo</InputLabel>
          <input type="file" accept={fileTypes} onChange={e => handleFile(e, "photo")} />
          {files.photo instanceof File && (
            <Typography variant="caption" color="primary">
              {files.photo.name}
            </Typography>
          )}
          <Typography color="error" variant="caption">{fileErrors.photo || (errors.photo && "Required")}</Typography>
        </Stack>
      );
    case 3:
      return (
        <Stack spacing={2}>
          <TextField label="Bank Account Number" name="bankAccount" value={safe(form.bankAccount)}
            onChange={handleChange} required error={!!errors.bankAccount} helperText={errors.bankAccount ? "Required" : ""} />
          <TextField label="Account Holder Name" name="accountHolder" value={safe(form.accountHolder)}
            onChange={handleChange} required error={!!errors.accountHolder} helperText={errors.accountHolder ? "Required" : ""} />
          <TextField label="Bank Name" name="bankName" value={safe(form.bankName)}
            onChange={handleChange} required error={!!errors.bankName} helperText={errors.bankName ? "Required" : ""} />
          <TextField label="IFSC Code" name="ifsc" value={safe(form.ifsc)}
            onChange={handleChange} required error={!!errors.ifsc} helperText={errors.ifsc ? "Required" : ""} />
          <TextField label="Business Contact Person (if different)" name="businessContactName" value={safe(form.businessContactName)} onChange={handleChange} />
          <TextField label="Business Contact Number (if different)" name="businessContact" value={safe(form.businessContact)} onChange={handleChange} />
          <TextField label="Emergency/Alternate Number" name="emergencyContact" value={safe(form.emergencyContact)} onChange={handleChange} />
          <InputLabel>Digital Signature (optional)</InputLabel>
          <input type="file" accept={fileTypes} onChange={e => handleFile(e, "digitalSignature")} />
          {files.digitalSignature instanceof File && (
            <Typography variant="caption" color="primary">
              {files.digitalSignature.name}
            </Typography>
          )}
          <Typography color="error" variant="caption">{fileErrors.digitalSignature}</Typography>
        </Stack>
      );
    case 4:
      return (
        <Stack spacing={2}>
          <Typography>
            I confirm all the above documents and details are valid and agree to the platform’s terms and local laws.
          </Typography>
          <FormControlLabel
            control={
              <Checkbox checked={!!form.declarationAccepted} name="declarationAccepted" onChange={handleChange} required />
            }
            label="I accept the Terms of Service, Privacy Policy, and declare all information provided is true."
          />
          {errors.declarationAccepted && (
            <Typography color="error" variant="caption">You must accept the declaration to proceed.</Typography>
          )}
        </Stack>
      );
    default:
      return null;
  }
});

// ===== Main Component =====
export default function PharmacyRegistrationStepper() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ ...initialForm });
  const [files, setFiles] = useState({});
  const [fileErrors, setFileErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [errors, setErrors] = useState({});

  const safe = v => typeof v === "string" ? v : "";

  // Input handlers
  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({
      ...f,
      [name]: type === "checkbox" ? checked : value || ""
    }));
    setErrors(er => ({ ...er, [name]: undefined }));
  };

  // Timings logic
  const handleTimingChange = (name, value) => {
    setForm(f => ({
      ...f,
      [name]: value || "",
      ...(name === "open24" && value
        ? {
            timingFromHour: "",
            timingFromMinute: "",
            timingFromAmPm: "",
            timingToHour: "",
            timingToMinute: "",
            timingToAmPm: "",
          }
        : {})
    }));
    setErrors(er => ({ ...er, pharmacyTimings: undefined }));
  };

  // File upload logic
  const handleFile = (e, key) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "application/pdf"].includes(file.type)) {
      setFileErrors(f => ({ ...f, [key]: "Invalid file type" }));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setFileErrors(f => ({ ...f, [key]: "Max 2MB allowed" }));
      return;
    }
    setFileErrors(f => ({ ...f, [key]: undefined }));
    setFiles(f => ({ ...f, [key]: file }));
  };

  // Validation
  function validateStep() {
    let tempErr = {};
    if (step === 0) {
      if (!form.name) tempErr.name = true;
      if (!form.ownerName) tempErr.ownerName = true;
      if (!form.city) tempErr.city = true;
      if (!form.area) tempErr.area = true;
      if (!form.address) tempErr.address = true;
      if (!form.contact || !/^\d{10}$/.test(form.contact)) tempErr.contact = true;
      if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) tempErr.email = true;
      if (!form.password || form.password.length < 6) tempErr.password = true;
      if (!form.pin || !/^\d{4}$/.test(form.pin) || form.pin === form.contact) tempErr.pin = true;
      if (
        !form.open24 && (
          !form.timingFromHour ||
          !form.timingFromMinute ||
          !form.timingFromAmPm ||
          !form.timingToHour ||
          !form.timingToMinute ||
          !form.timingToAmPm
        )
      ) tempErr.pharmacyTimings = true;
    }
    if (step === 1) {
      if (!form.qualification) tempErr.qualification = true;
      if (!form.stateCouncilReg) tempErr.stateCouncilReg = true;
      if (!form.drugLicenseRetail) tempErr.drugLicenseRetail = true;
      if (!form.gstin) tempErr.gstin = true;
      if (!files.qualificationCert) tempErr.qualificationCert = true;
      if (!files.councilCert) tempErr.councilCert = true;
      if (!files.retailLicense) tempErr.retailLicense = true;
      if (!files.gstCert) tempErr.gstCert = true;
    }
    if (step === 2) {
      if (!files.identityProof) tempErr.identityProof = true;
      if (!files.addressProof) tempErr.addressProof = true;
      if (!files.photo) tempErr.photo = true;
    }
    if (step === 3) {
      if (!form.bankAccount) tempErr.bankAccount = true;
      if (!form.accountHolder) tempErr.accountHolder = true;
      if (!form.bankName) tempErr.bankName = true;
      if (!form.ifsc) tempErr.ifsc = true;
    }
    if (step === 4) {
      if (!form.declarationAccepted) tempErr.declarationAccepted = true;
    }
    setErrors(tempErr);
    return Object.keys(tempErr).length > 0 ? "Please fill highlighted fields correctly!" : "";
  }

  // Navigation/Submission: All handled in form's onSubmit
  const handleStepSubmit = async (e) => {
  if (e) e.preventDefault();

  const errMsg = validateStep();
  if (errMsg) {
    setMsg(errMsg);
    return;
  }

  // Go to next step
  if (step < steps.length - 1) {
    // --- CLEAR FILES OF NEXT STEP ---
    setFiles(f => {
      const newFiles = { ...f };
      if (step + 1 === 1) {
        // Step 1: clear all doc files
        Object.keys(requiredDocs).concat(Object.keys(optionalDocs)).forEach(k => { delete newFiles[k]; });
      }
      if (step + 1 === 2) {
        // Step 2: clear all identity files
        ["identityProof", "addressProof", "photo"].forEach(k => { delete newFiles[k]; });
      }
      if (step + 1 === 3) {
        // Step 3: clear digital signature
        delete newFiles["digitalSignature"];
      }
      return newFiles;
    });
    setStep(s => s + 1);
    return;
  }

    // Final submit
    setLoading(true);
    try {
      const fd = new FormData();
      Object.keys(form).forEach(k => fd.append(k, form[k] || ""));
      fd.set("pharmacyTimings", computeTimings(form)); // Required for backend!
      if (form.lat && form.lng) {
  fd.append("lat", form.lat);
  fd.append("lng", form.lng);
  fd.append("locationFormatted", form.formattedLocation || "");
}

      // Append all file fields at once
      Object.keys(files).forEach(k => {
        if (files[k]) fd.append(k, files[k]);
      });

      // Validate: Ensure all required files present
      ["qualificationCert", "councilCert", "retailLicense", "gstCert", "identityProof", "addressProof", "photo"].forEach(f => {
        if (!files[f]) {
          alert(`You must upload: ${f.replace(/([A-Z])/g, " $1")}`);
          throw new Error("Missing file: " + f);
        }
      });

      // Debug: Print all form data before sending
      console.log("FormData about to send:");
      for (let [key, value] of fd.entries()) {
        if (value instanceof File) {
          console.log(key, "(file):", value.name);
        } else {
          console.log(key, value);
        }
      }
      setMsg("");
      await axios.post(`${API_BASE_URL}/api/pharmacy/register`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      setMsg("Registration submitted! Await admin approval.");
      // Only reset form and files HERE (on success)
      setForm({ ...initialForm });
      setFiles({});
      setStep(0);
    } catch (err) {
      // Do NOT reset the form here
      if (err.response?.data?.fieldsMissing) {
        const missing = err.response.data.fieldsMissing;
        let newErrors = { ...errors };
        missing.forEach(f => newErrors[f] = true);
        setErrors(newErrors);
        setMsg(
          "Please fill the highlighted fields: " +
          missing.map(f => f.replace(/([A-Z])/g, ' $1')).join(", ")
        );
      } else {
        setMsg(err.response?.data?.message || "Registration failed. Check your details!");
      }
    }
    setLoading(false);
  };

  // Go back a step
  const handleBack = () => {
    // Clear ONLY file fields of the current step when going back to it (avoid file "leakage")
    setFiles(f => {
      const newFiles = { ...f };
      if (step === 1) {
        Object.keys(requiredDocs).concat(Object.keys(optionalDocs)).forEach(k => { delete newFiles[k]; });
      }
      if (step === 2) {
        ["identityProof", "addressProof", "photo"].forEach(k => { delete newFiles[k]; });
      }
      if (step === 3) {
        delete newFiles["digitalSignature"];
      }
      return newFiles;
    });
    setStep(s => s - 1);
  };

  // ===== RENDER =====
  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: { xs: 360, sm: 450, md: 550 },
        mx: "auto",
        mt: 3,
        p: { xs: 1.5, sm: 2, md: 3 },
        pb: { xs: 8, md: 12 },
        borderRadius: 4,
        bgcolor: "#fff",
        boxShadow: 4,
        minHeight: { xs: "100vh", md: "90vh" }
      }}
    >
      <Typography
        variant="h5"
        sx={{
          mb: 3,
          fontWeight: 900,
          color: "#13C0A2",
          textAlign: "center",
          fontSize: { xs: 20, sm: 24 }
        }}
      >
        Pharmacy Registration
      </Typography>
      <Box
        sx={{
          width: "100%",
          overflowX: "auto",
          mb: 2,
          pb: 1,
          // Hide horizontal scrollbar (optional)
          "&::-webkit-scrollbar": { display: "none" }
        }}
      >
        <Stepper
          activeStep={step}
          alternativeLabel
          sx={{
            minWidth: 370, // ensures min width for step dots/badges
            width: "100%",
            flexWrap: "nowrap"
          }}
        >
          {steps.map(label => (
            <Step key={label}>
              <StepLabel
                sx={{
                  fontSize: { xs: 12, sm: 14 },
                  ".MuiStepLabel-label": { fontSize: { xs: 10, sm: 14 } }
                }}
              >
                {label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>
      <form onSubmit={handleStepSubmit} autoComplete="off">
        <Box sx={{ mt: 3 }}>
          <StepContent
            step={step}
            form={form}
            errors={errors}
            handleChange={handleChange}
            handleFile={handleFile}
            handleTimingChange={handleTimingChange}
            fileErrors={fileErrors}
            requiredDocs={requiredDocs}
            optionalDocs={optionalDocs}
            selectMenuProps={selectMenuProps}
            hours={hours}
            minutes={minutes}
            safe={safe}
            files={files}
          />
          {msg && (
            <Snackbar open={!!msg} autoHideDuration={3200} onClose={() => setMsg("")}>
              <Alert onClose={() => setMsg("")} severity={getMsgSeverity(msg)}>
                {msg}
              </Alert>
            </Snackbar>
          )}
          <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
            {step > 0 && step < 5 && (
              <Button onClick={handleBack} variant="outlined" type="button">
                Back
              </Button>
            )}
            {step < 4 && (
              <Button variant="contained" type="submit">
                Next
              </Button>
            )}
            {step === 4 && (
              <Button
                type="submit"
                fullWidth
                variant="contained"
                color="primary"
                disabled={loading}
                sx={{ fontWeight: 700 }}
              >
                {loading ? "Submitting..." : "Submit Registration"}
              </Button>
            )}
          </Stack>
        </Box>
      </form>
    </Box>
  );
}
