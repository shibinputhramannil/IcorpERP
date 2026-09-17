import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  Stack,
  Link,
  CircularProgress,
} from '@mui/material';
import LockResetOutlinedIcon from '@mui/icons-material/LockResetOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import { Link as RouterLink } from 'react-router-dom';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const validate = () => {
    if (!email.trim()) {
      setError('Email address is required.');
      return false;
    }
    // Simple email regex
    const re = /\S+@\S+\.\S+/;
    if (!re.test(email.trim())) {
      setError('Please enter a valid email address.');
      return false;
    }
    setError('');
    return true;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);

    // Simulate recovery dispatch (since backend has not implemented custom password-reset endpoint yet)
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
    }, 800);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
        p: 2,
      }}
    >
      <Card
        sx={{
          width: '100%',
          maxWidth: 440,
          p: { xs: 2.5, sm: 4 },
          boxShadow: '0 8px 30px rgba(15, 23, 42, 0.08)',
          border: '1px solid #e2e8f0',
          borderRadius: 3,
        }}
      >
        <CardContent sx={{ p: 0 }}>
          {isSubmitted ? (
            <Box sx={{ textAlign: 'center' }}>
              <Box
                sx={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  backgroundColor: '#d1fae5',
                  color: '#059669',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 2,
                }}
              >
                <CheckCircleOutlinedIcon sx={{ fontSize: 32 }} />
              </Box>

              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                Check Your Inbox
              </Typography>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                If an active account is associated with <strong>{email}</strong>, instructions to reset your password have been sent.
              </Typography>

              <Button
                component={RouterLink}
                to="/login"
                variant="contained"
                color="primary"
                fullWidth
                startIcon={<ArrowBackIcon />}
                sx={{ py: 1.2, fontWeight: 600 }}
              >
                Return to Login
              </Button>
            </Box>
          ) : (
            <>
              {/* Header */}
              <Box sx={{ textAlign: 'center', mb: 3.5 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2.5,
                    backgroundColor: 'primary.main',
                    color: '#ffffff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 2,
                    boxShadow: '0 4px 10px rgba(30, 58, 138, 0.25)',
                  }}
                >
                  <LockResetOutlinedIcon sx={{ fontSize: 26 }} />
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary' }}>
                  Reset Password
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Enter your corporate email address to receive password recovery instructions.
                </Typography>
              </Box>

              {error && (
                <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }} onClose={() => setError('')}>
                  {error}
                </Alert>
              )}

              <Box component="form" onSubmit={handleSubmit} noValidate>
                <Stack spacing={2.5}>
                  <TextField
                    label="Corporate Email Address"
                    variant="outlined"
                    type="email"
                    fullWidth
                    autoFocus
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError('');
                    }}
                    error={Boolean(error)}
                    helperText={error}
                    disabled={isSubmitting}
                    InputLabelProps={{ shrink: true }}
                    placeholder="e.g. employee@icorp.com"
                  />

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
                      'Send Recovery Instructions'
                    )}
                  </Button>

                  <Box sx={{ textAlign: 'center', pt: 1 }}>
                    <Link
                      component={RouterLink}
                      to="/login"
                      variant="body2"
                      underline="hover"
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                        fontWeight: 600,
                        color: 'text.secondary',
                        '&:hover': { color: 'primary.main' },
                      }}
                    >
                      <ArrowBackIcon fontSize="small" />
                      Back to Sign In
                    </Link>
                  </Box>
                </Stack>
              </Box>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
