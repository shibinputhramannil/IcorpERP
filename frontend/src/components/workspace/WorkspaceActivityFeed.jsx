import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Alert,
  Stack,
  Button,
  Avatar,
  Divider,
} from '@mui/material';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import NoteAltOutlinedIcon from '@mui/icons-material/NoteAltOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';

import workspaceService from '../../services/workspaceService';

export default function WorkspaceActivityFeed({ companyId }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadActivities = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await workspaceService.getActivities(companyId);
      setActivities(data || []);
    } catch (err) {
      console.error('Failed to load workspace activity feed:', err);
      setError('Failed to retrieve workspace activities.');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const getActivityIcon = (type, module) => {
    const t = (type || '').toLowerCase();
    if (t.includes('note')) return <NoteAltOutlinedIcon sx={{ color: '#d97706' }} />;
    if (t.includes('email') || t.includes('mail')) return <EmailOutlinedIcon sx={{ color: '#059669' }} />;
    if (t.includes('doc')) return <DescriptionOutlinedIcon sx={{ color: '#7c3aed' }} />;
    if (t.includes('member') || t.includes('role')) return <PeopleAltOutlinedIcon sx={{ color: '#2563eb' }} />;
    return <SettingsOutlinedIcon sx={{ color: '#64748b' }} />;
  };

  const formatTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.toLocaleDateString()} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Unified Activity Feed
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Comprehensive audit timeline of collaboration events, notes, emails, and member updates.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<RefreshOutlinedIcon />}
          onClick={loadActivities}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={32} />
        </Box>
      ) : activities.length === 0 ? (
        <Card sx={{ borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: 'none', py: 8, textAlign: 'center' }}>
          <HistoryOutlinedIcon sx={{ fontSize: 48, color: '#cbd5e1', mb: 1.5 }} />
          <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.secondary' }}>
            No activity records yet
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            Activity events will appear here as team members collaborate in this workspace.
          </Typography>
        </Card>
      ) : (
        <Stack spacing={1.5}>
          {activities.map((act) => (
            <Card
              key={act.id}
              sx={{
                borderRadius: 2,
                border: '1px solid #e2e8f0',
                boxShadow: 'none',
                p: 2,
                transition: 'background-color 0.2s',
                '&:hover': { bgcolor: '#f8fafc' },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                <Avatar
                  sx={{
                    bgcolor: '#f1f5f9',
                    width: 40,
                    height: 40,
                    mt: 0.25,
                  }}
                >
                  {getActivityIcon(act.type, act.module)}
                </Avatar>

                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
                      {act.title}
                    </Typography>
                    <Chip
                      label={act.module || 'workspace'}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        bgcolor: '#f1f5f9',
                      }}
                    />
                  </Box>

                  <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.85rem', lineHeight: 1.4, mb: 1 }}>
                    {act.description}
                  </Typography>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600 }}>
                      Initiated by: {act.user_name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                      {formatTime(act.timestamp)}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  );
}
