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
  Divider,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';

import { useCompany } from '../context/CompanyContext';
import { useAuth } from '../hooks/useAuth';
import workspaceService from '../services/workspaceService';

export default function WorkspacePage() {
  const { activeCompany, activeCompanyId } = useCompany();
  const { user } = useAuth();

  const [workspaceData, setWorkspaceData] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Add Member Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newRole, setNewRole] = useState('Employee');
  const [addError, setAddError] = useState(null);

  // Edit Role Modal
  const [editMember, setEditMember] = useState(null);
  const [selectedRole, setSelectedRole] = useState('');

  // Check if current user is admin in this workspace
  const isAdmin = Boolean(
    workspaceData?.is_admin ||
      user?.is_superuser ||
      user?.companies?.find((c) => c.id === activeCompanyId)?.role === 'Company Admin'
  );

  const loadWorkspace = useCallback(async () => {
    if (!activeCompanyId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const [ws, mems] = await Promise.all([
        workspaceService.getWorkspace(activeCompanyId),
        workspaceService.getMembers(activeCompanyId, {
          search: search || undefined,
          role: roleFilter || undefined,
        }),
      ]);
      setWorkspaceData(ws);
      setMembers(mems);
    } catch (err) {
      console.error('Failed to load workspace:', err);
      setError(err.response?.data?.detail || 'Failed to load workspace data.');
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId, search, roleFilter]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

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
      loadWorkspace();
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
      loadWorkspace();
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
      loadWorkspace();
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
      loadWorkspace();
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
          Please select an active company from the header dropdown to view workspace collaboration.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: 'auto' }}>
      {/* Page Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
            Workspace & Collaboration
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            Collaborate with team members, manage permissions, and track organization activity.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshOutlinedIcon />}
            onClick={loadWorkspace}
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
        </Box>
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

      {/* Overview Stat Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
              <Avatar sx={{ bgcolor: '#eff6ff', color: 'primary.main', width: 48, height: 48 }}>
                <BusinessOutlinedIcon />
              </Avatar>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  WORKSPACE
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary' }} noWrap>
                  {workspaceData?.company?.name || activeCompany?.name}
                </Typography>
                <Chip
                  label={workspaceData?.workspace_status || 'Active'}
                  size="small"
                  color="success"
                  sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, mt: 0.5 }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
              <Avatar sx={{ bgcolor: '#f0fdf4', color: '#16a34a', width: 48, height: 48 }}>
                <PeopleAltOutlinedIcon />
              </Avatar>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  TOTAL MEMBERS
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  {workspaceData?.member_count ?? members.length}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Team capacity
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
              <Avatar sx={{ bgcolor: '#fef3c7', color: '#d97706', width: 48, height: 48 }}>
                <CheckCircleOutlineOutlinedIcon />
              </Avatar>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  ACTIVE MEMBERS
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  {workspaceData?.active_member_count ?? members.filter((m) => m.is_active).length}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Operational now
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
              <Avatar sx={{ bgcolor: '#f3e8ff', color: '#9333ea', width: 48, height: 48 }}>
                <ManageAccountsOutlinedIcon />
              </Avatar>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  YOUR ROLE
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  {workspaceData?.current_user_role || (isAdmin ? 'Company Admin' : 'Employee')}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {isAdmin ? 'Full Workspace Admin' : 'Read & Standard Ops'}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Content: Members Table & Activity Log */}
      <Grid container spacing={3}>
        {/* Members Table */}
        <Grid item xs={12} lg={8}>
          <Card sx={{ borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
            <Box sx={{ p: 2.5, borderBottom: '1px solid #e2e8f0' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
                  Workspace Members ({members.length})
                </Typography>
              </Box>

              {/* Filters */}
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <TextField
                  size="small"
                  placeholder="Search members..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
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
                    value={roleFilter}
                    label="Role Filter"
                    onChange={(e) => setRoleFilter(e.target.value)}
                  >
                    <MenuItem value="">All Roles</MenuItem>
                    <MenuItem value="Company Admin">Company Admin</MenuItem>
                    <MenuItem value="Employee">Employee</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </Box>

            <TableContainer component={Paper} elevation={0}>
              <Table size="medium">
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem', color: 'text.secondary' }}>
                      MEMBER
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem', color: 'text.secondary' }}>
                      ROLE
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem', color: 'text.secondary' }}>
                      STATUS
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem', color: 'text.secondary' }}>
                      JOINED
                    </TableCell>
                    {isAdmin && (
                      <TableCell
                        align="right"
                        sx={{ fontWeight: 600, fontSize: '0.8rem', color: 'text.secondary' }}
                      >
                        ACTIONS
                      </TableCell>
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
                          No workspace members found matching your search.
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
                                bgcolor: roleName === 'Company Admin' ? '#eff6ff' : '#f1f5f9',
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
          </Card>
        </Grid>

        {/* Activity Feed */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
            <Box sx={{ p: 2.5, borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 1 }}>
              <HistoryOutlinedIcon sx={{ color: 'primary.main', fontSize: 22 }} />
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
                Recent Activity
              </Typography>
            </Box>
            <CardContent sx={{ p: 2 }}>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : !workspaceData?.recent_activities || workspaceData.recent_activities.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 4 }}>
                  No recent activity logged.
                </Typography>
              ) : (
                workspaceData.recent_activities.map((act) => (
                  <Box key={act.id} sx={{ mb: 2, pb: 1.5, borderBottom: '1px solid #f1f5f9' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', fontSize: '0.85rem' }}>
                      {act.details}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                      <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600 }}>
                        {act.user_name || act.user?.username || 'System'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {act.created_at ? new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </Typography>
                    </Box>
                  </Box>
                ))
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

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
