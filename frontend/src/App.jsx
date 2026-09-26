import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { CompanyProvider } from './context/CompanyContext';
import AppRoutes from './routes/AppRoutes';
import ErrorBoundary from './components/common/ErrorBoundary';

export default function App() {
  return (
    <ThemeProvider>
      <CssBaseline />
      <BrowserRouter>
        <ErrorBoundary>
          <AuthProvider>
            <CompanyProvider>
              <AppRoutes />
            </CompanyProvider>
          </AuthProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </ThemeProvider>
  );
}
