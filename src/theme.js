import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    primary: {
      main: "#0C5A3E",
      light: "#0E7A4F",
      dark: "#064E3B",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#00D97E",
      light: "#00FFB2",
      dark: "#059669",
    },
    background: {
      default: "#F2F7F4",
      paper: "#ffffff",
    },
    info: {
      main: "#3B82F6",
    },
    success: {
      main: "#00D97E",
    },
    text: {
      primary: "#0B1F16",
      secondary: "#1C3327",
      disabled: "#94A3B8",
    },
  },
  typography: {
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    h1: { fontFamily: "'Sora', system-ui, sans-serif", fontWeight: 900, letterSpacing: "-0.02em" },
    h2: { fontFamily: "'Sora', system-ui, sans-serif", fontWeight: 800, letterSpacing: "-0.02em" },
    h3: { fontFamily: "'Sora', system-ui, sans-serif", fontWeight: 800, letterSpacing: "-0.01em" },
    h4: { fontFamily: "'Sora', system-ui, sans-serif", fontWeight: 700, letterSpacing: "-0.01em" },
    h5: { fontFamily: "'Sora', system-ui, sans-serif", fontWeight: 700 },
    h6: { fontFamily: "'Sora', system-ui, sans-serif", fontWeight: 700 },
    button: { fontWeight: 700, textTransform: "none", letterSpacing: "-0.01em" },
    body1: { fontWeight: 500, lineHeight: 1.6 },
    body2: { fontWeight: 500, lineHeight: 1.5 },
  },
  shape: {
    borderRadius: 16,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 700,
          textTransform: "none",
          boxShadow: "none",
          "&:hover": {
            boxShadow: "0 4px 16px rgba(12,90,62,0.20)",
          },
        },
        containedPrimary: {
          background: "linear-gradient(135deg, #0C5A3E 0%, #0E7A4F 100%)",
          "&:hover": {
            background: "linear-gradient(135deg, #0A4631 0%, #0C5A3E 100%)",
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 22,
          boxShadow: "0 4px 24px rgba(12,90,62,0.06), 0 1px 4px rgba(0,0,0,0.03)",
          border: "1px solid rgba(12,90,62,0.06)",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 16,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 600,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 14,
          },
        },
      },
    },
  },
});

export default theme;
