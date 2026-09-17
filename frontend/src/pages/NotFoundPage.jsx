import React from 'react';
import { Box, Typography, Button, Container } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        <Typography
          variant="h1"
          sx={{
            fontSize: '6rem',
            fontWeight: 800,
            color: 'primary.main',
            lineHeight: 1,
            mb: 2,
          }}
        >
          404
        </Typography>

        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
          Page Not Found
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 4, maxWidth: 400 }}>
          The ERP module or resource you are looking for might have been moved, renamed, or is temporarily unavailable.
        </Typography>

        <Button
          variant="contained"
          color="primary"
          startIcon={<HomeOutlinedIcon />}
          onClick={() => navigate('/dashboard')}
        >
          Back to Dashboard
        </Button>
      </Box>
    </Container>
  );
}
