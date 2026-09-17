import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';

export default function EmptyState({
  title = 'No records found',
  description = 'There are currently no items to display in this section.',
  actionLabel,
  onAction,
  icon: Icon = InboxOutlinedIcon,
}) {
  return (
    <Box
      sx={{
        py: 8,
        px: 3,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 2,
        border: '1px dashed #cbd5e1',
        my: 2,
      }}
    >
      <Box
        sx={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          backgroundColor: '#f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'text.secondary',
          mb: 2,
        }}
      >
        <Icon sx={{ fontSize: 28 }} />
      </Box>

      <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary', mb: 0.5 }}>
        {title}
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420, mb: actionLabel ? 3 : 0 }}>
        {description}
      </Typography>

      {actionLabel && (
        <Button variant="contained" color="primary" onClick={onAction} sx={{ mt: 1 }}>
          {actionLabel}
        </Button>
      )}
    </Box>
  );
}
