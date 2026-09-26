import { createTheme } from '@mui/material/styles';

export const getAppTheme = (mode) => {
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: isDark ? '#3b82f6' : '#1e3a8a',
        light: isDark ? '#60a5fa' : '#3b82f6',
        dark: isDark ? '#2563eb' : '#1e293b',
        contrastText: '#ffffff',
      },
      secondary: {
        main: isDark ? '#38bdf8' : '#0284c7',
        light: isDark ? '#7dd3fc' : '#38bdf8',
        dark: isDark ? '#0284c7' : '#0369a1',
        contrastText: '#ffffff',
      },
      background: {
        default: isDark ? '#0f172a' : '#f8fafc',
        paper: isDark ? '#1e293b' : '#ffffff',
        subtle: isDark ? '#334155' : '#f1f5f9',
      },
      text: {
        primary: isDark ? '#f8fafc' : '#0f172a',
        secondary: isDark ? '#94a3b8' : '#64748b',
        disabled: isDark ? '#64748b' : '#94a3b8',
      },
      divider: isDark ? '#334155' : '#e2e8f0',
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
      h1: { fontWeight: 700, fontSize: '2rem', letterSpacing: '-0.02em' },
      h2: { fontWeight: 700, fontSize: '1.75rem', letterSpacing: '-0.02em' },
      h3: { fontWeight: 600, fontSize: '1.5rem', letterSpacing: '-0.01em' },
      h4: { fontWeight: 600, fontSize: '1.25rem', letterSpacing: '-0.01em' },
      h5: { fontWeight: 600, fontSize: '1.1rem' },
      h6: { fontWeight: 600, fontSize: '0.95rem' },
      subtitle1: { fontSize: '0.925rem', fontWeight: 500 },
      subtitle2: { fontSize: '0.825rem', fontWeight: 500, color: isDark ? '#94a3b8' : '#64748b' },
      body1: { fontSize: '0.875rem', lineHeight: 1.5 },
      body2: { fontSize: '0.8125rem', lineHeight: 1.45 },
      button: { textTransform: 'none', fontWeight: 600, fontSize: '0.875rem' },
      caption: { fontSize: '0.75rem', color: isDark ? '#94a3b8' : '#64748b' },
    },
    shape: {
      borderRadius: 8,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: isDark ? '#0f172a' : '#f8fafc',
            color: isDark ? '#f8fafc' : '#0f172a',
            margin: 0,
            padding: 0,
            fontFeatureSettings: '"cv02", "cv03", "cv04", "cv11"',
          },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
          },
        },
      },
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
            borderRadius: 10,
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            transition: 'box-shadow 0.2s ease-in-out, border-color 0.2s ease-in-out',
            '&:hover': {
              borderColor: isDark ? '#475569' : '#cbd5e1',
              boxShadow: isDark ? '0 4px 12px rgba(0, 0, 0, 0.5)' : '0 4px 12px rgba(15, 23, 42, 0.04)',
            },
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 8,
            padding: '6px 16px',
            fontWeight: 600,
          },
          containedPrimary: {
            backgroundColor: isDark ? '#3b82f6' : '#1e3a8a',
            '&:hover': {
              backgroundColor: isDark ? '#2563eb' : '#172554',
            },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderColor: isDark ? '#334155' : '#f1f5f9',
            padding: '12px 16px',
            fontSize: '0.875rem',
            color: isDark ? '#e2e8f0' : '#0f172a',
          },
          head: {
            fontWeight: 600,
            backgroundColor: isDark ? '#1e293b' : '#f8fafc',
            color: isDark ? '#cbd5e1' : '#475569',
            borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
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
              backgroundColor: isDark ? '#1e3a8a' : '#eff6ff',
              color: isDark ? '#60a5fa' : '#1d4ed8',
              fontWeight: 600,
              '&:hover': {
                backgroundColor: isDark ? '#1e40af' : '#dbeafe',
              },
              '& .MuiListItemIcon-root': {
                color: isDark ? '#60a5fa' : '#1d4ed8',
              },
            },
            '&:hover': {
              backgroundColor: isDark ? '#334155' : '#f1f5f9',
            },
          },
        },
      },
    },
  });
};

// Fallback legacy theme to avoid breaking existing imports that use `theme`
export const theme = getAppTheme('light');
export default theme;
