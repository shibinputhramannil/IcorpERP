import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
  Chip,
  Badge,
  Tooltip,
  Alert,
} from '@mui/material';

// Icons
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import DraftsOutlinedIcon from '@mui/icons-material/DraftsOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import StarIcon from '@mui/icons-material/Star';
import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined';
import MarkEmailUnreadOutlinedIcon from '@mui/icons-material/MarkEmailUnreadOutlined';
import ReplyOutlinedIcon from '@mui/icons-material/ReplyOutlined';
import ForwardOutlinedIcon from '@mui/icons-material/ForwardOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloudDoneOutlinedIcon from '@mui/icons-material/CloudDoneOutlined';
import CloudQueueOutlinedIcon from '@mui/icons-material/CloudQueueOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';

import PageHeader from '../components/common/PageHeader';
import EmptyState from '../components/common/EmptyState';
import LoadingState from '../components/common/LoadingState';
import emailService from '../services/emailService';
import { useCompany } from '../context/CompanyContext';
import { extractErrorMessage } from '../utils/errorUtils';

const FOLDERS = [
  { id: 'inbox', label: 'Inbox', icon: InboxOutlinedIcon },
  { id: 'sent', label: 'Sent', icon: SendOutlinedIcon },
  { id: 'drafts', label: 'Drafts', icon: DraftsOutlinedIcon },
  { id: 'trash', label: 'Trash', icon: DeleteOutlineOutlinedIcon },
];

export default function EmailPage() {
  const { currentCompany } = useCompany();
  const [currentFolder, setCurrentFolder] = useState('inbox');
  const [emails, setEmails] = useState([]);
  const [folderCounts, setFolderCounts] = useState({ inbox: 0, sent: 0, drafts: 0, trash: 0, unread: 0 });
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [mailStatus, setMailStatus] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Compose Modal
  const [composeOpen, setComposeOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [composeData, setComposeData] = useState({
    recipient: '',
    recipient_name: '',
    cc: '',
    bcc: '',
    subject: '',
    body: '',
  });

  const fetchFolderCounts = useCallback(async () => {
    if (!currentCompany?.id) return;
    try {
      const counts = await emailService.getFolderCounts(currentCompany.id);
      setFolderCounts(counts || { inbox: 0, sent: 0, drafts: 0, trash: 0, unread: 0 });
    } catch (err) {
      console.error('Error fetching folder counts:', err);
    }
  }, [currentCompany?.id]);

  const fetchMailStatus = useCallback(async () => {
    if (!currentCompany?.id) return;
    try {
      const statusData = await emailService.getStatus(currentCompany.id);
      setMailStatus(statusData);
    } catch (err) {
      console.error('Error fetching mail status:', err);
    }
  }, [currentCompany?.id]);

  const fetchEmails = useCallback(async () => {
    if (!currentCompany?.id) return;
    setLoading(true);
    setError('');
    try {
      const params = { folder: currentFolder };
      if (search.trim()) {
        params.search = search.trim();
      }
      const data = await emailService.getEmails(currentCompany.id, params);
      const results = data.results || [];
      setEmails(results);
      if (results.length > 0 && !selectedEmail) {
        setSelectedEmail(results[0]);
      } else if (results.length === 0) {
        setSelectedEmail(null);
      }
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [currentCompany?.id, currentFolder, search]);

  useEffect(() => {
    fetchEmails();
    fetchFolderCounts();
    fetchMailStatus();
  }, [fetchEmails, fetchFolderCounts, fetchMailStatus]);

  const handleSelectEmail = async (email) => {
    setSelectedEmail(email);
    if (!email.is_read) {
      try {
        await emailService.getEmail(currentCompany.id, email.id);
        setEmails((prev) =>
          prev.map((e) => (e.id === email.id ? { ...e, is_read: true } : e))
        );
        fetchFolderCounts();
      } catch (err) {
        console.error('Error marking email as read:', err);
      }
    }
  };

  const handleToggleStar = async (e, email) => {
    e.stopPropagation();
    try {
      const newStarred = !email.is_starred;
      await emailService.updateEmail(currentCompany.id, email.id, { is_starred: newStarred });
      setEmails((prev) =>
        prev.map((item) => (item.id === email.id ? { ...item, is_starred: newStarred } : item))
      );
      if (selectedEmail?.id === email.id) {
        setSelectedEmail({ ...selectedEmail, is_starred: newStarred });
      }
    } catch (err) {
      console.error('Error toggling star:', err);
    }
  };

  const handleDeleteEmail = async (emailId) => {
    try {
      await emailService.deleteEmail(currentCompany.id, emailId);
      setEmails((prev) => prev.filter((e) => e.id !== emailId));
      if (selectedEmail?.id === emailId) {
        setSelectedEmail(null);
      }
      fetchFolderCounts();
    } catch (err) {
      alert(extractErrorMessage(err));
    }
  };

  const handleOpenCompose = (replyTo = null) => {
    if (replyTo) {
      setComposeData({
        recipient: replyTo.sender_email || replyTo.recipient,
        recipient_name: replyTo.sender_name || '',
        cc: '',
        bcc: '',
        subject: replyTo.subject.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject}`,
        body: `\n\n--- Original Message ---\nFrom: ${replyTo.sender_display}\nDate: ${new Date(replyTo.created_at).toLocaleString()}\n\n${replyTo.body}`,
      });
    } else {
      setComposeData({
        recipient: '',
        recipient_name: '',
        cc: '',
        bcc: '',
        subject: '',
        body: '',
      });
    }
    setComposeOpen(true);
  };

  const handleSendEmail = async (asDraft = false) => {
    if (!asDraft && !composeData.recipient.trim()) {
      alert('Please provide a recipient email address.');
      return;
    }
    setSending(true);
    try {
      const payload = {
        ...composeData,
        is_draft: asDraft,
        folder: asDraft ? 'drafts' : 'sent',
      };
      await emailService.sendEmail(currentCompany.id, payload);
      setComposeOpen(false);
      fetchEmails();
      fetchFolderCounts();
    } catch (err) {
      alert(extractErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  if (!currentCompany) {
    return (
      <Box sx={{ p: 3 }}>
        <EmptyState
          title="No Company Selected"
          description="Please select a company workspace to view and manage correspondence."
        />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1440, margin: '0 auto' }}>
      {/* Page Header */}
      <PageHeader
        title="Email Hub"
        subtitle="Corporate email correspondence, client communication timelines, and outbound dispatch tracking."
        action={
          <Stack direction="row" spacing={1.5} alignItems="center">
            {mailStatus && (
              <Chip
                icon={mailStatus.is_configured ? <CloudDoneOutlinedIcon fontSize="small" /> : <CloudQueueOutlinedIcon fontSize="small" />}
                label={mailStatus.status || 'Local Ready'}
                color={mailStatus.is_configured ? 'success' : 'default'}
                variant="outlined"
                size="small"
                sx={{ fontWeight: 600 }}
              />
            )}
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenCompose()}
              sx={{ fontWeight: 600 }}
            >
              Compose Email
            </Button>
          </Stack>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Main Email Layout */}
      <Grid container spacing={2}>
        {/* Left Folder Navigation Sidebar */}
        <Grid item xs={12} md={3} lg={2.5}>
          <Card sx={{ p: 2, height: '100%' }}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenCompose()}
              sx={{ mb: 2, fontWeight: 700, py: 1 }}
            >
              Compose
            </Button>

            <List component="nav" sx={{ px: 0 }}>
              {FOLDERS.map((f) => {
                const IconComponent = f.icon;
                const isSelected = currentFolder === f.id;
                const count = folderCounts[f.id] || 0;

                return (
                  <ListItemButton
                    key={f.id}
                    selected={isSelected}
                    onClick={() => {
                      setCurrentFolder(f.id);
                      setSelectedEmail(null);
                    }}
                    sx={{
                      borderRadius: 1.5,
                      mb: 0.5,
                      fontWeight: isSelected ? 700 : 500,
                      '&.Mui-selected': {
                        bgcolor: 'primary.light',
                        color: 'primary.main',
                        '&:hover': { bgcolor: 'primary.light' },
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 36, color: isSelected ? 'primary.main' : 'text.secondary' }}>
                      <IconComponent fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={f.label}
                      primaryTypographyProps={{
                        variant: 'body2',
                        fontWeight: isSelected ? 700 : 500,
                      }}
                    />
                    {count > 0 && (
                      <Chip
                        label={count}
                        size="small"
                        color={f.id === 'inbox' ? 'primary' : 'default'}
                        sx={{ height: 20, fontSize: '0.7rem', fontWeight: 700 }}
                      />
                    )}
                  </ListItemButton>
                );
              })}
            </List>

            <Divider sx={{ my: 2 }} />

            {/* Delivery Channel Notice */}
            <Box sx={{ p: 1.5, bgcolor: 'background.subtle', borderRadius: 1.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.5 }}>
                DELIVERY PROTOCOL
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                {mailStatus?.details || 'Local CRM simulation active. Sent messages are recorded in correspondence activity.'}
              </Typography>
            </Box>
          </Card>
        </Grid>

        {/* Center: Email List */}
        <Grid item xs={12} md={4.5} lg={4.5}>
          <Card sx={{ height: '720px', display: 'flex', flexDirection: 'column' }}>
            {/* Search Header */}
            <Box sx={{ p: 1.5, borderBottom: '1px solid #e2e8f0' }}>
              <TextField
                fullWidth
                size="small"
                placeholder={`Search ${currentFolder}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={fetchEmails}>
                        <RefreshIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            {/* Email Items List */}
            <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
              {loading ? (
                <LoadingState message="Loading emails..." />
              ) : emails.length === 0 ? (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    No emails in {currentFolder}.
                  </Typography>
                </Box>
              ) : (
                <List disablePadding>
                  {emails.map((email) => {
                    const isSelected = selectedEmail?.id === email.id;
                    const dateStr = new Date(email.created_at).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                    });

                    return (
                      <ListItem
                        key={email.id}
                        disablePadding
                        sx={{
                          borderBottom: '1px solid #f1f5f9',
                          bgcolor: isSelected
                            ? (theme => theme.palette.mode === 'dark' ? 'rgba(16,185,129,0.15)' : '#f0fdf4')
                            : !email.is_read
                            ? 'background.subtle'
                            : '#ffffff',
                        }}
                      >
                        <ListItemButton
                          onClick={() => handleSelectEmail(email)}
                          sx={{
                            p: 1.5,
                            alignItems: 'flex-start',
                            borderLeft: isSelected
                              ? '3px solid #16a34a'
                              : !email.is_read
                              ? '3px solid #2563eb'
                              : '3px solid transparent',
                          }}
                        >
                          <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ width: '100%' }}>
                            <IconButton
                              size="small"
                              onClick={(e) => handleToggleStar(e, email)}
                              sx={{ p: 0.25, mt: -0.25 }}
                            >
                              {email.is_starred ? (
                                <StarIcon sx={{ fontSize: '1.1rem', color: '#f59e0b' }} />
                              ) : (
                                <StarBorderIcon sx={{ fontSize: '1.1rem', color: 'text.secondary' }} />
                              )}
                            </IconButton>

                            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.25 }}>
                                <Typography
                                  variant="body2"
                                  sx={{
                                    fontWeight: !email.is_read ? 800 : 600,
                                    color: 'text.primary',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {currentFolder === 'sent'
                                    ? `To: ${email.recipient_name || email.recipient}`
                                    : email.sender_display}
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'text.secondary', flexShrink: 0, ml: 1 }}>
                                  {dateStr}
                                </Typography>
                              </Stack>

                              <Typography
                                variant="body2"
                                sx={{
                                  fontWeight: !email.is_read ? 700 : 500,
                                  color: 'text.primary',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  mb: 0.5,
                                }}
                              >
                                {email.subject}
                              </Typography>

                              <Typography
                                variant="caption"
                                sx={{
                                  color: 'text.secondary',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                  lineHeight: 1.4,
                                }}
                              >
                                {email.body}
                              </Typography>
                            </Box>
                          </Stack>
                        </ListItemButton>
                      </ListItem>
                    );
                  })}
                </List>
              )}
            </Box>
          </Card>
        </Grid>

        {/* Right: Email Reading Pane */}
        <Grid item xs={12} md={4.5} lg={5}>
          <Card sx={{ height: '720px', display: 'flex', flexDirection: 'column' }}>
            {selectedEmail ? (
              <>
                {/* Header Actions */}
                <Box
                  sx={{
                    p: 2,
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      startIcon={<ReplyOutlinedIcon />}
                      variant="outlined"
                      onClick={() => handleOpenCompose(selectedEmail)}
                    >
                      Reply
                    </Button>
                    <Button
                      size="small"
                      startIcon={<ForwardOutlinedIcon />}
                      variant="outlined"
                      onClick={() => handleOpenCompose({ ...selectedEmail, subject: `Fwd: ${selectedEmail.subject}` })}
                    >
                      Forward
                    </Button>
                  </Stack>

                  <Stack direction="row" spacing={1}>
                    <IconButton size="small" color="error" onClick={() => handleDeleteEmail(selectedEmail.id)}>
                      <DeleteOutlineOutlinedIcon />
                    </IconButton>
                  </Stack>
                </Box>

                {/* Email Content */}
                <Box sx={{ p: 3, flexGrow: 1, overflowY: 'auto' }}>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 2, lineHeight: 1.3 }}>
                    {selectedEmail.subject}
                  </Typography>

                  <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        bgcolor: 'primary.main',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                      }}
                    >
                      {(selectedEmail.sender_display || 'U')[0].toUpperCase()}
                    </Box>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {selectedEmail.sender_display}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        To: {selectedEmail.recipient_name ? `${selectedEmail.recipient_name} <${selectedEmail.recipient}>` : selectedEmail.recipient}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(selectedEmail.created_at).toLocaleString()}
                    </Typography>
                  </Stack>

                  <Divider sx={{ mb: 3 }} />

                  <Typography
                    variant="body1"
                    sx={{
                      whiteSpace: 'pre-wrap',
                      lineHeight: 1.8,
                      color: 'text.primary',
                    }}
                  >
                    {selectedEmail.body}
                  </Typography>
                </Box>
              </>
            ) : (
              <Box sx={{ p: 5, textAlign: 'center', my: 'auto' }}>
                <EmptyState
                  title="Select an Email"
                  description="Choose an email from the list to preview correspondence details."
                />
              </Box>
            )}
          </Card>
        </Grid>
      </Grid>

      {/* Compose Email Dialog */}
      <Dialog open={composeOpen} onClose={() => setComposeOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, borderBottom: '1px solid #e2e8f0' }}>
          Compose Corporate Correspondence
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              required
              fullWidth
              label="To (Recipient Email)"
              placeholder="e.g. client@acme.com"
              value={composeData.recipient}
              onChange={(e) => setComposeData({ ...composeData, recipient: e.target.value })}
            />

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Cc"
                  placeholder="e.g. manager@icorp.com"
                  value={composeData.cc}
                  onChange={(e) => setComposeData({ ...composeData, cc: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Bcc"
                  placeholder="e.g. records@icorp.com"
                  value={composeData.bcc}
                  onChange={(e) => setComposeData({ ...composeData, bcc: e.target.value })}
                />
              </Grid>
            </Grid>

            <TextField
              required
              fullWidth
              label="Subject"
              placeholder="Meeting agenda, proposal update, quotation..."
              value={composeData.subject}
              onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
            />

            <TextField
              required
              fullWidth
              multiline
              rows={10}
              label="Message Body"
              placeholder="Write your email body here..."
              value={composeData.body}
              onChange={(e) => setComposeData({ ...composeData, body: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0', justifyContent: 'space-between' }}>
          <Button onClick={() => handleSendEmail(true)} color="inherit" disabled={sending}>
            Save as Draft
          </Button>
          <Stack direction="row" spacing={1}>
            <Button onClick={() => setComposeOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              startIcon={<SendOutlinedIcon />}
              onClick={() => handleSendEmail(false)}
              disabled={sending}
            >
              {sending ? 'Sending...' : 'Send Email'}
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
