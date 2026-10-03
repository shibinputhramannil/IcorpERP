import React, { useState } from 'react';
import { 
  Box, 
  Button, 
  TextField, 
  Typography, 
  Container, 
  Paper, 
  Link, 
  Stack,
  Alert,
  CircularProgress
} from '@mui/material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import api from '../services/api';
import { extractErrorMessage } from '../utils/errorUtils';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    company_name: '',
    email: '',
    password: ''
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await api.post('/auth/register/', formData);
      // Auto-login after successful registration
      const loginRes = await api.post('/auth/login/', {
        username: formData.email, // using email as username via our custom token view
        password: formData.password
      });
      
      localStorage.setItem('access_token', loginRes.data.access);
      localStorage.setItem('refresh_token', loginRes.data.refresh);
      window.location.href = '/dashboard';
    } catch (err) {
      console.error('Registration failed:', err);
      setError(extractErrorMessage(err) || 'Registration failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs" sx={{ height: '100vh', display: 'flex', alignItems: 'center' }}>
      <Paper elevation={4} sx={{ p: 4, width: '100%', borderRadius: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <img 
            src="/src/assets/branding/transt-logo-transparent.svg" 
            alt="transt" 
            style={{ width: '100%', maxWidth: '180px', height: 'auto', marginBottom: '8px', display: 'inline-block' }} 
          />
          <Typography component="h1" variant="h5" sx={{ mt: 2, fontWeight: 700 }}>
            Create an Account
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 3 }}>
            Sign up to start using transt ERP
          </Typography>

          {error && <Alert severity="error" sx={{ width: '100%', mb: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={2}>
                <TextField
                  name="first_name"
                  label="First Name"
                  fullWidth
                  required
                  value={formData.first_name}
                  onChange={handleChange}
                />
                <TextField
                  name="last_name"
                  label="Last Name"
                  fullWidth
                  required
                  value={formData.last_name}
                  onChange={handleChange}
                />
              </Stack>

              <TextField
                name="company_name"
                label="Company Workspace Name"
                fullWidth
                required
                placeholder="e.g. Acme Corp"
                value={formData.company_name}
                onChange={handleChange}
              />

              <TextField
                name="email"
                label="Email Address"
                type="email"
                fullWidth
                required
                value={formData.email}
                onChange={handleChange}
              />

              <TextField
                name="password"
                label="Password"
                type="password"
                fullWidth
                required
                value={formData.password}
                onChange={handleChange}
              />
            </Stack>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              sx={{ mt: 4, mb: 2, py: 1.5, fontWeight: 700 }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign Up'}
            </Button>

            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Link component={RouterLink} to="/login" variant="body2" sx={{ fontWeight: 600 }}>
                Already have an account? Sign In
              </Link>
            </Box>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
}
