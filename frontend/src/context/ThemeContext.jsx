import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { getAppTheme } from '../theme';

const ThemeContext = createContext({
  mode: 'light',
  toggleTheme: () => {},
});

export const useThemeContext = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const [mode, setMode] = useState(() => {
    try {
      const stored = localStorage.getItem('icorp_theme_mode');
      return stored === 'dark' || stored === 'light' ? stored : 'light';
    } catch {
      return 'light';
    }
  });

  const toggleTheme = () => {
    setMode((prev) => {
      const newMode = prev === 'light' ? 'dark' : 'light';
      try {
        localStorage.setItem('icorp_theme_mode', newMode);
      } catch (e) {
        console.error('Failed to save theme to localStorage');
      }
      return newMode;
    });
  };

  const theme = useMemo(() => getAppTheme(mode), [mode]);

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme }}>
      <MuiThemeProvider theme={theme}>{children}</MuiThemeProvider>
    </ThemeContext.Provider>
  );
};
