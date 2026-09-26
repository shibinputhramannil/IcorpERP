import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  TextField,
  InputAdornment,
  Chip,
  IconButton,
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
  Tooltip,
  Stack,
  Pagination,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import NoteAltOutlinedIcon from '@mui/icons-material/NoteAltOutlined';
import AddCircleOutlineOutlinedIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';

import workspaceService from '../../services/workspaceService';
import crmService from '../../services/crmService';

export default function WorkspaceNotes({ companyId, externalOpenNew, onNewOpened }) {
  const [notes, setNotes] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // CRM entities for linkage
  const [customers, setCustomers] = useState([]);
  const [leads, setLeads] = useState([]);

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    entityType: 'None',
    entityId: '',
  });

  const loadNotes = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await workspaceService.getNotes(companyId, {
        search: search || undefined,
        page: currentPage,
        page_size: 12,
      });
      setNotes(data.results || []);
      setTotalCount(data.count || 0);
      setTotalPages(data.total_pages || 1);
    } catch (err) {
      console.error('Failed to load notes:', err);
      setError('Failed to load workspace notes.');
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
    loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    loadEntities();
  }, [loadEntities]);

  useEffect(() => {
    if (externalOpenNew) {
      handleOpenCreate();
      if (onNewOpened) onNewOpened();
    }
  }, [externalOpenNew, onNewOpened]);

  const handleOpenCreate = () => {
    setEditingNote(null);
    setFormData({
      title: '',
      content: '',
      entityType: 'None',
      entityId: '',
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (note) => {
    setEditingNote(note);
    let eType = 'None';
    let eId = '';
    if (note.customer_id) {
      eType = 'Customer';
      eId = String(note.customer_id);
    } else if (note.lead_id) {
      eType = 'Lead';
      eId = String(note.lead_id);
    }
    setFormData({
      title: note.title || '',
      content: note.content || '',
      entityType: eType,
      entityId: eId,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.content.trim()) {
      setError('Note content cannot be empty.');
      return;
    }
    try {
      setSaving(true);
      setError(null);

      const payload = {
        title: formData.title.trim() || formData.content.slice(0, 40),
        content: formData.content.trim(),
      };

      if (formData.entityType === 'Customer' && formData.entityId) {
        payload.customer_id = formData.entityId;
      } else if (formData.entityType === 'Lead' && formData.entityId) {
        payload.lead_id = formData.entityId;
      }

      if (editingNote) {
        await workspaceService.updateNote(companyId, editingNote.id, payload);
        setSuccessMsg('Note updated successfully.');
      } else {
        await workspaceService.createNote(companyId, payload);
        setSuccessMsg('Note created successfully.');
      }

      setDialogOpen(false);
      loadNotes();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save note.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (note) => {
    if (!window.confirm(`Delete note "${note.title}"?`)) return;
    try {
      await workspaceService.deleteNote(companyId, note.id);
      setSuccessMsg('Note deleted successfully.');
      loadNotes();
    } catch (err) {
      setError('Failed to delete note.');
    }
  };

  const formatTime = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <Box>
      {/* Header & Controls */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Workspace Notes ({totalCount})
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Internal memos, meeting summaries, and customer-linked briefings.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshOutlinedIcon />}
            onClick={loadNotes}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddCircleOutlineOutlinedIcon />}
            onClick={handleOpenCreate}
          >
            New Note
          </Button>
        </Stack>
      </Box>

      {/* Alerts */}
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
      <Card sx={{ borderRadius: 2, border: 1, borderColor: 'divider', boxShadow: 'none', mb: 3 }}>
        <Box sx={{ p: 1.5, display: 'flex', gap: 2 }}>
          <TextField
            size="small"
            placeholder="Search notes by title or content..."
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

      {/* Notes Grid */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={32} />
        </Box>
      ) : notes.length === 0 ? (
        <Card sx={{ borderRadius: 2, border: 1, borderColor: 'divider', boxShadow: 'none', py: 8, textAlign: 'center' }}>
          <NoteAltOutlinedIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1.5 }} />
          <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.secondary' }}>
            No notes found
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, mb: 2 }}>
            {search ? 'Try adjusting your search query.' : 'Create your first collaborative note.'}
          </Typography>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddCircleOutlineOutlinedIcon />}
            onClick={handleOpenCreate}
          >
            Create Note
          </Button>
        </Card>
      ) : (
        <Grid container spacing={2.5}>
          {notes.map((note) => (
            <Grid item xs={12} sm={6} md={4} key={note.id}>
              <Card
                sx={{
                  borderRadius: 2,
                  border: 1, borderColor: 'divider',
                  boxShadow: 'none',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'box-shadow 0.2s',
                  '&:hover': {
                    boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
                  },
                }}
              >
                <CardContent sx={{ flexGrow: 1, p: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '0.95rem' }} noWrap>
                      {note.title}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title="Edit Note">
                        <IconButton size="small" onClick={() => handleOpenEdit(note)}>
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete Note">
                        <IconButton size="small" color="error" onClick={() => handleDelete(note)}>
                          <DeleteOutlineOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>

                  {note.related_entity && (
                    <Chip
                      label={`${note.related_entity.type}: ${note.related_entity.name}`}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.675rem',
                        fontWeight: 600,
                        bgcolor: '#eff6ff',
                        color: '#1d4ed8',
                        mb: 1.5,
                      }}
                    />
                  )}

                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.secondary',
                      fontSize: '0.85rem',
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                      display: '-webkit-box',
                      WebkitLineClamp: 5,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {note.content}
                  </Typography>
                </CardContent>

                <Box
                  sx={{
                    px: 2,
                    py: 1.25,
                    borderTop: 1, borderColor: 'divider',
                    bgcolor: 'background.subtle',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                    {note.author_name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                    {formatTime(note.created_at)}
                  </Typography>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
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

      {/* Create / Edit Note Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit}>
          <DialogTitle sx={{ fontWeight: 700 }}>
            {editingNote ? 'Edit Workspace Note' : 'Create Workspace Note'}
          </DialogTitle>
          <DialogContent>
            <TextField
              label="Title"
              fullWidth
              size="small"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Sales Briefing, Team Update..."
              sx={{ mt: 1, mb: 2 }}
            />

            <TextField
              label="Note Content"
              fullWidth
              multiline
              rows={5}
              required
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Write collaborative notes, action points, or decisions..."
              sx={{ mb: 2 }}
            />

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Link to Entity</InputLabel>
                  <Select
                    value={formData.entityType}
                    label="Link to Entity"
                    onChange={(e) =>
                      setFormData({ ...formData, entityType: e.target.value, entityId: '' })
                    }
                  >
                    <MenuItem value="None">None (General Note)</MenuItem>
                    <MenuItem value="Customer">Customer</MenuItem>
                    <MenuItem value="Lead">Lead</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {formData.entityType === 'Customer' && (
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Select Customer</InputLabel>
                    <Select
                      value={formData.entityId}
                      label="Select Customer"
                      onChange={(e) => setFormData({ ...formData, entityId: e.target.value })}
                    >
                      {customers.map((c) => (
                        <MenuItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}

              {formData.entityType === 'Lead' && (
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Select Lead</InputLabel>
                    <Select
                      value={formData.entityId}
                      label="Select Lead"
                      onChange={(e) => setFormData({ ...formData, entityId: e.target.value })}
                    >
                      {leads.map((l) => (
                        <MenuItem key={l.id} value={String(l.id)}>
                          {l.first_name} {l.last_name} ({l.lead_company || 'Lead'})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}
            </Grid>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={saving}
              startIcon={saving ? <CircularProgress size={16} /> : null}
            >
              {editingNote ? 'Save Changes' : 'Create Note'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
