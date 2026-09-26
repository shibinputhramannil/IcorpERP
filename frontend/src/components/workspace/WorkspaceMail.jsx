import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  InputAdornment,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Stack,
  Pagination,
  Grid,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

import workspaceService from '../../services/workspaceService';
import crmService from '../../services/crmService';

export default function WorkspaceMail({ companyId, externalOpenCompose, onComposeOpened }) {
  const [emails, setEmails] = useState([]);
  const [mailStatus, setMailStatus] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Entities for linkage
  const [customers, setCustomers] = useState([]);
  const [leads, setLeads] = useState([]);

  // Compose Dialog State
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeForm, setComposeForm] = useState({
    recipient: '',
    subject: '',
    body: '',
    entityType: 'None',
    entityId: '',
  });

  const loadMail = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      setError(null);
      const [mailData, statusData] = await Promise.all([
        workspaceService.getMail(companyId, {
          search: search || undefined,
          page: currentPage,
          page_size: 15,
        }),
        workspaceService.getMailStatus(companyId).catch(() => null),
      ]);
      setEmails(mailData.results || []);
      setTotalCount(mailData.count || 0);
      setTotalPages(mailData.total_pages || 1);
      if (statusData) setMailStatus(statusData);
    } catch (err) {
      console.error('Failed to load workspace mail:', err);
      setError('Failed to load workspace emails.');
    } finally {
      setLoading(false);
    }
  }, [companyId, search, currentPage]);

  const loadEntities = useCallback(async () => {
    if (!companyId) return;
    try {
      const [cData, lData] = await Promise.all([
        crmService.getCustomers(companyId).catch(() => []),
        crmService.getLeads(companyId).catch(() => []),
      ]);
      setCustomers(Array.isArray(cData) ? cData : cData.results || []);
      setLeads(Array.isArray(lData) ? lData : lData.results || []);
    } catch {
      // Non-fatal
    }
  }, [companyId]);

  useEffect(() => {
    loadMail();
  }, [loadMail]);

  useEffect(() => {
    loadEntities();
  }, [loadEntities]);

  useEffect(() => {
    if (externalOpenCompose) {
      setComposeOpen(true);
      if (onComposeOpened) onComposeOpened();
    }
  }, [externalOpenCompose, onComposeOpened]);

  const handleEntitySelect = (type, id) => {
    setComposeForm((prev) => {
      let recipientEmail = prev.recipient;
      if (type === 'Customer') {
        const found = customers.find((c) => String(c.id) === String(id));
        if (found?.email) recipientEmail = found.email;
      } else if (type === 'Lead') {
        const found = leads.find((l) => String(l.id) === String(id));
        if (found?.email) recipientEmail = found.email;
      }
      return {
        ...prev,
        entityType: type,
        entityId: id,
        recipient: recipientEmail,
      };
    });
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!composeForm.recipient.trim()) {
      setError('Recipient email is required.');
      return;
    }
    if (!composeForm.subject.trim()) {
      setError('Subject is required.');
      return;
    }
    if (!composeForm.body.trim()) {
      setError('Email message body is required.');
      return;
    }

    try {
      setSending(true);
      setError(null);

      const payload = {
        recipient: composeForm.recipient.trim(),
        subject: composeForm.subject.trim(),
        body: composeForm.body.trim(),
      };

      if (composeForm.entityType === 'Customer' && composeForm.entityId) {
        payload.customer_id = composeForm.entityId;
      } else if (composeForm.entityType === 'Lead' && composeForm.entityId) {
        payload.lead_id = composeForm.entityId;
      }

      const res = await workspaceService.sendMail(companyId, payload);
      const isExternal = res.dispatch_result?.sent_externally;
      setSuccessMsg(
        isExternal
          ? `Email successfully sent to ${payload.recipient}.`
          : `Email recorded in local ERP database for ${payload.recipient} (external Gmail credentials not set).`
      );

      setComposeOpen(false);
      setComposeForm({
        recipient: '',
        subject: '',
        body: '',
        entityType: 'None',
        entityId: '',
      });
      loadMail();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to dispatch email.');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.toLocaleDateString()} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Workspace Mail ({totalCount})
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Outbound customer emails, quotations correspondence, and internal dispatch log.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshOutlinedIcon />}
            onClick={loadMail}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            size="small"
            color="info"
            startIcon={<SendOutlinedIcon />}
            onClick={() => setComposeOpen(true)}
          >
            Compose Mail
          </Button>
        </Stack>
      </Box>

      {/* Integration Status Alert */}
      {mailStatus && (
        <Alert
          severity={mailStatus.is_configured ? 'success' : 'info'}
          icon={mailStatus.is_configured ? <CheckCircleOutlineOutlinedIcon /> : <InfoOutlinedIcon />}
          sx={{ mb: 2 }}
        >
          <strong>Dispatch Mode: {mailStatus.mode}</strong> — {mailStatus.details}
        </Alert>
      )}

      {/* Feedback Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {successMsg && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg(null)}>
          {successMsg}
        </Alert>
      )}

      {/* Search Toolbar */}
      <Card sx={{ borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: 'none', mb: 3 }}>
        <Box sx={{ p: 1.5, display: 'flex', gap: 2 }}>
          <TextField
            size="small"
            placeholder="Search emails by subject or body..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            sx={{ width: { xs: '100%', sm: 360 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                </InputAdornment>
              ),
            }}
          />
        </Box>
      </Card>

      {/* Email List */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={32} />
        </Box>
      ) : emails.length === 0 ? (
        <Card sx={{ borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: 'none', py: 8, textAlign: 'center' }}>
          <EmailOutlinedIcon sx={{ fontSize: 48, color: '#cbd5e1', mb: 1.5 }} />
          <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.secondary' }}>
            No emails logged yet
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, mb: 2 }}>
            Compose and send emails to clients, leads, or partners directly from the workspace.
          </Typography>
          <Button
            variant="contained"
            size="small"
            color="info"
            startIcon={<SendOutlinedIcon />}
            onClick={() => setComposeOpen(true)}
          >
            Compose Email
          </Button>
        </Card>
      ) : (
        <Stack spacing={1.5}>
          {emails.map((e) => (
            <Card
              key={e.id}
              sx={{
                borderRadius: 2,
                border: '1px solid #e2e8f0',
                boxShadow: 'none',
                p: 2,
                transition: 'border-color 0.2s',
                '&:hover': { borderColor: 'primary.main' },
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <EmailOutlinedIcon sx={{ color: '#059669', fontSize: 22 }} />
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                      {e.subject}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      To: <strong>{e.recipient || 'Recipient'}</strong> • By {e.sender_name}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {e.related_entity && (
                    <Chip
                      label={`${e.related_entity.type}: ${e.related_entity.name}`}
                      size="small"
                      sx={{ height: 20, fontSize: '0.675rem', fontWeight: 600, bgcolor: '#eff6ff', color: '#1d4ed8' }}
                    />
                  )}
                  <Chip
                    label={e.status || 'Recorded'}
                    size="small"
                    color={e.status === 'Completed' ? 'success' : 'default'}
                    sx={{ height: 20, fontSize: '0.675rem', fontWeight: 600 }}
                  />
                </Box>
              </Box>

              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  fontSize: '0.85rem',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  my: 1,
                }}
              >
                {e.body}
              </Typography>

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                  {formatTime(e.created_at)}
                </Typography>
              </Box>
            </Card>
          ))}
        </Stack>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <Pagination
            count={totalPages}
            page={currentPage}
            onChange={(e, page) => setCurrentPage(page)}
            color="primary"
          />
        </Box>
      )}

      {/* Compose Email Dialog */}
      <Dialog open={composeOpen} onClose={() => setComposeOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSend}>
          <DialogTitle sx={{ fontWeight: 700 }}>Compose Mail</DialogTitle>
          <DialogContent>
            {/* Link to Entity */}
            <Grid container spacing={2} sx={{ mt: 0.5, mb: 2 }}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Link Contact / Entity</InputLabel>
                  <Select
                    value={composeForm.entityType}
                    label="Link Contact / Entity"
                    onChange={(e) => handleEntitySelect(e.target.value, '')}
                  >
                    <MenuItem value="None">None (Direct Email)</MenuItem>
                    <MenuItem value="Customer">Customer</MenuItem>
                    <MenuItem value="Lead">Lead</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {composeForm.entityType === 'Customer' && (
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Select Customer</InputLabel>
                    <Select
                      value={composeForm.entityId}
                      label="Select Customer"
                      onChange={(e) => handleEntitySelect('Customer', e.target.value)}
                    >
                      {customers.map((c) => (
                        <MenuItem key={c.id} value={String(c.id)}>
                          {c.name} {c.email ? `(${c.email})` : ''}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}

              {composeForm.entityType === 'Lead' && (
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Select Lead</InputLabel>
                    <Select
                      value={composeForm.entityId}
                      label="Select Lead"
                      onChange={(e) => handleEntitySelect('Lead', e.target.value)}
                    >
                      {leads.map((l) => (
                        <MenuItem key={l.id} value={String(l.id)}>
                          {l.first_name} {l.last_name} {l.email ? `(${l.email})` : ''}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}
            </Grid>

            <TextField
              label="Recipient Email"
              type="email"
              fullWidth
              size="small"
              required
              value={composeForm.recipient}
              onChange={(e) => setComposeForm({ ...composeForm, recipient: e.target.value })}
              placeholder="e.g. client@example.com"
              sx={{ mb: 2 }}
            />

            <TextField
              label="Subject"
              fullWidth
              size="small"
              required
              value={composeForm.subject}
              onChange={(e) => setComposeForm({ ...composeForm, subject: e.target.value })}
              placeholder="e.g. Proposal Follow-up, Meeting Agenda..."
              sx={{ mb: 2 }}
            />

            <TextField
              label="Message Body"
              fullWidth
              multiline
              rows={6}
              required
              value={composeForm.body}
              onChange={(e) => setComposeForm({ ...composeForm, body: e.target.value })}
              placeholder="Write your email message..."
            />
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setComposeOpen(false)} disabled={sending}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="info"
              disabled={sending}
              startIcon={sending ? <CircularProgress size={16} /> : <SendOutlinedIcon />}
            >
              Send Mail
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
