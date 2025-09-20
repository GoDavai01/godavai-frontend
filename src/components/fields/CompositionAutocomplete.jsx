// src/components/fields/CompositionAutocomplete.jsx
import React, { useEffect, useMemo, useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import { fetchCompositionSuggest, fetchPrefillByCompositionId } from "../../api/suggest";

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
      getOptionLabel={(o) => o?.name || ""}
      filterOptions={(x) => x}
      loading={loading}
      disabled={disabled}
      // --- IMPORTANT: fully control the textbox to prevent clearing ---
      freeSolo
      inputValue={input}
      onInputChange={(_, v) => setInput(v ?? "")}
      clearOnBlur={false}
      selectOnFocus
      handleHomeEndKeys
      onChange={async (_e, option) => {
        if (!option) return;
        if (typeof option === "string") {
          onValueChange?.(option);
          onPrefill?.({ productKind: "generic", name: option });
          return;
        }
        if (option.id === "__manual__") {
          onValueChange?.(input);
          onPrefill?.({ productKind: "generic", name: input });
          return;
        }
        onValueChange?.(option.name);
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
