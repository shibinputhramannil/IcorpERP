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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Avatar,
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
  Tabs,
  Tab,
  Stack,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import NoteAltOutlinedIcon from '@mui/icons-material/NoteAltOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import DashboardCustomizeOutlinedIcon from '@mui/icons-material/DashboardCustomizeOutlined';

import { useCompany } from '../context/CompanyContext';
import { useAuth } from '../hooks/useAuth';
import workspaceService from '../services/workspaceService';

import WorkspaceOverview from '../components/workspace/WorkspaceOverview';
import WorkspaceNotes from '../components/workspace/WorkspaceNotes';
import WorkspaceMail from '../components/workspace/WorkspaceMail';
import WorkspaceDocuments from '../components/workspace/WorkspaceDocuments';
import WorkspaceActivityFeed from '../components/workspace/WorkspaceActivityFeed';

export default function WorkspacePage() {
  const { activeCompany, activeCompanyId } = useCompany();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState(0);
  const [collabOverview, setCollabOverview] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Quick Action triggers across tabs
  const [triggerNewNote, setTriggerNewNote] = useState(false);
  const [triggerComposeMail, setTriggerComposeMail] = useState(false);
  const [triggerUploadDoc, setTriggerUploadDoc] = useState(false);

  // Members filters
  const [memberSearch, setMemberSearch] = useState('');
  const [memberRoleFilter, setMemberRoleFilter] = useState('');

  // Add Member Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newRole, setNewRole] = useState('Employee');
  const [addError, setAddError] = useState(null);

  // Edit Role Modal
  const [editMember, setEditMember] = useState(null);
  const [selectedRole, setSelectedRole] = useState('');

  // Admin permission check
  const isAdmin = Boolean(
    user?.is_superuser ||
      user?.companies?.find((c) => c.id === activeCompanyId)?.role === 'Company Admin'
  );

  const loadData = useCallback(async () => {
    if (!activeCompanyId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);

      const [overviewData, membersData] = await Promise.all([
        workspaceService.getCollaborationOverview(activeCompanyId),
        workspaceService.getMembers(activeCompanyId, {
          search: memberSearch || undefined,
          role: memberRoleFilter || undefined,
        }),
      ]);

      setCollabOverview(overviewData);
      setMembers(membersData);
    } catch (err) {
      console.error('Failed to load workspace collaboration data:', err);
      setError('Failed to load workspace data.');
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId, memberSearch, memberRoleFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Tab switch handler
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setError(null);
    setSuccessMsg(null);
  };

  // Quick Action Navigation Handlers
  const handleQuickNewNote = () => {
    setActiveTab(1); // Notes tab
    setTriggerNewNote(true);
  };

  const handleQuickComposeMail = () => {
    setActiveTab(2); // Mail tab
    setTriggerComposeMail(true);
  };

  const handleQuickUploadDoc = () => {
    setActiveTab(3); // Documents tab
    setTriggerUploadDoc(true);
  };

  const handleQuickAddMember = () => {
    setActiveTab(5); // Members tab
    setAddError(null);
    setAddModalOpen(true);
  };

  // Member Management Handlers
  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newUsername.trim()) {
      setAddError('Username is required.');
      return;
    }
    try {
      setActionLoading(true);
      setAddError(null);
      await workspaceService.addMember(activeCompanyId, {
        username: newUsername.trim(),
        role: newRole,
      });
      setSuccessMsg(`Successfully added ${newUsername} to workspace.`);
      setAddModalOpen(false);
      setNewUsername('');
      setNewRole('Employee');
      loadData();
    } catch (err) {
      const msg = err.response?.data?.username?.[0] || err.response?.data?.detail || 'Failed to add member.';
      setAddError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!editMember || !selectedRole) return;
    try {
      setActionLoading(true);
      await workspaceService.updateMember(activeCompanyId, editMember.id, {
        role: selectedRole,
      });
      setSuccessMsg(`Updated role for ${editMember.username || editMember.user_name} to ${selectedRole}.`);
      setEditMember(null);
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update member role.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleActive = async (member) => {
    const newStatus = !member.is_active;
    try {
      setActionLoading(true);
      await workspaceService.updateMember(activeCompanyId, member.id, {
        is_active: newStatus,
      });
      setSuccessMsg(
        `${newStatus ? 'Activated' : 'Deactivated'} ${member.username || member.user_name}.`
      );
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = async (member) => {
    const displayName = member.username || member.user_name;
    if (!window.confirm(`Are you sure you want to remove ${displayName} from this company?`)) {
      return;
    }
    try {
      setActionLoading(true);
      await workspaceService.removeMember(activeCompanyId, member.id, false);
      setSuccessMsg(`Removed ${displayName} from workspace.`);
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to remove member.');
    } finally {
      setActionLoading(false);
    }
  };

  if (!activeCompanyId) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          Please select an active company from the header dropdown to access the Workspace Collaboration Hub.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
              Workspace Collaboration
            </Typography>
            <Chip
              label={activeCompany?.name || 'Company'}
              size="small"
              color="primary"
              variant="outlined"
              sx={{ fontWeight: 600, fontSize: '0.75rem' }}
            />
          </Box>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            Central enterprise hub for team notes, correspondence, document archives, and members.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshOutlinedIcon />}
            onClick={loadData}
            disabled={loading}
          >
            Refresh
          </Button>
          {isAdmin && (
            <Button
              variant="contained"
              size="small"
              startIcon={<PersonAddOutlinedIcon />}
              onClick={() => {
                setAddError(null);
                setAddModalOpen(true);
              }}
            >
              Add Member
            </Button>
          )}
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

      {/* 6 Tabs Navigation */}
      <Card sx={{ borderRadius: 2, border: 1, borderColor: 'divider', boxShadow: 'none', mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
        >
          <Tab
            icon={<DashboardCustomizeOutlinedIcon sx={{ fontSize: 20 }} />}
            iconPosition="start"
            label="Overview"
            sx={{ textTransform: 'none', fontWeight: 600, minHeight: 48 }}
          />
          <Tab
            icon={<NoteAltOutlinedIcon sx={{ fontSize: 20 }} />}
            iconPosition="start"
            label="Notes"
            sx={{ textTransform: 'none', fontWeight: 600, minHeight: 48 }}
          />
          <Tab
            icon={<EmailOutlinedIcon sx={{ fontSize: 20 }} />}
            iconPosition="start"
            label="Mail"
            sx={{ textTransform: 'none', fontWeight: 600, minHeight: 48 }}
          />
          <Tab
            icon={<DescriptionOutlinedIcon sx={{ fontSize: 20 }} />}
            iconPosition="start"
            label="Documents"
            sx={{ textTransform: 'none', fontWeight: 600, minHeight: 48 }}
          />
          <Tab
            icon={<HistoryOutlinedIcon sx={{ fontSize: 20 }} />}
            iconPosition="start"
            label="Activity"
            sx={{ textTransform: 'none', fontWeight: 600, minHeight: 48 }}
          />
          <Tab
            icon={<PeopleAltOutlinedIcon sx={{ fontSize: 20 }} />}
            iconPosition="start"
            label="Members"
            sx={{ textTransform: 'none', fontWeight: 600, minHeight: 48 }}
          />
        </Tabs>

        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          {/* TAB 0: OVERVIEW */}
          {activeTab === 0 && (
            <WorkspaceOverview
              collabData={collabOverview}
              onTabChange={(tabIndex) => setActiveTab(tabIndex)}
              onOpenNewNote={handleQuickNewNote}
              onOpenComposeMail={handleQuickComposeMail}
              onOpenUploadDoc={handleQuickUploadDoc}
              onOpenAddMember={handleQuickAddMember}
              isAdmin={isAdmin}
            />
          )}

          {/* TAB 1: NOTES */}
          {activeTab === 1 && (
            <WorkspaceNotes
              companyId={activeCompanyId}
              externalOpenNew={triggerNewNote}
              onNewOpened={() => setTriggerNewNote(false)}
            />
          )}

          {/* TAB 2: MAIL */}
          {activeTab === 2 && (
            <WorkspaceMail
              companyId={activeCompanyId}
              externalOpenCompose={triggerComposeMail}
              onComposeOpened={() => setTriggerComposeMail(false)}
            />
          )}

          {/* TAB 3: DOCUMENTS */}
          {activeTab === 3 && (
            <WorkspaceDocuments
              companyId={activeCompanyId}
              externalOpenUpload={triggerUploadDoc}
              onUploadOpened={() => setTriggerUploadDoc(false)}
              isAdmin={isAdmin}
            />
          )}

          {/* TAB 4: ACTIVITY */}
          {activeTab === 4 && (
            <WorkspaceActivityFeed companyId={activeCompanyId} />
          )}

          {/* TAB 5: MEMBERS */}
          {activeTab === 5 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Workspace Members ({members.length})
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Manage company roles, employee access, and permissions.
                  </Typography>
                </Box>
                {isAdmin && (
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<PersonAddOutlinedIcon />}
                    onClick={() => {
                      setAddError(null);
                      setAddModalOpen(true);
                    }}
                  >
                    Add Member
                  </Button>
                )}
              </Box>

              {/* Filters */}
              <Card sx={{ borderRadius: 2, border: 1, borderColor: 'divider', boxShadow: 'none', mb: 3 }}>
                <Box sx={{ p: 1.5, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <TextField
                    size="small"
                    placeholder="Search members..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    sx={{ width: { xs: '100%', sm: 260 } }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                        </InputAdornment>
                      ),
                    }}
                  />
                  <FormControl size="small" sx={{ width: { xs: '100%', sm: 160 } }}>
                    <InputLabel>Role Filter</InputLabel>
                    <Select
                      value={memberRoleFilter}
                      label="Role Filter"
                      onChange={(e) => setMemberRoleFilter(e.target.value)}
                    >
                      <MenuItem value="">All Roles</MenuItem>
                      <MenuItem value="Company Admin">Company Admin</MenuItem>
                      <MenuItem value="Employee">Employee</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              </Card>

              {/* Members Table */}
              <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 2 }}>
                <Table size="medium">
                  <TableHead sx={{ bgcolor: 'background.subtle' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem', color: 'text.secondary' }}>MEMBER</TableCell>
                      <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem', color: 'text.secondary' }}>ROLE</TableCell>
                      <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem', color: 'text.secondary' }}>STATUS</TableCell>
                      <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem', color: 'text.secondary' }}>JOINED</TableCell>
                      {isAdmin && (
                        <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.8rem', color: 'text.secondary' }}>ACTIONS</TableCell>
                      )}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={isAdmin ? 5 : 4} align="center" sx={{ py: 6 }}>
                          <CircularProgress size={30} />
                        </TableCell>
                      </TableRow>
                    ) : members.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={isAdmin ? 5 : 4} align="center" sx={{ py: 6 }}>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            No workspace members found.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      members.map((m) => {
                        const uname = m.username || m.user_name || 'user';
                        const email = m.email || '';
                        const roleName = m.role_name || (typeof m.role === 'string' ? m.role : m.role?.name) || 'Employee';
                        const isActive = m.is_active !== false;

                        return (
                          <TableRow key={m.id} hover>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <Avatar
                                  sx={{
                                    width: 36,
                                    height: 36,
                                    bgcolor: roleName === 'Company Admin' ? '#1e3a8a' : '#2563eb',
                                    fontSize: '0.9rem',
                                    fontWeight: 700,
                                  }}
                                >
                                  {uname.charAt(0).toUpperCase()}
                                </Avatar>
                                <Box>
                                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                    {m.first_name ? `${m.first_name} ${m.last_name || ''}` : uname}
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    {email || `@${uname}`}
                                  </Typography>
                                </Box>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={roleName}
                                size="small"
                                sx={{
                                  fontWeight: 600,
                                  fontSize: '0.75rem',
                                  bgcolor: roleName === 'Company Admin' ? (theme => theme.palette.mode === 'dark' ? 'rgba(59,130,246,0.15)' : '#eff6ff') : 'background.subtle',
                                  color: roleName === 'Company Admin' ? '#1d4ed8' : '#475569',
                                  border: '1px solid',
                                  borderColor: roleName === 'Company Admin' ? '#bfdbfe' : '#cbd5e1',
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={isActive ? 'Active' : 'Inactive'}
                                size="small"
                                color={isActive ? 'success' : 'default'}
                                sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600 }}
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                {m.joined_date || (m.created_at ? new Date(m.created_at).toLocaleDateString() : '—')}
                              </Typography>
                            </TableCell>
                            {isAdmin && (
                              <TableCell align="right">
                                <Box sx={{ display: 'inline-flex', gap: 0.5 }}>
                                  <Tooltip title="Change Role">
                                    <IconButton
                                      size="small"
                                      onClick={() => {
                                        setEditMember(m);
                                        setSelectedRole(roleName);
                                      }}
                                    >
                                      <ManageAccountsOutlinedIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title={isActive ? 'Deactivate Member' : 'Activate Member'}>
                                    <IconButton
                                      size="small"
                                      color={isActive ? 'warning' : 'success'}
                                      onClick={() => handleToggleActive(m)}
                                    >
                                      <BlockOutlinedIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Remove Member">
                                    <IconButton
                                      size="small"
                                      color="error"
                                      onClick={() => handleRemoveMember(m)}
                                    >
                                      <DeleteOutlineOutlinedIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </Box>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Add Member Dialog */}
      <Dialog open={addModalOpen} onClose={() => setAddModalOpen(false)} maxWidth="xs" fullWidth>
        <form onSubmit={handleAddMember}>
          <DialogTitle sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
            Add Member to Workspace
          </DialogTitle>
          <DialogContent>
            {addError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {addError}
              </Alert>
            )}
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
              Add an existing registered user to {activeCompany?.name || 'this company'}.
            </Typography>
            <TextField
              label="Username or Email"
              fullWidth
              size="small"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              sx={{ mb: 2 }}
              required
              autoFocus
            />
            <FormControl fullWidth size="small">
              <InputLabel>Role</InputLabel>
              <Select
                value={newRole}
                label="Role"
                onChange={(e) => setNewRole(e.target.value)}
              >
                <MenuItem value="Employee">Employee</MenuItem>
                <MenuItem value="Company Admin">Company Admin</MenuItem>
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setAddModalOpen(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={actionLoading}
              startIcon={actionLoading ? <CircularProgress size={16} /> : null}
            >
              Add Member
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={Boolean(editMember)} onClose={() => setEditMember(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
          Change Member Role
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Select a new role for <strong>{editMember?.username || editMember?.user_name}</strong>.
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel>Role</InputLabel>
            <Select
              value={selectedRole}
              label="Role"
              onChange={(e) => setSelectedRole(e.target.value)}
            >
              <MenuItem value="Employee">Employee</MenuItem>
              <MenuItem value="Company Admin">Company Admin</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEditMember(null)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleUpdateRole}
            disabled={actionLoading}
            startIcon={actionLoading ? <CircularProgress size={16} /> : null}
          >
            Update Role
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
