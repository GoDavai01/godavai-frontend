// src/components/fields/CompositionAutocomplete.jsx
import React, { useEffect, useMemo, useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import { fetchCompositionSuggest, fetchPrefillByCompositionId } from "../../api/suggest";

// --- small helper to strip brand prefixes & dosage-form suffixes ---
function normalizeCompositionName(str = "") {
  let t = String(str).trim();

  // remove common dosage form tails
  t = t.replace(
    /\b(Tablet|Tablets|Capsule|Capsules|Syrup|Suspension|Injection|Gel|Cream|Ointment|Drops|Solution)\b.*$/i,
    ""
  ).trim();

  // remove known brand-like prefixes (heuristic: first capitalized word that isn't the molecule)
  t = t.replace(/^(DavaIndia|Genericart|Cipla|Sun|Alkem|Zydus)\s+/i, "");

  // collapse multiple spaces
  t = t.replace(/\s{2,}/g, " ").trim();

  return t || str;
}

export default function CompositionAutocomplete({
  label = "Composition",
  value,
  onValueChange,
  onPrefill,   // (prefillObj) => void
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState(value || "");
  const deb = useDebouncedValue(input, 250);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  // keep controlled value in sync from parent
  useEffect(() => setInput(value || ""), [value]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!open || deb.trim().length < 2) {
        setOptions([]);
        return;
      }
      setLoading(true);
      try {
        const rows = await fetchCompositionSuggest(deb, 10);
        if (!ignore) setOptions(rows);
      } finally {
        setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [open, deb]);

  const noOpt = useMemo(
    () => [{ id: "__manual__", name: `Add "${input}"` }],
    [input]
  );

  return (
    <Autocomplete
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      options={options.length ? options : noOpt}
      getOptionLabel={(o) => normalizeCompositionName(o?.name || "")}
      filterOptions={(x) => {
        // de-duplicate after normalization
        const seen = new Set();
        return x.filter((o) => {
          const norm = normalizeCompositionName(o?.name || "");
          if (seen.has(norm.toLowerCase())) return false;
          seen.add(norm.toLowerCase());
          return true;
        });
      }}
      loading={loading}
      disabled={disabled}
      // fully control the textbox
      freeSolo
      inputValue={input}
      onInputChange={(_, v) => setInput(v ?? "")}
      clearOnBlur={false}
      selectOnFocus
      handleHomeEndKeys
      onChange={async (_e, option) => {
        if (!option) return;
        if (typeof option === "string") {
          onValueChange?.(normalizeCompositionName(option));
          onPrefill?.({ productKind: "generic", name: normalizeCompositionName(option) });
          return;
        }
        if (option.id === "__manual__") {
          onValueChange?.(normalizeCompositionName(input));
          onPrefill?.({ productKind: "generic", name: normalizeCompositionName(input) });
          return;
        }
        const norm = normalizeCompositionName(option.name);
        onValueChange?.(norm);
        const prefill = await fetchPrefillByCompositionId(option.id);
        onPrefill?.({ ...prefill, compositionId: option.id });
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={16} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}
