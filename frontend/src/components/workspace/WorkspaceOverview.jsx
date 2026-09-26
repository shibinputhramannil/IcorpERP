import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Avatar,
  Chip,
  Paper,
  Divider,
  Stack,
} from '@mui/material';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import NoteAltOutlinedIcon from '@mui/icons-material/NoteAltOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import AddCircleOutlineOutlinedIcon from '@mui/icons-material/AddCircleOutlineOutlined';

export default function WorkspaceOverview({
  collabData,
  onTabChange,
  onOpenNewNote,
  onOpenComposeMail,
  onOpenUploadDoc,
  onOpenAddMember,
  isAdmin,
}) {
  const stats = collabData?.stats || {};
  const company = collabData?.company || {};
  const notes = collabData?.notes || [];
  const emails = collabData?.emails || [];
  const documents = collabData?.documents || [];
  const activities = collabData?.activities || [];
  const members = collabData?.members || [];

  const formatTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.toLocaleDateString()} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <Box>
      {/* Quick Actions Bar */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 3,
          borderRadius: 2,
          border: 1, borderColor: 'divider',
          bgcolor: 'background.subtle',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1.5,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AddCircleOutlineOutlinedIcon sx={{ color: 'primary.main', fontSize: 20 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
            Quick Actions:
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button
            variant="contained"
            size="small"
            startIcon={<NoteAltOutlinedIcon />}
            onClick={onOpenNewNote}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            New Note
          </Button>
          <Button
            variant="contained"
            size="small"
            color="info"
            startIcon={<EmailOutlinedIcon />}
            onClick={onOpenComposeMail}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Compose Mail
          </Button>
          <Button
            variant="contained"
            size="small"
            color="secondary"
            startIcon={<DescriptionOutlinedIcon />}
            onClick={onOpenUploadDoc}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Upload Document
          </Button>
          {isAdmin && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<PeopleAltOutlinedIcon />}
              onClick={onOpenAddMember}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Add Member
            </Button>
          )}
        </Stack>
      </Paper>

      {/* Stats Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ borderRadius: 2, border: 1, borderColor: 'divider', boxShadow: 'none' }}>
            <CardContent sx={{ py: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar sx={{ bgcolor: '#eff6ff', color: 'primary.main', width: 40, height: 40 }}>
                  <PeopleAltOutlinedIcon fontSize="small" />
                </Avatar>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                    MEMBERS
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {stats.total_members ?? 0}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ borderRadius: 2, border: 1, borderColor: 'divider', boxShadow: 'none' }}>
            <CardContent sx={{ py: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar sx={{ bgcolor: '#fef3c7', color: '#d97706', width: 40, height: 40 }}>
                  <NoteAltOutlinedIcon fontSize="small" />
                </Avatar>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                    NOTES
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {stats.total_notes ?? 0}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ borderRadius: 2, border: 1, borderColor: 'divider', boxShadow: 'none' }}>
            <CardContent sx={{ py: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar sx={{ bgcolor: '#ecfdf5', color: '#059669', width: 40, height: 40 }}>
                  <EmailOutlinedIcon fontSize="small" />
                </Avatar>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                    EMAILS
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {stats.total_emails ?? 0}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ borderRadius: 2, border: 1, borderColor: 'divider', boxShadow: 'none' }}>
            <CardContent sx={{ py: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar sx={{ bgcolor: '#f5f3ff', color: '#7c3aed', width: 40, height: 40 }}>
                  <DescriptionOutlinedIcon fontSize="small" />
                </Avatar>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                    DOCUMENTS
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {stats.total_documents ?? 0}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ borderRadius: 2, border: 1, borderColor: 'divider', boxShadow: 'none' }}>
            <CardContent sx={{ py: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar sx={{ bgcolor: '#fff1f2', color: '#e11d48', width: 40, height: 40 }}>
                  <BusinessOutlinedIcon fontSize="small" />
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                    STATUS
                  </Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }} noWrap>
                    {company.name || 'Company'}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 4 Quadrants: Recent Notes, Recent Mail, Recent Docs, Recent Activities */}
      <Grid container spacing={3}>
        {/* Recent Notes */}
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 2, border: 1, borderColor: 'divider', boxShadow: 'none', height: '100%' }}>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <NoteAltOutlinedIcon sx={{ color: '#d97706', fontSize: 20 }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Recent Notes
                </Typography>
              </Box>
              <Button
                size="small"
                endIcon={<ArrowForwardOutlinedIcon sx={{ fontSize: 16 }} />}
                onClick={() => onTabChange(1)}
                sx={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 600 }}
              >
                View all ({stats.total_notes ?? 0})
              </Button>
            </Box>
            <CardContent sx={{ p: 2 }}>
              {notes.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.secondary', py: 3, textAlign: 'center' }}>
                  No workspace notes created yet.
                </Typography>
              ) : (
                <Stack spacing={1.5}>
                  {notes.map((n) => (
                    <Box key={n.id} sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'background.subtle', border: '1px solid #f1f5f9' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                          {n.title}
                        </Typography>
                        {n.related_entity && (
                          <Chip
                            label={`${n.related_entity.type}: ${n.related_entity.name}`}
                            size="small"
                            sx={{ height: 18, fontSize: '0.65rem', fontWeight: 600, bgcolor: '#eff6ff', color: '#1d4ed8' }}
                          />
                        )}
                      </Box>
                      <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem', lineHeight: 1.4 }} noWrap>
                        {n.content}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#94a3b8', mt: 0.5, display: 'block' }}>
                        By {n.author_name} • {formatTime(n.created_at)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Mail */}
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 2, border: 1, borderColor: 'divider', boxShadow: 'none', height: '100%' }}>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <EmailOutlinedIcon sx={{ color: '#059669', fontSize: 20 }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Recent Emails
                </Typography>
              </Box>
              <Button
                size="small"
                endIcon={<ArrowForwardOutlinedIcon sx={{ fontSize: 16 }} />}
                onClick={() => onTabChange(2)}
                sx={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 600 }}
              >
                View all ({stats.total_emails ?? 0})
              </Button>
            </Box>
            <CardContent sx={{ p: 2 }}>
              {emails.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.secondary', py: 3, textAlign: 'center' }}>
                  No emails logged or dispatched yet.
                </Typography>
              ) : (
                <Stack spacing={1.5}>
                  {emails.map((e) => (
                    <Box key={e.id} sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'background.subtle', border: '1px solid #f1f5f9' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                          {e.subject}
                        </Typography>
                        <Chip
                          label={e.recipient || 'Recipient'}
                          size="small"
                          sx={{ height: 18, fontSize: '0.65rem', fontWeight: 600, bgcolor: '#f0fdf4', color: '#16a34a' }}
                        />
                      </Box>
                      <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem', lineHeight: 1.4 }} noWrap>
                        {e.body}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#94a3b8', mt: 0.5, display: 'block' }}>
                        By {e.sender_name} • {formatTime(e.created_at)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Documents */}
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 2, border: 1, borderColor: 'divider', boxShadow: 'none', height: '100%' }}>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DescriptionOutlinedIcon sx={{ color: '#7c3aed', fontSize: 20 }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Recent Documents
                </Typography>
              </Box>
              <Button
                size="small"
                endIcon={<ArrowForwardOutlinedIcon sx={{ fontSize: 16 }} />}
                onClick={() => onTabChange(3)}
                sx={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 600 }}
              >
                View all ({stats.total_documents ?? 0})
              </Button>
            </Box>
            <CardContent sx={{ p: 2 }}>
              {documents.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.secondary', py: 3, textAlign: 'center' }}>
                  No documents uploaded yet.
                </Typography>
              ) : (
                <Stack spacing={1.5}>
                  {documents.map((d) => (
                    <Box key={d.id} sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'background.subtle', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ minWidth: 0, mr: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.85rem' }} noWrap>
                          {d.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {d.file_type} • {d.file_size_formatted || 'File'} • Uploaded by {d.uploaded_by_name}
                        </Typography>
                      </Box>
                      <Button
                        size="small"
                        href={d.download_url}
                        target="_blank"
                        rel="noreferrer"
                        sx={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 600 }}
                      >
                        Download
                      </Button>
                    </Box>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Activities */}
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 2, border: 1, borderColor: 'divider', boxShadow: 'none', height: '100%' }}>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <HistoryOutlinedIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Recent Workspace Activity
                </Typography>
              </Box>
              <Button
                size="small"
                endIcon={<ArrowForwardOutlinedIcon sx={{ fontSize: 16 }} />}
                onClick={() => onTabChange(4)}
                sx={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 600 }}
              >
                View all
              </Button>
            </Box>
            <CardContent sx={{ p: 2 }}>
              {activities.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.secondary', py: 3, textAlign: 'center' }}>
                  No recent activities recorded.
                </Typography>
              ) : (
                <Stack spacing={1.5}>
                  {activities.map((act) => (
                    <Box key={act.id} sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'background.subtle', border: '1px solid #f1f5f9' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                        {act.details}
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                        <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600 }}>
                          {act.user_name || 'System'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {formatTime(act.created_at)}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
