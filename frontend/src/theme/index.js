import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1e3a8a', // Deep corporate navy
      light: '#3b82f6',
      dark: '#1e293b',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#0284c7', // Professional ocean blue
      light: '#38bdf8',
      dark: '#0369a1',
      contrastText: '#ffffff',
    },
    background: {
      default: '#f8fafc', // Clean slate-50 background
      paper: '#ffffff',
      subtle: '#f1f5f9',
    },
    text: {
      primary: '#0f172a', // Slate-900
      secondary: '#64748b', // Slate-500
      disabled: '#94a3b8',
    },
    divider: '#e2e8f0', // Slate-200
    success: {
      main: '#10b981',
      light: '#d1fae5',
      dark: '#059669',
    },
    warning: {
      main: '#f59e0b',
      light: '#fef3c7',
      dark: '#d97706',
    },
    error: {
      main: '#ef4444',
      light: '#fee2e2',
      dark: '#b91c1c',
    },
    info: {
      main: '#3b82f6',
      light: '#dbeafe',
      dark: '#1d4ed8',
    },
  },
  typography: {
    fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    h1: {
      fontWeight: 700,
      fontSize: '2rem',
      letterSpacing: '-0.02em',
    },
    h2: {
      fontWeight: 700,
      fontSize: '1.75rem',
      letterSpacing: '-0.02em',
    },
    h3: {
      fontWeight: 600,
      fontSize: '1.5rem',
      letterSpacing: '-0.01em',
    },
    h4: {
      fontWeight: 600,
      fontSize: '1.25rem',
      letterSpacing: '-0.01em',
    },
    h5: {
      fontWeight: 600,
      fontSize: '1.1rem',
    },
    h6: {
      fontWeight: 600,
      fontSize: '0.95rem',
    },
    subtitle1: {
      fontSize: '0.925rem',
      fontWeight: 500,
    },
    subtitle2: {
      fontSize: '0.825rem',
      fontWeight: 500,
      color: '#64748b',
    },
    body1: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
    },
    body2: {
      fontSize: '0.8125rem',
      lineHeight: 1.45,
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
      fontSize: '0.875rem',
    },
    caption: {
      fontSize: '0.75rem',
      color: '#64748b',
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#f8fafc',
          color: '#0f172a',
          margin: 0,
          padding: 0,
          fontFeatureSettings: '"cv02", "cv03", "cv04", "cv11"',
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid #e2e8f0',
        },
      },
    },
    MuiCard: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          border: '1px solid #e2e8f0',
          borderRadius: 10,
          backgroundColor: '#ffffff',
          transition: 'box-shadow 0.2s ease-in-out, border-color 0.2s ease-in-out',
          '&:hover': {
            borderColor: '#cbd5e1',
            boxShadow: '0 4px 12px rgba(15, 23, 42, 0.04)',
          },
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '6px 16px',
          fontWeight: 600,
        },
        containedPrimary: {
          backgroundColor: '#1e3a8a',
          '&:hover': {
            backgroundColor: '#172554',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: '#f1f5f9',
          padding: '12px 16px',
          fontSize: '0.875rem',
        },
        head: {
          fontWeight: 600,
          backgroundColor: '#f8fafc',
          color: '#475569',
          borderBottom: '1px solid #e2e8f0',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
          borderRadius: 6,
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          marginBottom: 2,
          '&.Mui-selected': {
            backgroundColor: '#eff6ff',
            color: '#1d4ed8',
            fontWeight: 600,
            '&:hover': {
              backgroundColor: '#dbeafe',
            },
            '& .MuiListItemIcon-root': {
              color: '#1d4ed8',
            },
          },
          '&:hover': {
            backgroundColor: '#f1f5f9',
          },
        },
      },
    },
  },
});

export default theme;
