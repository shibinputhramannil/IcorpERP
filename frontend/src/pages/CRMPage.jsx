import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Card, CardContent, Stack, Typography, Chip, Grid,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert, CircularProgress, Menu, MenuItem, ListItemIcon, ListItemText,
  InputAdornment, Tabs, Tab, FormControl, InputLabel, Select, Divider, Drawer,
  List, ListItem
} from '@mui/material';

// Icons
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import ContactPhoneOutlinedIcon from '@mui/icons-material/ContactPhoneOutlined';
import HandshakeOutlinedIcon from '@mui/icons-material/HandshakeOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import SearchIcon from '@mui/icons-material/Search';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import RefreshIcon from '@mui/icons-material/Refresh';
import TransformOutlinedIcon from '@mui/icons-material/TransformOutlined';
import MonetizationOnOutlinedIcon from '@mui/icons-material/MonetizationOnOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';

import PageHeader from '../components/common/PageHeader';
import EmptyState from '../components/common/EmptyState';
import LoadingState from '../components/common/LoadingState';
import StatCard from '../components/common/StatCard';
import crmService from '../services/crmService';
import { useCompany } from '../context/CompanyContext';
import { extractErrorMessage } from '../utils/errorUtils';

const DEAL_STAGES = ['Discovery', 'Proposal', 'Negotiation', 'Won', 'Lost'];
const DEAL_STAGE_COLORS = { Discovery: 'info', Proposal: 'secondary', Negotiation: 'warning', Won: 'success', Lost: 'error' };

const ACTIVITY_TYPE_ICONS = {
  Note: <AssignmentOutlinedIcon fontSize="small" />,
  Call: <PhoneOutlinedIcon fontSize="small" />,
  Meeting: <EventNoteOutlinedIcon fontSize="small" />,
  Task: <CheckCircleOutlinedIcon fontSize="small" />,
  Email: <EmailOutlinedIcon fontSize="small" />,
  'Follow-up': <ArrowForwardIosIcon fontSize="small" />
};

export default function CRMPage() {
  const { activeCompany } = useCompany();
  const [currentTab, setCurrentTab] = useState(0);

  // Data states
  const [leads, setLeads] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [deals, setDeals] = useState([]);
  const [activities, setActivities] = useState([]);

  // UI States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Dialog States
  const [customer360Open, setCustomer360Open] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  
  // Create / Edit Form States
  const [formOpen, setFormOpen] = useState(false);
  const [formType, setFormType] = useState(null); // 'lead', 'deal', 'customer', 'contact', 'activity'
  const [formData, setFormData] = useState({});
  const [isEdit, setIsEdit] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Delete Confirmation States
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // { id, type }

  // Action Menu States
  const [anchorEl, setAnchorEl] = useState(null);
  const [menuTarget, setMenuTarget] = useState(null); // { id, type, data }

  const fetchData = useCallback(async () => {
    if (!activeCompany?.id) return;
    try {
      setLoading(true);
      setError(null);
      const [leadsRes, custsRes, contactsRes, dealsRes, actsRes] = await Promise.all([
        crmService.getLeads(activeCompany.id, { all: 'true' }),
        crmService.getCustomers(activeCompany.id, { all: 'true' }),
        crmService.getContacts(activeCompany.id, { all: 'true' }),
        crmService.getDeals(activeCompany.id, { all: 'true' }),
        crmService.getActivities(activeCompany.id, { all: 'true' })
      ]);
      setLeads(Array.isArray(leadsRes) ? leadsRes : leadsRes?.results || []);
      setCustomers(Array.isArray(custsRes) ? custsRes : custsRes?.results || []);
      setContacts(Array.isArray(contactsRes) ? contactsRes : contactsRes?.results || []);
      setDeals(Array.isArray(dealsRes?.deals) ? dealsRes.deals : Array.isArray(dealsRes) ? dealsRes : []);
      setActivities(Array.isArray(actsRes) ? actsRes : actsRes?.results || []);
    } catch (err) {
      setError('Unable to load CRM data.');
    } finally {
      setLoading(false);
    }
  }, [activeCompany]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Kanban Handlers
  const handleDragStart = (e, dealId) => { e.dataTransfer.setData('dealId', dealId); };
  const handleDragOver = (e) => { e.preventDefault(); };
  const handleDrop = async (e, stage) => {
    const dealId = e.dataTransfer.getData('dealId');
    if (!dealId) return;
    try {
      const deal = deals.find(d => d.id == dealId);
      if (deal && deal.stage !== stage) {
        let prob = deal.probability;
        if(stage === 'Won') prob = 100;
        else if(stage === 'Lost') prob = 0;
        await crmService.updateDeal(activeCompany.id, dealId, { stage, probability: prob });
        fetchData();
      }
    } catch (err) { console.error(err); }
  };

  const handleOpen360 = (customer) => {
    setSelectedCustomer(customer);
    setCustomer360Open(true);
  };

  // Menu Handlers
  const openMenu = (e, item, type) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
    setMenuTarget({ id: item.id, type, data: item });
  };
  const closeMenu = () => {
    setAnchorEl(null);
    setMenuTarget(null);
  };

  // Form Handlers
  const openForm = (type, data = null) => {
    setFormType(type);
    setIsEdit(!!data);
    setFormData(data || {});
    setFormError(null);
    setFormOpen(true);
    closeMenu();
  };

  const closeForm = () => {
    setFormOpen(false);
    setFormType(null);
    setFormData({});
    setFormError(null);
  };

  const handleFormChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFormSubmit = async () => {
    setFormSubmitting(true);
    setFormError(null);
    try {
      if (formType === 'lead') {
        isEdit ? await crmService.updateLead(activeCompany.id, formData.id, formData)
               : await crmService.createLead(activeCompany.id, formData);
      } else if (formType === 'deal') {
        isEdit ? await crmService.updateDeal(activeCompany.id, formData.id, formData)
               : await crmService.createDeal(activeCompany.id, formData);
      } else if (formType === 'customer') {
        isEdit ? await crmService.updateCustomer(activeCompany.id, formData.id, formData)
               : await crmService.createCustomer(activeCompany.id, formData);
      } else if (formType === 'contact') {
        isEdit ? await crmService.updateContact(activeCompany.id, formData.id, formData)
               : await crmService.createContact(activeCompany.id, formData);
      } else if (formType === 'activity') {
        isEdit ? await crmService.updateActivity(activeCompany.id, formData.id, formData)
               : await crmService.createActivity(activeCompany.id, formData);
      }
      fetchData();
      closeForm();
    } catch (err) {
      setFormError(extractErrorMessage(err));
    } finally {
      setFormSubmitting(false);
    }
  };

  // Delete Handlers
  const requestDelete = (target = null) => {
    setDeleteTarget(target || menuTarget);
    setDeleteOpen(true);
    closeMenu();
  };

  const confirmDelete = async () => {
    try {
      const { id, type } = deleteTarget;
      if (type === 'lead') await crmService.deleteLead(activeCompany.id, id);
      else if (type === 'deal') await crmService.deleteDeal(activeCompany.id, id);
      else if (type === 'customer') await crmService.deleteCustomer(activeCompany.id, id);
      else if (type === 'contact') await crmService.deleteContact(activeCompany.id, id);
      else if (type === 'activity') await crmService.deleteActivity(activeCompany.id, id);
      
      fetchData();
      setDeleteOpen(false);
      setDeleteTarget(null);
      if (customer360Open && type === 'customer' && selectedCustomer?.id === id) {
        setCustomer360Open(false);
      }
    } catch (err) {
      alert('Error deleting item');
    }
  };

  if (!activeCompany) return <Box p={3}><EmptyState title="No Company Selected" /></Box>;

  return (
    <Box sx={{ width: '100%', pb: 5 }}>
      <PageHeader 
        title="CRM Hub" 
        subtitle="Manage relationships, pipeline, and activities." 
        breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'CRM' }]} 
        action={
          <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={() => openForm('lead')}>+ Lead</Button>
            <Button variant="outlined" onClick={() => openForm('deal', {stage: 'Discovery'})}>+ Deal</Button>
          </Stack>
        }
      />

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={currentTab} onChange={(e, val) => setCurrentTab(val)}>
          <Tab label="Deals (Pipeline)" />
          <Tab label="Leads" />
          <Tab label="Customers" />
          <Tab label="Contacts" />
          <Tab label="Activities" />
        </Tabs>
      </Box>

      {/* Global Add buttons for tabs */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
        {currentTab === 1 && <Button variant="outlined" size="small" onClick={() => openForm('lead')}>Add Lead</Button>}
        {currentTab === 2 && <Button variant="outlined" size="small" onClick={() => openForm('customer')}>Add Customer</Button>}
        {currentTab === 3 && <Button variant="outlined" size="small" onClick={() => openForm('contact')}>Add Contact</Button>}
        {currentTab === 4 && <Button variant="outlined" size="small" onClick={() => openForm('activity')}>Add Activity</Button>}
      </Box>

      {loading ? <LoadingState /> : error ? <Alert severity="error">{error}</Alert> : (
        <>
          {/* TAB 0: KANBAN DEALS */}
          {currentTab === 0 && (
            <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', minHeight: '60vh' }}>
              {DEAL_STAGES.map(stage => (
                <Paper 
                  key={stage} 
                  sx={{ minWidth: 300, bgcolor: 'grey.100', p: 2, display: 'flex', flexDirection: 'column' }}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, stage)}
                >
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {stage} ({deals.filter(d => d.stage === stage).length})
                    </Typography>
                    <IconButton size="small" onClick={() => openForm('deal', { stage })}><AddIcon fontSize="small" /></IconButton>
                  </Box>
                  <Stack spacing={2}>
                    {deals.filter(d => d.stage === stage).map(deal => (
                      <Card 
                        key={deal.id} 
                        draggable 
                        onDragStart={(e) => handleDragStart(e, deal.id)}
                        sx={{ cursor: 'grab', '&:active': { cursor: 'grabbing' }, position: 'relative' }}
                      >
                        <CardContent sx={{ pr: 5 }}>
                          <Typography fontWeight="bold">{deal.title}</Typography>
                          <Typography variant="body2" color="text.secondary">{deal.customer_name || 'No Account'}</Typography>
                          <Typography variant="body2" sx={{ mt: 1 }}>Value: ${deal.value}</Typography>
                          <Typography variant="caption" color="text.secondary">Close: {deal.expected_close_date || 'TBD'}</Typography>
                          <IconButton 
                            size="small" 
                            sx={{ position: 'absolute', top: 5, right: 5 }}
                            onClick={(e) => openMenu(e, deal, 'deal')}
                          >
                            <MoreVertIcon fontSize="small" />
                          </IconButton>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                </Paper>
              ))}
            </Box>
          )}

          {/* TAB 1: ADVANCED LEADS */}
          {currentTab === 1 && (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Industry / Location</TableCell>
                    <TableCell>Prob.</TableCell>
                    <TableCell>Tags</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {leads.map(lead => (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <Typography fontWeight="bold">{lead.first_name} {lead.last_name}</Typography>
                        <Typography variant="caption">{lead.email}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{lead.industry || '-'}</Typography>
                        <Typography variant="caption" color="text.secondary">{lead.location || '-'}</Typography>
                      </TableCell>
                      <TableCell>{lead.probability || 0}%</TableCell>
                      <TableCell>{lead.tags ? <Chip size="small" label={lead.tags} /> : '-'}</TableCell>
                      <TableCell><Chip size="small" label={lead.status || 'New'} /></TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={(e) => openMenu(e, lead, 'lead')}>
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* TAB 2: CUSTOMERS (360 View) */}
          {currentTab === 2 && (
            <Grid container spacing={2}>
              {customers.map(cust => (
                <Grid item xs={12} sm={6} md={4} key={cust.id}>
                  <Card sx={{ '&:hover': { boxShadow: 3 }, position: 'relative' }}>
                    <CardContent onClick={() => handleOpen360(cust)} sx={{ cursor: 'pointer', pr: 5 }}>
                      <Typography variant="h6">{cust.name}</Typography>
                      <Typography variant="body2" color="text.secondary">{cust.industry}</Typography>
                      <Divider sx={{ my: 1 }} />
                      <Typography variant="caption">Click for 360 View</Typography>
                    </CardContent>
                    <IconButton 
                      size="small" 
                      sx={{ position: 'absolute', top: 5, right: 5 }}
                      onClick={(e) => openMenu(e, cust, 'customer')}
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}

          {/* TAB 3: CONTACTS */}
          {currentTab === 3 && (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>Customer</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {contacts.map(c => (
                    <TableRow key={c.id}>
                      <TableCell>{c.first_name} {c.last_name}</TableCell>
                      <TableCell>{c.email}</TableCell>
                      <TableCell>{c.phone}</TableCell>
                      <TableCell>{c.customer_name || '-'}</TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={(e) => openMenu(e, c, 'contact')}>
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* TAB 4: ACTIVITIES */}
          {currentTab === 4 && (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell>Related To</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {activities.map(act => (
                    <TableRow key={act.id}>
                      <TableCell><Chip icon={ACTIVITY_TYPE_ICONS[act.activity_type]} label={act.activity_type} size="small" /></TableCell>
                      <TableCell>{act.title}</TableCell>
                      <TableCell>{act.customer_name || act.lead_name || act.deal_title || '-'}</TableCell>
                      <TableCell>{act.status}</TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={(e) => openMenu(e, act, 'activity')}>
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}

      {/* CUSTOMER 360 DRAWER */}
      <Drawer anchor="right" open={customer360Open} onClose={() => setCustomer360Open(false)} PaperProps={{ sx: { width: 500, p: 3 } }}>
        {selectedCustomer && (
          <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="h5" mb={1}>{selectedCustomer.name}</Typography>
              <IconButton onClick={(e) => openMenu(e, selectedCustomer, 'customer')}><MoreVertIcon /></IconButton>
            </Box>
            <Typography variant="body2" color="text.secondary" mb={3}>{selectedCustomer.industry} | {selectedCustomer.website}</Typography>
            
            <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
              <Typography variant="h6">Contacts</Typography>
              <Button size="small" onClick={() => openForm('contact', { customer: selectedCustomer.id })}>Add</Button>
            </Box>
            <List>
              {contacts.filter(c => c.customer === selectedCustomer.id).map(c => (
                <ListItem key={c.id} divider>
                  <ListItemText primary={`${c.first_name} ${c.last_name}`} secondary={c.email} />
                  <IconButton size="small" onClick={(e) => openMenu(e, c, 'contact')}><EditOutlinedIcon fontSize="small" /></IconButton>
                </ListItem>
              ))}
            </List>

            <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
              <Typography variant="h6">Deals</Typography>
              <Button size="small" onClick={() => openForm('deal', { customer: selectedCustomer.id, stage: 'Discovery' })}>Add</Button>
            </Box>
            <List>
              {deals.filter(d => d.customer === selectedCustomer.id).map(d => (
                <ListItem key={d.id} divider>
                  <ListItemText primary={d.title} secondary={`Stage: ${d.stage} | Value: $${d.value}`} />
                  <IconButton size="small" onClick={(e) => openMenu(e, d, 'deal')}><EditOutlinedIcon fontSize="small" /></IconButton>
                </ListItem>
              ))}
            </List>

            <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
              <Typography variant="h6">Activities</Typography>
              <Button size="small" onClick={() => openForm('activity', { customer: selectedCustomer.id })}>Add</Button>
            </Box>
            <List>
              {activities.filter(a => a.customer === selectedCustomer.id).map(a => (
                <ListItem key={a.id} divider>
                  <ListItemText primary={a.title} secondary={`${a.activity_type} - ${a.status}`} />
                  <IconButton size="small" onClick={(e) => openMenu(e, a, 'activity')}><EditOutlinedIcon fontSize="small" /></IconButton>
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </Drawer>

      {/* ACTION MENU */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={closeMenu}>
        <MenuItem onClick={() => openForm(menuTarget?.type, menuTarget?.data)}>
          <ListItemIcon><EditOutlinedIcon fontSize="small" /></ListItemIcon>
          Edit
        </MenuItem>
        <MenuItem onClick={() => requestDelete()}>
          <ListItemIcon><DeleteOutlineOutlinedIcon fontSize="small" color="error" /></ListItemIcon>
          <Typography color="error">Delete</Typography>
        </MenuItem>
      </Menu>

      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this {deleteTarget?.type}? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>

      {/* CREATE / EDIT FORM DIALOG */}
      <Dialog open={formOpen} onClose={closeForm} maxWidth="sm" fullWidth>
        <DialogTitle>{isEdit ? `Edit ${formType}` : `Create ${formType}`}</DialogTitle>
        <DialogContent dividers>
          {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
          <Stack spacing={2} mt={1}>
            
            {/* LEAD FORM */}
            {formType === 'lead' && (
              <>
                <Grid container spacing={2}>
                  <Grid item xs={6}><TextField fullWidth label="First Name" name="first_name" value={formData.first_name || ''} onChange={handleFormChange} required /></Grid>
                  <Grid item xs={6}><TextField fullWidth label="Last Name" name="last_name" value={formData.last_name || ''} onChange={handleFormChange} required /></Grid>
                </Grid>
                <TextField fullWidth label="Email" name="email" value={formData.email || ''} onChange={handleFormChange} />
                <Grid container spacing={2}>
                  <Grid item xs={6}><TextField fullWidth label="Industry" name="industry" value={formData.industry || ''} onChange={handleFormChange} /></Grid>
                  <Grid item xs={6}><TextField fullWidth label="Location" name="location" value={formData.location || ''} onChange={handleFormChange} /></Grid>
                </Grid>
                <TextField fullWidth label="Status" name="status" value={formData.status || ''} onChange={handleFormChange} />
                <TextField fullWidth label="Probability (%)" name="probability" type="number" value={formData.probability || ''} onChange={handleFormChange} />
              </>
            )}

            {/* DEAL FORM */}
            {formType === 'deal' && (
              <>
                <TextField fullWidth label="Deal Title" name="title" value={formData.title || ''} onChange={handleFormChange} required />
                <FormControl fullWidth>
                  <InputLabel>Customer</InputLabel>
                  <Select name="customer" value={formData.customer || ''} onChange={handleFormChange} label="Customer">
                    <MenuItem value=""><em>None</em></MenuItem>
                    {customers.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField fullWidth label="Value" name="value" type="number" value={formData.value || ''} onChange={handleFormChange} />
                <FormControl fullWidth>
                  <InputLabel>Stage</InputLabel>
                  <Select name="stage" value={formData.stage || 'Discovery'} onChange={handleFormChange} label="Stage">
                    {DEAL_STAGES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField fullWidth label="Expected Close Date" name="expected_close_date" type="date" InputLabelProps={{ shrink: true }} value={formData.expected_close_date || ''} onChange={handleFormChange} />
              </>
            )}

            {/* CUSTOMER FORM */}
            {formType === 'customer' && (
              <>
                <TextField fullWidth label="Customer Name" name="name" value={formData.name || ''} onChange={handleFormChange} required />
                <TextField fullWidth label="Industry" name="industry" value={formData.industry || ''} onChange={handleFormChange} />
                <TextField fullWidth label="Website" name="website" value={formData.website || ''} onChange={handleFormChange} />
              </>
            )}

            {/* CONTACT FORM */}
            {formType === 'contact' && (
              <>
                <Grid container spacing={2}>
                  <Grid item xs={6}><TextField fullWidth label="First Name" name="first_name" value={formData.first_name || ''} onChange={handleFormChange} required /></Grid>
                  <Grid item xs={6}><TextField fullWidth label="Last Name" name="last_name" value={formData.last_name || ''} onChange={handleFormChange} required /></Grid>
                </Grid>
                <TextField fullWidth label="Email" name="email" value={formData.email || ''} onChange={handleFormChange} />
                <TextField fullWidth label="Phone" name="phone" value={formData.phone || ''} onChange={handleFormChange} />
                <FormControl fullWidth>
                  <InputLabel>Customer</InputLabel>
                  <Select name="customer" value={formData.customer || ''} onChange={handleFormChange} label="Customer">
                    <MenuItem value=""><em>None</em></MenuItem>
                    {customers.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </>
            )}

            {/* ACTIVITY FORM */}
            {formType === 'activity' && (
              <>
                <TextField fullWidth label="Title" name="title" value={formData.title || ''} onChange={handleFormChange} required />
                <FormControl fullWidth>
                  <InputLabel>Activity Type</InputLabel>
                  <Select name="activity_type" value={formData.activity_type || 'Note'} onChange={handleFormChange} label="Activity Type">
                    {Object.keys(ACTIVITY_TYPE_ICONS).map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField fullWidth label="Status" name="status" value={formData.status || ''} onChange={handleFormChange} />
                
                {/* Related To (simplified to just allow picking a customer for now, or extending it) */}
                <FormControl fullWidth>
                  <InputLabel>Related Customer</InputLabel>
                  <Select name="customer" value={formData.customer || ''} onChange={handleFormChange} label="Related Customer">
                    <MenuItem value=""><em>None</em></MenuItem>
                    {customers.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel>Related Deal</InputLabel>
                  <Select name="deal" value={formData.deal || ''} onChange={handleFormChange} label="Related Deal">
                    <MenuItem value=""><em>None</em></MenuItem>
                    {deals.map(d => <MenuItem key={d.id} value={d.id}>{d.title}</MenuItem>)}
                  </Select>
                </FormControl>
              </>
            )}

          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeForm} disabled={formSubmitting}>Cancel</Button>
          <Button onClick={handleFormSubmit} variant="contained" disabled={formSubmitting}>
            {formSubmitting ? <CircularProgress size={24} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
