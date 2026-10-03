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
  const [searchQuery, setSearchQuery] = useState('');
  
  // Dialog States
  const [customer360Open, setCustomer360Open] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  
  // Form dialogs (simplifying open state logic for brevity)
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [leadForm, setLeadForm] = useState({});
  const [dealDialogOpen, setDealDialogOpen] = useState(false);
  const [dealForm, setDealForm] = useState({});
  
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

  if (!activeCompany) return <Box p={3}><EmptyState title="No Company Selected" /></Box>;

  return (
    <Box sx={{ width: '100%', pb: 5 }}>
      <PageHeader 
        title="CRM Hub" 
        subtitle="Manage relationships, pipeline, and activities." 
        breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'CRM' }]} 
        action={
          <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={() => {setLeadForm({}); setLeadDialogOpen(true)}}>+ Lead</Button>
            <Button variant="outlined" onClick={() => {setDealForm({stage: 'Discovery'}); setDealDialogOpen(true)}}>+ Deal</Button>
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

      {loading ? <LoadingState /> : error ? <Alert severity="error">{error}</Alert> : (
        <>
          {/* TAB 0: KANBAN DEALS */}
          {currentTab === 0 && (
            <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', minHeight: '60vh' }}>
              {DEAL_STAGES.map(stage => (
                <Paper 
                  key={stage} 
                  sx={{ minWidth: 300, bgcolor: 'grey.100', p: 2, display: 'flex', flexDir: 'column' }}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, stage)}
                >
                  <Typography variant="subtitle1" fontWeight="bold" mb={2}>
                    {stage} ({deals.filter(d => d.stage === stage).length})
                  </Typography>
                  <Stack spacing={2}>
                    {deals.filter(d => d.stage === stage).map(deal => (
                      <Card 
                        key={deal.id} 
                        draggable 
                        onDragStart={(e) => handleDragStart(e, deal.id)}
                        sx={{ cursor: 'grab', '&:active': { cursor: 'grabbing' } }}
                      >
                        <CardContent>
                          <Typography fontWeight="bold">{deal.title}</Typography>
                          <Typography variant="body2" color="text.secondary">{deal.customer_name || 'No Account'}</Typography>
                          <Typography variant="body2" sx={{ mt: 1 }}>Value: ${deal.value}</Typography>
                          <Typography variant="caption" color="text.secondary">Close: {deal.expected_close_date || 'TBD'}</Typography>
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
                    <TableCell>Next Action</TableCell>
                    <TableCell>Last Activity</TableCell>
                    <TableCell>Status</TableCell>
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
                      <TableCell>{lead.next_action || '-'}</TableCell>
                      <TableCell>{lead.last_activity || '-'}</TableCell>
                      <TableCell><Chip size="small" label={lead.status} /></TableCell>
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
                  <Card onClick={() => handleOpen360(cust)} sx={{ cursor: 'pointer', '&:hover': { boxShadow: 3 } }}>
                    <CardContent>
                      <Typography variant="h6">{cust.name}</Typography>
                      <Typography variant="body2" color="text.secondary">{cust.industry}</Typography>
                      <Divider sx={{ my: 1 }} />
                      <Typography variant="caption">Click for 360 View</Typography>
                    </CardContent>
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
                  </TableRow>
                </TableHead>
                <TableBody>
                  {contacts.map(c => (
                    <TableRow key={c.id}>
                      <TableCell>{c.first_name} {c.last_name}</TableCell>
                      <TableCell>{c.email}</TableCell>
                      <TableCell>{c.phone}</TableCell>
                      <TableCell>{c.customer_name || '-'}</TableCell>
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
                  </TableRow>
                </TableHead>
                <TableBody>
                  {activities.map(act => (
                    <TableRow key={act.id}>
                      <TableCell><Chip icon={ACTIVITY_TYPE_ICONS[act.activity_type]} label={act.activity_type} size="small" /></TableCell>
                      <TableCell>{act.title}</TableCell>
                      <TableCell>{act.customer_name || act.lead_name || act.deal_title || '-'}</TableCell>
                      <TableCell>{act.status}</TableCell>
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
            <Typography variant="h5" mb={1}>{selectedCustomer.name}</Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>{selectedCustomer.industry} | {selectedCustomer.website}</Typography>
            
            <Typography variant="h6">Contacts</Typography>
            <List>
              {contacts.filter(c => c.customer === selectedCustomer.id).map(c => (
                <ListItem key={c.id} divider>
                  <ListItemText primary={`${c.first_name} ${c.last_name}`} secondary={c.email} />
                </ListItem>
              ))}
            </List>

            <Typography variant="h6" mt={2}>Deals</Typography>
            <List>
              {deals.filter(d => d.customer === selectedCustomer.id).map(d => (
                <ListItem key={d.id} divider>
                  <ListItemText primary={d.title} secondary={`Stage: ${d.stage} | Value: $${d.value}`} />
                </ListItem>
              ))}
            </List>

            <Typography variant="h6" mt={2}>Activities</Typography>
            <List>
              {activities.filter(a => a.customer === selectedCustomer.id).map(a => (
                <ListItem key={a.id} divider>
                  <ListItemText primary={a.title} secondary={`${a.activity_type} - ${a.status}`} />
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </Drawer>
    </Box>
  );
}
