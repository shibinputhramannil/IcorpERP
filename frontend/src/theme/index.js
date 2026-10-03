import { createTheme } from '@mui/material/styles';

export const getAppTheme = (mode) => {
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: isDark ? '#4fa381' : '#2f604b',
        light: isDark ? '#7bc4a3' : '#4a856a',
        dark: isDark ? '#3b8567' : '#1f4534',
        contrastText: '#ffffff',
      },
      secondary: {
        main: isDark ? '#9dbfae' : '#577868',
        light: isDark ? '#b8d6c7' : '#9dbfae',
        dark: isDark ? '#577868' : '#456153',
        contrastText: '#ffffff',
      },
      background: {
        default: isDark ? '#141816' : '#faf9f6',
        paper: isDark ? '#1d2320' : '#ffffff',
        subtle: isDark ? '#2a332f' : '#f0eee8',
      },
      text: {
        primary: isDark ? '#faf9f6' : '#18211d',
        secondary: isDark ? '#87948e' : '#5d6e66',
        disabled: isDark ? '#5d6e66' : '#87948e',
      },
      divider: isDark ? '#2a332f' : '#e6e4df',
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
      subtitle2: { fontSize: '0.825rem', fontWeight: 500, color: isDark ? '#87948e' : '#5d6e66' },
      body1: { fontSize: '0.875rem', lineHeight: 1.5 },
      body2: { fontSize: '0.8125rem', lineHeight: 1.45 },
      button: { textTransform: 'none', fontWeight: 600, fontSize: '0.875rem' },
      caption: { fontSize: '0.75rem', color: isDark ? '#87948e' : '#5d6e66' },
    },
    shape: {
      borderRadius: 8,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: isDark ? '#141816' : '#faf9f6',
            color: isDark ? '#faf9f6' : '#18211d',
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
            border: `1px solid ${isDark ? '#2a332f' : '#e6e4df'}`,
          },
        },
      },
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            border: `1px solid ${isDark ? '#2a332f' : '#e6e4df'}`,
            borderRadius: 10,
            backgroundColor: isDark ? '#1d2320' : '#ffffff',
            transition: 'box-shadow 0.2s ease-in-out, border-color 0.2s ease-in-out',
            '&:hover': {
              borderColor: isDark ? '#3b4742' : '#d4d2cc',
              boxShadow: isDark ? '0 4px 12px rgba(0, 0, 0, 0.5)' : '0 4px 12px rgba(24, 33, 29, 0.04)',
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
            backgroundColor: isDark ? '#4fa381' : '#2f604b',
            '&:hover': {
              backgroundColor: isDark ? '#3b8567' : '#1c362a',
            },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderColor: isDark ? '#2a332f' : '#f0eee8',
            padding: '12px 16px',
            fontSize: '0.875rem',
            color: isDark ? '#e6e4df' : '#18211d',
          },
          head: {
            fontWeight: 600,
            backgroundColor: isDark ? '#1d2320' : '#faf9f6',
            color: isDark ? '#d4d2cc' : '#3b4742',
            borderBottom: `1px solid ${isDark ? '#2a332f' : '#e6e4df'}`,
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
              backgroundColor: isDark ? '#264234' : '#eaf2ee',
              color: isDark ? '#4fa381' : '#224a38',
              fontWeight: 600,
              '&:hover': {
                backgroundColor: isDark ? '#20362b' : '#dee8e3',
              },
              '& .MuiListItemIcon-root': {
                color: isDark ? '#4fa381' : '#224a38',
              },
            },
            '&:hover': {
              backgroundColor: isDark ? '#2a332f' : '#f0eee8',
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
