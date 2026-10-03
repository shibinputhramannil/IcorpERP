import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  IconButton,
  InputAdornment,
  Alert,
  Snackbar,
  Stack,
  Link,
  CircularProgress,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Success notification
  const [successOpen, setSuccessOpen] = useState(false);

  // Redirect destination after login (default to /dashboard)
  const from = location.state?.from?.pathname || '/dashboard';

  const validate = () => {
    const newErrors = {};
    if (!username.trim()) {
      newErrors.username = 'Username or email is required.';
    }
    if (!password) {
      newErrors.password = 'Password is required.';
    } else if (password.length < 4) {
      newErrors.password = 'Password must be at least 4 characters.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await login(username.trim(), password);
      setSuccessOpen(true);
      // Ensure the user clearly sees the success notification before redirecting
      setTimeout(() => {
        const destination = (!from || from === '/login') ? '/dashboard' : from;
        navigate(destination, { replace: true });
      }, 1000);
    } catch (err) {
      setIsSubmitting(false);
      if (err.response?.data) {
        const data = err.response.data;
        if (data.detail) {
          setServerError(data.detail);
        } else if (data.non_field_errors) {
          setServerError(data.non_field_errors.join(' '));
        } else {
          // Format field errors
          const messages = Object.entries(data)
            .map(([field, msg]) => `${field}: ${Array.isArray(msg) ? msg.join(', ') : msg}`)
            .join(' | ');
          setServerError(messages || 'Login failed. Please check your credentials.');
        }
      } else if (err.request) {
        setServerError('Cannot connect to backend server. Please ensure the Django API is running at http://127.0.0.1:8000.');
      } else {
        setServerError('An unexpected error occurred during sign in.');
      }
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'background.subtle',
        p: 2,
      }}
    >
      {/* Header & Branding (Outside Card) */}
      <Box sx={{ textAlign: 'center', mb: 4, width: '100%', maxWidth: 420 }}>
        <img 
          src="/src/assets/branding/transt-logo-transparent.svg" 
          alt="transt" 
          style={{ width: '100%', maxWidth: '200px', height: 'auto', marginBottom: '16px', display: 'inline-block' }} 
        />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Sign in to your enterprise account
        </Typography>
      </Box>

      {/* Login Card */}
      <Card
        sx={{
          width: '100%',
          maxWidth: 420,
          p: { xs: 2.5, sm: 4 },
          boxShadow: '0 8px 30px rgba(15, 23, 42, 0.08)',
          border: 1, borderColor: 'divider',
          borderRadius: 3,
        }}
      >
        <CardContent sx={{ p: 0 }}>
          {/* Server Error Alert */}
          {serverError && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }} onClose={() => setServerError('')}>
              {serverError}
            </Alert>
          )}

          {/* Login Form */}
          <Box component="form" onSubmit={handleSubmit} noValidate>
            <Stack spacing={2.5}>
              <TextField
                label="Username or Email"
                variant="outlined"
                fullWidth
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (errors.username) setErrors((prev) => ({ ...prev, username: '' }));
                }}
                error={Boolean(errors.username)}
                helperText={errors.username}
                disabled={isSubmitting}
                InputLabelProps={{ shrink: true }}
                placeholder="e.g. admin or employee@transt.com"
              />

              <TextField
                label="Password"
                type={showPassword ? 'text' : 'password'}
                variant="outlined"
                fullWidth
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
                }}
                error={Boolean(errors.password)}
                helperText={errors.password}
                disabled={isSubmitting}
                InputLabelProps={{ shrink: true }}
                placeholder="Enter your account password"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        size="small"
                      >
                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              {/* Forgot password link (Strictly NO Remember Me checkbox per instructions) */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 0.5 }}>
                <Link
                  component={RouterLink}
                  to="/forgot-password"
                  variant="body2"
                  underline="hover"
                  sx={{ fontWeight: 600, color: 'primary.main' }}
                >
                  Forgot password?
                </Link>
              </Box>

              <Button
                type="submit"
                variant="contained"
                color="primary"
                size="large"
                fullWidth
                disabled={isSubmitting}
                sx={{
                  py: 1.3,
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  borderRadius: 2,
                }}
              >
                {isSubmitting ? (
                  <CircularProgress size={24} sx={{ color: '#ffffff' }} />
                ) : (
                  'Sign In'
                )}
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      {/* Success Notification */}
      <Snackbar
        open={successOpen}
        autoHideDuration={3000}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" sx={{ width: '100%', fontWeight: 700, fontSize: '0.95rem' }}>
          Login successful! Redirecting to dashboard...
        </Alert>
      </Snackbar>
    </Box>
  );
}
