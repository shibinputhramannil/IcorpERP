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
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
  Chip,
  Tabs,
  Tab,
  Alert,
  Paper,
  Tooltip,
} from '@mui/material';

// Icons
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import StickyNote2OutlinedIcon from '@mui/icons-material/StickyNote2Outlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import AccessTimeOutlined from '@mui/icons-material/AccessTimeOutlined';

import PageHeader from '../components/common/PageHeader';
import StatCard from '../components/common/StatCard';
import EmptyState from '../components/common/EmptyState';
import LoadingState from '../components/common/LoadingState';
import workspaceService from '../services/workspaceService';
import { useCompany } from '../context/CompanyContext';
import { extractErrorMessage } from '../utils/errorUtils';

const COMMON_TAGS = ['All', 'General', 'Sales', 'Client Meeting', 'Follow-up', 'Urgent', 'Internal'];

export default function NotesPage() {
  const { currentCompany } = useCompany();
  const [notes, setNotes] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState('All');
  const [page, setPage] = useState(1);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form
  const [formData, setFormData] = useState({
    title: '',
    content: '',
  });

  const fetchNotes = useCallback(async () => {
    if (!currentCompany?.id) return;
    setLoading(true);
    setError('');
    try {
      const params = { page, page_size: 30 };
      if (search.trim()) {
        params.search = search.trim();
      }
      const data = await workspaceService.getNotes(currentCompany.id, params);
      const results = data.results || [];
      setNotes(results);
      setTotalCount(data.count || results.length);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [currentCompany?.id, page, search]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleOpenCreate = () => {
    setSelectedNote(null);
    setFormData({ title: '', content: '' });
    setCreateModalOpen(true);
  };

  const handleOpenEdit = (note) => {
    setSelectedNote(note);
    setFormData({
      title: note.title || '',
      content: note.content || '',
    });
    setViewModalOpen(false);
    setCreateModalOpen(true);
  };

  const handleSaveNote = async (e) => {
    e.preventDefault();
    if (!formData.content.trim()) {
      alert('Note content cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      if (selectedNote) {
        await workspaceService.updateNote(currentCompany.id, selectedNote.id, formData);
      } else {
        await workspaceService.createNote(currentCompany.id, formData);
      }
      setCreateModalOpen(false);
      fetchNotes();
    } catch (err) {
      alert(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm('Are you sure you want to delete this note?')) return;
    try {
      await workspaceService.deleteNote(currentCompany.id, noteId);
      setViewModalOpen(false);
      fetchNotes();
    } catch (err) {
      alert(extractErrorMessage(err));
    }
  };

  // Filter notes by tag if selected
  const filteredNotes = notes.filter((n) => {
    if (selectedTag === 'All') return true;
    const text = `${n.title} ${n.content}`.toLowerCase();
    return text.includes(selectedTag.toLowerCase());
  });

  const linkedNotesCount = notes.filter((n) => n.related_entity).length;

  if (!currentCompany) {
    return (
      <Box sx={{ p: 3 }}>
        <EmptyState
          title="No Company Selected"
          description="Please select a company workspace to view and manage enterprise notes."
        />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1440, margin: '0 auto' }}>
      {/* Header */}
      <PageHeader
        title="Enterprise Notes"
        subtitle="Collaborative corporate note-taking contextualized to workspaces, clients, deals, and meetings."
        action={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenCreate}
            sx={{ fontWeight: 600 }}
          >
            Create Note
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Stat Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Notes"
            value={totalCount}
            icon={StickyNote2OutlinedIcon}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Entity-Linked"
            value={linkedNotesCount}
            icon={LinkOutlinedIcon}
            color="info"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Team Members"
            value={currentCompany.members_count || 1}
            icon={GroupsOutlinedIcon}
            color="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Recent Notes"
            value={notes.length}
            icon={AccessTimeOutlined}
            color="warning"
          />
        </Grid>
      </Grid>

      {/* Search & Tag Filter Card */}
      <Card sx={{ mb: 3, p: 2 }}>
        <Stack spacing={2}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search notes by title, keywords, or content..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
          />

          {/* Tag Quick Filters */}
          <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5 }}>
            {COMMON_TAGS.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                clickable
                color={selectedTag === tag ? 'primary' : 'default'}
                variant={selectedTag === tag ? 'filled' : 'outlined'}
                onClick={() => setSelectedTag(tag)}
                size="small"
                sx={{ fontWeight: 600 }}
              />
            ))}
          </Stack>
        </Stack>
      </Card>

      {/* Notes Grid */}
      {loading ? (
        <LoadingState message="Loading notes..." />
      ) : filteredNotes.length === 0 ? (
        <Card sx={{ p: 4 }}>
          <EmptyState
            title="No Notes Found"
            description={
              search
                ? `No notes matched your search term "${search}".`
                : "No notes have been created in this workspace yet."
            }
            action={
              <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate}>
                Create First Note
              </Button>
            }
          />
        </Card>
      ) : (
        <Grid container spacing={2.5}>
          {filteredNotes.map((note) => {
            const hasEntity = Boolean(note.related_entity);
            return (
              <Grid item xs={12} sm={6} md={4} key={note.id}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    p: 2.5,
                    border: 1, borderColor: 'divider',
                    transition: 'all 0.2s',
                    '&:hover': {
                      boxShadow: 3,
                      borderColor: 'primary.main',
                    },
                  }}
                >
                  <Box>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
                      <Typography
                        variant="subtitle1"
                        sx={{
                          fontWeight: 700,
                          lineHeight: 1.3,
                          cursor: 'pointer',
                          '&:hover': { color: 'primary.main' },
                        }}
                        onClick={() => {
                          setSelectedNote(note);
                          setViewModalOpen(true);
                        }}
                      >
                        {note.title || 'Untitled Note'}
                      </Typography>
                    </Stack>

                    {hasEntity && (
                      <Chip
                        icon={<LinkOutlinedIcon fontSize="small" />}
                        label={`${note.related_entity.type}: ${note.related_entity.name}`}
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ mb: 1.5, fontWeight: 600, maxWidth: '100%' }}
                      />
                    )}

                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        display: '-webkit-box',
                        WebkitLineClamp: 4,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.6,
                        mb: 2,
                      }}
                    >
                      {note.content}
                    </Typography>
                  </Box>

                  <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 1.5, mt: 'auto' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <PersonOutlineOutlinedIcon sx={{ fontSize: '0.85rem', color: 'text.secondary' }} />
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                          {note.author_name || 'System'}
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title="Edit Note">
                          <IconButton size="small" onClick={() => handleOpenEdit(note)}>
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Note">
                          <IconButton size="small" color="error" onClick={() => handleDeleteNote(note.id)}>
                            <DeleteOutlineOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Stack>
                  </Box>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* View Full Note Dialog */}
      <Dialog open={viewModalOpen} onClose={() => setViewModalOpen(false)} maxWidth="sm" fullWidth>
        {selectedNote && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {selectedNote.title || 'Untitled Note'}
              </Typography>
              {selectedNote.related_entity && (
                <Chip
                  icon={<LinkOutlinedIcon fontSize="small" />}
                  label={`${selectedNote.related_entity.type}: ${selectedNote.related_entity.name}`}
                  size="small"
                  color="primary"
                  variant="outlined"
                  sx={{ mt: 1, fontWeight: 600 }}
                />
              )}
            </DialogTitle>
            <DialogContent dividers>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                {selectedNote.content}
              </Typography>
              <Box sx={{ mt: 3, pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary">
                  Author: {selectedNote.author_name || 'System'} • Created: {new Date(selectedNote.created_at).toLocaleString()}
                </Typography>
              </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
              <Button color="error" startIcon={<DeleteOutlineOutlinedIcon />} onClick={() => handleDeleteNote(selectedNote.id)}>
                Delete
              </Button>
              <Stack direction="row" spacing={1}>
                <Button onClick={() => setViewModalOpen(false)}>Close</Button>
                <Button variant="contained" startIcon={<EditOutlinedIcon />} onClick={() => handleOpenEdit(selectedNote)}>
                  Edit
                </Button>
              </Stack>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Create / Edit Note Modal */}
      <Dialog open={createModalOpen} onClose={() => setCreateModalOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSaveNote}>
          <DialogTitle sx={{ fontWeight: 700 }}>
            {selectedNote ? 'Edit Note' : 'Create New Note'}
          </DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2.5}>
              <TextField
                fullWidth
                label="Note Title (Optional)"
                placeholder="e.g. Action items from client meeting..."
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />

              <TextField
                required
                fullWidth
                multiline
                rows={6}
                label="Note Content"
                placeholder="Write your note contents, thoughts, or meeting minutes..."
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setCreateModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? 'Saving...' : selectedNote ? 'Save Changes' : 'Save Note'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
