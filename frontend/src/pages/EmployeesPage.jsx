import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
  Chip,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Snackbar,
  CircularProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  InputAdornment,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import SearchIcon from '@mui/icons-material/Search';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import CorporateFareIcon from '@mui/icons-material/CorporateFare';

import PageHeader from '../components/common/PageHeader';
import EmptyState from '../components/common/EmptyState';
import LoadingState from '../components/common/LoadingState';
import StatCard from '../components/common/StatCard';
import employeeService from '../services/employeeService';
import { useCompany } from '../context/CompanyContext';
import { useNavigate } from 'react-router-dom';

const DEFAULT_DEPARTMENTS = [
  'Engineering',
  'Sales',
  'Marketing',
  'Finance',
  'Human Resources',
  'Operations',
  'Customer Success',
];

export default function EmployeesPage() {
  const navigate = useNavigate();
  const { activeCompany, companies } = useCompany();

  // Employee state
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusTab, setStatusTab] = useState(0); // 0 = Active, 1 = All, 2 = Inactive
  const [selectedDept, setSelectedDept] = useState('ALL');

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Form states
  const initialFormState = {
    employee_id: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    designation: '',
    department: '',
    joining_date: '',
  };
  const [formData, setFormData] = useState(initialFormState);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Action Menu state
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [menuEmployee, setMenuEmployee] = useState(null);

  // Feedback Snackbar
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const fetchEmployees = useCallback(async () => {
    if (!activeCompany?.id) {
      setEmployees([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      // Fetch all employees (including inactive) so tabs work smoothly
      const data = await employeeService.getEmployees(activeCompany.id, true);
      setEmployees(data);
    } catch (err) {
      console.error('Failed to load employees:', err);
      setError('Unable to load employee profiles for this company.');
    } finally {
      setLoading(false);
    }
  }, [activeCompany]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleMenuOpen = (event, emp) => {
    setMenuAnchorEl(event.currentTarget);
    setMenuEmployee(emp);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  // Validation
  const validateForm = (isEdit = false) => {
    const errors = {};
    if (!formData.first_name.trim()) errors.first_name = 'First name is required';
    if (!isEdit && !formData.employee_id.trim()) errors.employee_id = 'Employee ID is required';
    if (!formData.email?.trim()) {
      errors.email = 'Corporate email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Valid email address is required';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Add Employee Handler
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm(false)) return;

    try {
      setSubmitting(true);
      await employeeService.createEmployee(activeCompany.id, formData);
      showSnackbar('Employee added successfully!');
      setAddDialogOpen(false);
      setFormData(initialFormState);
      fetchEmployees();
    } catch (err) {
      console.error('Error adding employee:', err);
      const resData = err.response?.data;
      if (resData && typeof resData === 'object') {
        setFormErrors(resData);
      } else {
        showSnackbar('Failed to add employee.', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Dialog
  const handleOpenEdit = (emp) => {
    handleMenuClose();
    setSelectedEmployee(emp);
    setFormData({
      employee_id: emp.employee_id || '',
      first_name: emp.first_name || '',
      last_name: emp.last_name || '',
      email: emp.email || '',
      phone: emp.phone || '',
      designation: emp.designation || '',
      department: emp.department || '',
      joining_date: emp.joining_date || '',
    });
    setFormErrors({});
    setEditDialogOpen(true);
  };

  // Edit Employee Handler
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm(true)) return;

    try {
      setSubmitting(true);
      await employeeService.updateEmployee(activeCompany.id, selectedEmployee.id, formData);
      showSnackbar('Employee updated successfully!');
      setEditDialogOpen(false);
      fetchEmployees();
    } catch (err) {
      console.error('Error updating employee:', err);
      if (err.response?.data && typeof err.response.data === 'object') {
        setFormErrors(err.response.data);
      } else {
        showSnackbar('Failed to update employee.', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Open Deactivate Dialog
  const handleOpenDelete = (emp) => {
    handleMenuClose();
    setSelectedEmployee(emp);
    setDeleteDialogOpen(true);
  };

  // Deactivate Employee Handler
  const handleDeleteSubmit = async () => {
    try {
      setSubmitting(true);
      await employeeService.deleteEmployee(activeCompany.id, selectedEmployee.id);
      showSnackbar(`Employee "${selectedEmployee.first_name}" deactivated successfully.`);
      setDeleteDialogOpen(false);
      fetchEmployees();
    } catch (err) {
      console.error('Error deactivating employee:', err);
      showSnackbar('Failed to deactivate employee.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Reactivate Employee Handler
  const handleReactivate = async (emp) => {
    handleMenuClose();
    try {
      await employeeService.updateEmployee(activeCompany.id, emp.id, { is_active: true });
      showSnackbar(`Employee "${emp.first_name}" reactivated successfully.`);
      fetchEmployees();
    } catch (err) {
      console.error('Error reactivating employee:', err);
      showSnackbar('Failed to reactivate employee.', 'error');
    }
  };

  // Filter Employees
  const filteredEmployees = employees.filter((emp) => {
    const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      fullName.includes(query) ||
      (emp.employee_id && emp.employee_id.toLowerCase().includes(query)) ||
      (emp.email && emp.email.toLowerCase().includes(query)) ||
      (emp.designation && emp.designation.toLowerCase().includes(query)) ||
      (emp.department && emp.department.toLowerCase().includes(query));

    const matchesDept = selectedDept === 'ALL' || emp.department === selectedDept;

    if (statusTab === 0) return matchesSearch && matchesDept && emp.is_active;
    if (statusTab === 2) return matchesSearch && matchesDept && !emp.is_active;
    return matchesSearch && matchesDept;
  });

  const totalCount = employees.length;
  const activeCount = employees.filter((e) => e.is_active).length;
  const departments = [...new Set(employees.map((e) => e.department).filter(Boolean))];

  return (
    <Box>
      <PageHeader
        title="Employees"
        subtitle="Manage company staff, roles, designations, and departmental memberships."
        breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Employees' }]}
        action={
          <Stack direction="row" spacing={1.5} alignItems="center">
            {activeCompany && (
              <Chip
                icon={<CorporateFareIcon fontSize="small" />}
                label={`Tenant: ${activeCompany.name}`}
                variant="outlined"
                color="primary"
                sx={{ fontWeight: 600, display: { xs: 'none', sm: 'inline-flex' } }}
              />
            )}
            <Button
              variant="outlined"
              color="primary"
              startIcon={<RefreshIcon />}
              onClick={fetchEmployees}
              disabled={loading || !activeCompany}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              disabled={!activeCompany}
              onClick={() => {
                setFormData(initialFormState);
                setFormErrors({});
                setAddDialogOpen(true);
              }}
            >
              Add Employee
            </Button>
          </Stack>
        }
      />

      {/* No Company Selected Warning */}
      {!activeCompany && (
        <Alert
          severity="warning"
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={() => navigate('/companies')}>
              Go to Companies
            </Button>
          }
        >
          No active company selected. Please register or select an active company to browse and manage employee profiles.
        </Alert>
      )}

      {/* KPI Stats */}
      {activeCompany && (
        <Grid container spacing={2.5} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={4}>
            <StatCard
              title="Total Staff"
              value={totalCount}
              subtitle={`Enrolled under ${activeCompany.name}`}
              icon={BadgeOutlinedIcon}
              color="#1e3a8a"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <StatCard
              title="Active Employees"
              value={activeCount}
              subtitle="Operational headcount"
              icon={CheckCircleOutlineIcon}
              color="#10b981"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <StatCard
              title="Departments"
              value={departments.length}
              subtitle="Functional units represented"
              icon={BusinessOutlinedIcon}
              color="#0284c7"
            />
          </Grid>
        </Grid>
      )}

      {/* Main Content Card */}
      <Card sx={{ boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)' }}>
        <CardContent sx={{ p: 3 }}>
          {/* Search and Filters Toolbar */}
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', md: 'center' }}
            spacing={2}
            sx={{ mb: 3 }}
          >
            <Tabs
              value={statusTab}
              onChange={(e, val) => setStatusTab(val)}
              sx={{
                minHeight: 38,
                '& .MuiTab-root': { minHeight: 38, py: 0.5, px: 2, fontSize: '0.85rem', textTransform: 'none', fontWeight: 600 },
              }}
            >
              <Tab label={`Active (${activeCount})`} />
              <Tab label={`All (${totalCount})`} />
              <Tab label={`Inactive (${totalCount - activeCount})`} />
            </Tabs>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              {departments.length > 0 && (
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Department</InputLabel>
                  <Select
                    value={selectedDept}
                    label="Department"
                    onChange={(e) => setSelectedDept(e.target.value)}
                  >
                    <MenuItem value="ALL">All Departments</MenuItem>
                    {departments.map((d) => (
                      <MenuItem key={d} value={d}>{d}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              <TextField
                placeholder="Search by ID, name, designation..."
                size="small"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{ width: { xs: '100%', sm: 260 } }}
              />
            </Stack>
          </Stack>

          {/* Error State */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} action={
              <Button color="inherit" size="small" onClick={fetchEmployees}>Retry</Button>
            }>
              {error}
            </Alert>
          )}

          {/* Loading State */}
          {loading ? (
            <LoadingState message="Loading employee directory from PostgreSQL..." />
          ) : !activeCompany ? (
            <EmptyState
              icon={BadgeOutlinedIcon}
              title="No Company Selected"
              description="Select or create a company to view and manage employee profiles."
              actionLabel="Manage Companies"
              onAction={() => navigate('/companies')}
            />
          ) : filteredEmployees.length === 0 ? (
            /* Empty State */
            <EmptyState
              icon={BadgeOutlinedIcon}
              title={searchQuery ? 'No Matching Employees' : 'No Employees Enrolled'}
              description={
                searchQuery
                  ? `No employee profiles matched "${searchQuery}".`
                  : `Add your first employee profile for ${activeCompany.name}.`
              }
              actionLabel="Add Employee"
              onAction={() => {
                setFormData(initialFormState);
                setFormErrors({});
                setAddDialogOpen(true);
              }}
            />
          ) : (
            /* Employees Table */
            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
              <Table sx={{ minWidth: 700 }}>
                <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }}>EMP ID</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }}>STAFF MEMBER</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }}>DESIGNATION & DEPT</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }}>CONTACT</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }}>JOINING DATE</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }} align="center">STATUS</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }} align="right">ACTIONS</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredEmployees.map((emp) => (
                    <TableRow key={emp.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                      <TableCell>
                        <Chip
                          label={emp.employee_id}
                          size="small"
                          sx={{ fontWeight: 700, backgroundColor: '#eff6ff', color: '#1d4ed8' }}
                        />
                      </TableCell>

                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                          <Box
                            sx={{
                              width: 34,
                              height: 34,
                              borderRadius: '50%',
                              backgroundColor: emp.is_active ? '#e0e7ff' : '#f1f5f9',
                              color: emp.is_active ? '#4338ca' : '#94a3b8',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.85rem',
                            }}
                          >
                            {(emp.first_name || 'E').charAt(0).toUpperCase()}
                          </Box>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>
                              {emp.first_name} {emp.last_name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              @{emp.username || 'user'}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>

                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155' }}>
                          {emp.designation || 'Staff Member'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {emp.department || 'General'}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        <Typography variant="body2" sx={{ color: '#334155' }}>
                          {emp.email || '—'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {emp.phone || 'No phone'}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        <Typography variant="body2" sx={{ color: '#475569' }}>
                          {emp.joining_date ? new Date(emp.joining_date).toLocaleDateString() : '—'}
                        </Typography>
                      </TableCell>

                      <TableCell align="center">
                        <Chip
                          label={emp.is_active ? 'Active' : 'Inactive'}
                          color={emp.is_active ? 'success' : 'default'}
                          size="small"
                          sx={{ fontWeight: 600, fontSize: '0.75rem', height: 24 }}
                        />
                      </TableCell>

                      <TableCell align="right">
                        <Tooltip title="Actions">
                          <IconButton size="small" onClick={(e) => handleMenuOpen(e, emp)}>
                            <MoreVertIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Row Actions Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{ sx: { width: 170, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' } }}
      >
        <MenuItem onClick={() => handleOpenEdit(menuEmployee)}>
          <ListItemIcon><EditOutlinedIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Edit Profile" />
        </MenuItem>

        {menuEmployee?.is_active ? (
          <MenuItem onClick={() => handleOpenDelete(menuEmployee)} sx={{ color: 'error.main' }}>
            <ListItemIcon><DeleteOutlineOutlinedIcon fontSize="small" color="error" /></ListItemIcon>
            <ListItemText primary="Deactivate" />
          </MenuItem>
        ) : (
          <MenuItem onClick={() => handleReactivate(menuEmployee)} sx={{ color: 'success.main' }}>
            <ListItemIcon><CheckCircleOutlineIcon fontSize="small" color="success" /></ListItemIcon>
            <ListItemText primary="Reactivate" />
          </MenuItem>
        )}
      </Menu>

      {/* ADD EMPLOYEE DIALOG */}
      <Dialog open={addDialogOpen} onClose={() => !submitting && setAddDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          Add Employee to {activeCompany?.name}
        </DialogTitle>
        <form onSubmit={handleAddSubmit}>
          <DialogContent dividers>
            <Grid container spacing={2.5}>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Employee ID"
                  required
                  fullWidth
                  value={formData.employee_id}
                  onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                  error={Boolean(formErrors.employee_id)}
                  helperText={formErrors.employee_id}
                  placeholder="e.g. EMP-101"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="First Name"
                  required
                  fullWidth
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  error={Boolean(formErrors.first_name)}
                  helperText={formErrors.first_name}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Last Name"
                  fullWidth
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  error={Boolean(formErrors.last_name)}
                  helperText={formErrors.last_name}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Corporate Email"
                  type="email"
                  required
                  fullWidth
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  error={Boolean(formErrors.email)}
                  helperText={formErrors.email || 'Will link or create associated ERP user'}
                  placeholder="e.g. employee@company.com"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Phone Number"
                  fullWidth
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  error={Boolean(formErrors.phone)}
                  helperText={formErrors.phone}
                  placeholder="e.g. +1-555-0199"
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <TextField
                  label="Department"
                  fullWidth
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  placeholder="e.g. Engineering"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Designation"
                  fullWidth
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  placeholder="e.g. Senior Developer"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Joining Date"
                  type="date"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={formData.joining_date}
                  onChange={(e) => setFormData({ ...formData, joining_date: e.target.value })}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setAddDialogOpen(false)} disabled={submitting}>Cancel</Button>
            <Button type="submit" variant="contained" color="primary" disabled={submitting} startIcon={submitting && <CircularProgress size={16} />}>
              {submitting ? 'Adding...' : 'Add Employee'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* EDIT EMPLOYEE DIALOG */}
      <Dialog open={editDialogOpen} onClose={() => !submitting && setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Edit Employee Profile</DialogTitle>
        <form onSubmit={handleEditSubmit}>
          <DialogContent dividers>
            <Grid container spacing={2.5}>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Employee ID"
                  disabled
                  fullWidth
                  value={formData.employee_id}
                  helperText="ID cannot be changed"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="First Name"
                  required
                  fullWidth
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  error={Boolean(formErrors.first_name)}
                  helperText={formErrors.first_name}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Last Name"
                  fullWidth
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  error={Boolean(formErrors.last_name)}
                  helperText={formErrors.last_name}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Corporate Email"
                  type="email"
                  required
                  fullWidth
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  error={Boolean(formErrors.email)}
                  helperText={formErrors.email}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Phone Number"
                  fullWidth
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  error={Boolean(formErrors.phone)}
                  helperText={formErrors.phone}
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <TextField
                  label="Department"
                  fullWidth
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Designation"
                  fullWidth
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Joining Date"
                  type="date"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={formData.joining_date}
                  onChange={(e) => setFormData({ ...formData, joining_date: e.target.value })}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setEditDialogOpen(false)} disabled={submitting}>Cancel</Button>
            <Button type="submit" variant="contained" color="primary" disabled={submitting} startIcon={submitting && <CircularProgress size={16} />}>
              {submitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* DEACTIVATE CONFIRMATION DIALOG */}
      <Dialog open={deleteDialogOpen} onClose={() => !submitting && setDeleteDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: 'error.main' }}>Deactivate Employee?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Are you sure you want to deactivate employee <strong>{selectedEmployee?.first_name} {selectedEmployee?.last_name}</strong> ({selectedEmployee?.employee_id})?
            The employee will remain in historical database records but will be marked inactive.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleDeleteSubmit} variant="contained" color="error" disabled={submitting} startIcon={submitting && <CircularProgress size={16} />}>
            {submitting ? 'Deactivating...' : 'Deactivate'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notification Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%', fontWeight: 600 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
