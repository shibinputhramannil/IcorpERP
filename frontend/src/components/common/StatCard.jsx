import React from 'react';
import { Card, CardContent, Typography, Box, Stack } from '@mui/material';
import { alpha } from '@mui/material/styles';

export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'primary.main',
  trend,
  trendType = 'up', // 'up' | 'down' | 'neutral'
}) {
  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        p: 0.5,
      }}
    >
      <CardContent sx={{ pb: '16px !important' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {title}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5, color: 'text.primary' }}>
              {value}
            </Typography>
          </Box>
          {Icon && (
            <Box
              sx={(theme) => {
                let resolvedColor = color;
                if (color === 'primary.main') resolvedColor = theme.palette.primary.main;
                else if (color === 'secondary.main') resolvedColor = theme.palette.secondary.main;
                else if (color === 'success.main') resolvedColor = theme.palette.success.main;
                else if (color === 'warning.main') resolvedColor = theme.palette.warning.main;
                else if (color === 'error.main') resolvedColor = theme.palette.error.main;
                else if (color === 'info.main') resolvedColor = theme.palette.info.main;
                else if (color === 'text.primary') resolvedColor = theme.palette.text.primary;
                else if (color === 'text.secondary') resolvedColor = theme.palette.text.secondary;

                return {
                  width: 44,
                  height: 44,
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: (() => {
                    try { return alpha(resolvedColor, 0.08); } 
                    catch(e) { return 'transparent'; }
                  })(),
                  color: resolvedColor,
                };
              }}
            >
              <Icon fontSize="medium" />
            </Box>
          )}
        </Stack>

        {(subtitle || trend) && (
          <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            {trend && (
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  color: trendType === 'up' ? 'success.main' : trendType === 'down' ? 'error.main' : 'text.secondary',
                }}
              >
                {trend}
              </Typography>
            )}
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
