// src/components/fields/BrandAutocomplete.jsx
import React, { useEffect, useMemo, useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import { fetchBrandSuggest, fetchPrefillByBrandId } from "../../api/suggest";

export default function BrandAutocomplete({
  label = "Brand",
  value,
  onValueChange,
  onPrefill,     // (prefillObj) => void
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState(value || "");
  const deb = useDebouncedValue(input, 250);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  // keep controlled value in sync
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
        const rows = await fetchBrandSuggest(deb, 10);
        if (!ignore) setOptions(rows);
      } finally {
        setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [open, deb]);

  const noOpt = useMemo(() => [{ id: "__manual__", name: `Add "${input}"` }], [input]);

  return (
    <Autocomplete
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      options={options.length ? options : noOpt}
      getOptionLabel={(o) => (o?.name || "")}
      filterOptions={(x) => x} // server-side filtering
      loading={loading}
      disabled={disabled}
      value={null} // we control TextField value ourselves
      onChange={async (_e, option) => {
        if (!option) return;
        if (option.id === "__manual__") {
          onValueChange?.(input);
          onPrefill?.({ productKind: "branded", name: input }); // minimal help
          return;
        }
        onValueChange?.(option.name);
        // ask server for prefill
        const prefill = await fetchPrefillByBrandId(option.id);
        onPrefill?.({ ...prefill, brandId: option.id });
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          value={input}
          onChange={(e) => setInput(e.target.value)}
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
