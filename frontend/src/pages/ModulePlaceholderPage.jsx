import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Chip,
  Grid,
  Divider,
} from '@mui/material';
import ConstructionOutlinedIcon from '@mui/icons-material/ConstructionOutlined';
import PageHeader from '../components/common/PageHeader';
import EmptyState from '../components/common/EmptyState';

export default function ModulePlaceholderPage({
  title,
  subtitle,
  category,
  phaseNumber,
  features = [],
  workflowSteps = [],
}) {
  return (
    <Box>
      <PageHeader
        title={title}
        subtitle={subtitle}
        breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: title }]}
      />

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Module Architecture & Roadmap
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Categorized under {category}
                  </Typography>
                </Box>
                <Chip
                  label={`Scheduled for Phase ${phaseNumber}`}
                  size="small"
                  color="info"
                  variant="outlined"
                  sx={{ fontWeight: 600 }}
                />
              </Stack>

              <Divider sx={{ my: 2 }} />

              {/* Workflow visualization if provided */}
              {workflowSteps.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
                    Target Workflow Pipeline
                  </Typography>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    sx={{
                      p: 2,
                      bgcolor: '#f8fafc',
                      borderRadius: 2,
                      border: '1px solid #e2e8f0',
                      overflowX: 'auto',
                    }}
                  >
                    {workflowSteps.map((step, idx) => (
                      <React.Fragment key={step}>
                        <Chip
                          label={step}
                          size="small"
                          sx={{
                            fontWeight: 600,
                            bgcolor: '#ffffff',
                            border: '1px solid #cbd5e1',
                          }}
                        />
                        {idx < workflowSteps.length - 1 && (
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                            →
                          </Typography>
                        )}
                      </React.Fragment>
                    ))}
                  </Stack>
                </Box>
              )}

              <EmptyState
                icon={ConstructionOutlinedIcon}
                title={`${title} Module Scaffolding Ready`}
                description="Frontend architectural boundaries and route handlers have been initialized. Once backend models and endpoints are verified in later phases, full interactive CRUD workflows will activate."
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
                Planned Capabilities
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Components prepared in UI architecture:
              </Typography>

              <Stack spacing={1}>
                {features.map((feature) => (
                  <Box
                    key={feature}
                    sx={{
                      p: 1.5,
                      borderRadius: 1.5,
                      bgcolor: '#f8fafc',
                      border: '1px solid #f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    <Box
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        bgcolor: 'primary.main',
                      }}
                    />
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {feature}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
