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
  FormControlLabel,
  Checkbox,
  Divider,
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
import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined';

import PageHeader from '../components/common/PageHeader';
import EmptyState from '../components/common/EmptyState';
import LoadingState from '../components/common/LoadingState';
import StatCard from '../components/common/StatCard';
import crmService from '../services/crmService';
import { useCompany } from '../context/CompanyContext';

const LEAD_STATUS_COLORS = {
  New: 'info',
  Contacted: 'warning',
  Qualified: 'primary',
  Lost: 'default',
  Converted: 'success',
};

const DEAL_STAGES = ['Discovery', 'Proposal', 'Negotiation', 'Won', 'Lost'];

const DEAL_STAGE_COLORS = {
  Discovery: 'info',
  Proposal: 'secondary',
  Negotiation: 'warning',
  Won: 'success',
  Lost: 'error',
};

const ACTIVITY_TYPE_ICONS = {
  Note: <AssignmentOutlinedIcon fontSize="small" />,
  Call: <PhoneOutlinedIcon fontSize="small" />,
  Meeting: <EventNoteOutlinedIcon fontSize="small" />,
  Task: <CheckCircleOutlinedIcon fontSize="small" />,
  Email: <EmailOutlinedIcon fontSize="small" />,
};

export default function CRMPage() {
  const { activeCompany } = useCompany();

  // Navigation tab: 0=Leads, 1=Customers, 2=Contacts, 3=Deals, 4=Activities
  const [currentTab, setCurrentTab] = useState(0);

  // Data states
  const [leads, setLeads] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [deals, setDeals] = useState([]);
  const [dealMetrics, setDealMetrics] = useState({ total_deals: 0, total_pipeline_value: 0, won_value: 0 });
  const [activities, setActivities] = useState([]);
  const [gmailStatus, setGmailStatus] = useState(null);

  // Loading and Error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [leadStatusFilter, setLeadStatusFilter] = useState('ALL');
  const [dealStageFilter, setDealStageFilter] = useState('ALL');
  const [activityTypeFilter, setActivityTypeFilter] = useState('ALL');

  // Dialog Controls
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [isEditingLead, setIsEditingLead] = useState(false);
  const [leadFormData, setLeadFormData] = useState({
    id: null,
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    lead_company: '',
    source: 'Website',
    status: 'New',
    estimated_value: '',
    notes: '',
  });

  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [convertingLead, setConvertingLead] = useState(null);
  const [convertFormData, setConvertFormData] = useState({
    customer_name: '',
    create_deal: true,
    deal_title: '',
    deal_value: '',
  });

  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [customerFormData, setCustomerFormData] = useState({
    id: null,
    name: '',
    customer_type: 'Corporate',
    email: '',
    phone: '',
    website: '',
    industry: '',
    address: '',
  });

  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [contactFormData, setContactFormData] = useState({
    id: null,
    customer: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    designation: '',
    notes: '',
  });

  const [dealDialogOpen, setDealDialogOpen] = useState(false);
  const [isEditingDeal, setIsEditingDeal] = useState(false);
  const [dealFormData, setDealFormData] = useState({
    id: null,
    title: '',
    customer: '',
    contact: '',
    value: '',
    stage: 'Discovery',
    probability: 25,
    expected_close_date: '',
    notes: '',
  });

  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [activityFormData, setActivityFormData] = useState({
    activity_type: 'Note',
    title: '',
    description: '',
    customer: '',
    contact: '',
    lead: '',
    deal: '',
    due_date: '',
    status: 'Completed',
  });

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState(null); // { type: 'lead'|'customer'|'contact'|'deal'|'activity', id, label }

  const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
  const [activeItem, setActiveItem] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Notification helper
  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  // Load active tab data
  const fetchData = useCallback(async () => {
    if (!activeCompany?.id) return;
    try {
      setLoading(true);
      setError(null);

      if (currentTab === 0) {
        const params = { all: 'true' };
        if (leadStatusFilter !== 'ALL') params.status = leadStatusFilter;
        if (searchQuery.trim()) params.search = searchQuery.trim();
        const data = await crmService.getLeads(activeCompany.id, params);
        setLeads(Array.isArray(data) ? data : (data?.results || []));
      } else if (currentTab === 1) {
        const params = { all: 'true' };
        if (searchQuery.trim()) params.search = searchQuery.trim();
        const data = await crmService.getCustomers(activeCompany.id, params);
        setCustomers(Array.isArray(data) ? data : (data?.results || []));
      } else if (currentTab === 2) {
        const params = { all: 'true' };
        if (searchQuery.trim()) params.search = searchQuery.trim();
        const [contactsData, customersData] = await Promise.all([
          crmService.getContacts(activeCompany.id, params),
          crmService.getCustomers(activeCompany.id, { all: 'true' }),
        ]);
        setContacts(Array.isArray(contactsData) ? contactsData : (contactsData?.results || []));
        setCustomers(Array.isArray(customersData) ? customersData : (customersData?.results || []));
      } else if (currentTab === 3) {
        const params = { all: 'true' };
        if (dealStageFilter !== 'ALL') params.stage = dealStageFilter;
        if (searchQuery.trim()) params.search = searchQuery.trim();
        const [dealsResp, customersData, contactsData] = await Promise.all([
          crmService.getDeals(activeCompany.id, params),
          crmService.getCustomers(activeCompany.id, { all: 'true' }),
          crmService.getContacts(activeCompany.id, { all: 'true' }),
        ]);
        setDeals(Array.isArray(dealsResp?.deals) ? dealsResp.deals : (Array.isArray(dealsResp) ? dealsResp : []));
        setDealMetrics(dealsResp?.metrics || { total_deals: 0, total_pipeline_value: 0, won_value: 0 });
        setCustomers(Array.isArray(customersData) ? customersData : (customersData?.results || []));
        setContacts(Array.isArray(contactsData) ? contactsData : (contactsData?.results || []));
      } else if (currentTab === 4) {
        const params = {};
        if (activityTypeFilter !== 'ALL') params.type = activityTypeFilter;
        const [activitiesData, customersData, leadsData, dealsResp, gmailResp] = await Promise.all([
          crmService.getActivities(activeCompany.id, params),
          crmService.getCustomers(activeCompany.id, { all: 'true' }),
          crmService.getLeads(activeCompany.id, { all: 'true' }),
          crmService.getDeals(activeCompany.id, { all: 'true' }),
          crmService.getGmailStatus(activeCompany.id).catch(() => null),
        ]);
        setActivities(Array.isArray(activitiesData) ? activitiesData : (activitiesData?.results || []));
        setCustomers(Array.isArray(customersData) ? customersData : (customersData?.results || []));
        setLeads(Array.isArray(leadsData) ? leadsData : (leadsData?.results || []));
        setDeals(Array.isArray(dealsResp?.deals) ? dealsResp.deals : (Array.isArray(dealsResp) ? dealsResp : []));
        if (gmailResp) setGmailStatus(gmailResp);
      }
    } catch (err) {
      console.error('Error fetching CRM data:', err);
      setError('Unable to load CRM data for this company.');
    } finally {
      setLoading(false);
    }
  }, [activeCompany, currentTab, leadStatusFilter, dealStageFilter, activityTypeFilter, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Tab change
  const handleTabChange = (e, val) => {
    setCurrentTab(val);
    setSearchQuery('');
  };

  // Menu Handlers
  const handleOpenMenu = (e, item) => {
    setActionMenuAnchor(e.currentTarget);
    setActiveItem(item);
  };

  const handleCloseMenu = () => {
    setActionMenuAnchor(null);
  };

  // ============================================================
  // 1. LEAD ACTIONS
  // ============================================================
  const handleOpenCreateLead = () => {
    setIsEditingLead(false);
    setLeadFormData({
      id: null,
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      lead_company: '',
      source: 'Website',
      status: 'New',
      estimated_value: '',
      notes: '',
    });
    setLeadDialogOpen(true);
  };

  const handleOpenEditLead = (lead) => {
    handleCloseMenu();
    setIsEditingLead(true);
    setLeadFormData({
      id: lead.id,
      first_name: lead.first_name || '',
      last_name: lead.last_name || '',
      email: lead.email || '',
      phone: lead.phone || '',
      lead_company: lead.lead_company || '',
      source: lead.source || 'Website',
      status: lead.status || 'New',
      estimated_value: lead.estimated_value || '',
      notes: lead.notes || '',
    });
    setLeadDialogOpen(true);
  };

  const handleSaveLead = async (e) => {
    e.preventDefault();
    if (!leadFormData.first_name.trim()) {
      showSnackbar('Lead first name is required', 'error');
      return;
    }
    try {
      setSubmitting(true);
      const payload = {
        ...leadFormData,
        estimated_value: leadFormData.estimated_value ? parseFloat(leadFormData.estimated_value) : 0,
      };
      if (isEditingLead) {
        await crmService.updateLead(activeCompany.id, leadFormData.id, payload);
        showSnackbar('Lead updated successfully');
      } else {
        await crmService.createLead(activeCompany.id, payload);
        showSnackbar('Lead created successfully');
      }
      setLeadDialogOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      showSnackbar('Failed to save lead', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenConvertLead = (lead) => {
    handleCloseMenu();
    setConvertingLead(lead);
    setConvertFormData({
      customer_name: lead.lead_company || `${lead.first_name} ${lead.last_name}`.trim(),
      create_deal: true,
      deal_title: `Deal - ${lead.lead_company || lead.first_name}`,
      deal_value: lead.estimated_value || '0.00',
    });
    setConvertDialogOpen(true);
  };

  const handleExecuteConvertLead = async () => {
    if (!convertingLead) return;
    try {
      setSubmitting(true);
      const payload = {
        customer_name: convertFormData.customer_name,
        create_deal: convertFormData.create_deal,
        deal_title: convertFormData.deal_title,
        deal_value: convertFormData.deal_value ? parseFloat(convertFormData.deal_value) : 0,
      };
      await crmService.convertLead(activeCompany.id, convertingLead.id, payload);
      showSnackbar(`Lead converted to Customer and Contact successfully!`);
      setConvertDialogOpen(false);
      setConvertingLead(null);
      fetchData();
    } catch (err) {
      console.error(err);
      showSnackbar('Failed to convert lead', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================
  // 2. CUSTOMER ACTIONS
  // ============================================================
  const handleOpenCreateCustomer = () => {
    setIsEditingCustomer(false);
    setCustomerFormData({
      id: null,
      name: '',
      customer_type: 'Corporate',
      email: '',
      phone: '',
      website: '',
      industry: '',
      address: '',
    });
    setCustomerDialogOpen(true);
  };

  const handleOpenEditCustomer = (cust) => {
    handleCloseMenu();
    setIsEditingCustomer(true);
    setCustomerFormData({
      id: cust.id,
      name: cust.name || '',
      customer_type: cust.customer_type || 'Corporate',
      email: cust.email || '',
      phone: cust.phone || '',
      website: cust.website || '',
      industry: cust.industry || '',
      address: cust.address || '',
    });
    setCustomerDialogOpen(true);
  };

  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    if (!customerFormData.name.trim()) {
      showSnackbar('Customer name is required', 'error');
      return;
    }
    try {
      setSubmitting(true);
      if (isEditingCustomer) {
        await crmService.updateCustomer(activeCompany.id, customerFormData.id, customerFormData);
        showSnackbar('Customer updated successfully');
      } else {
        await crmService.createCustomer(activeCompany.id, customerFormData);
        showSnackbar('Customer created successfully');
      }
      setCustomerDialogOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      showSnackbar('Failed to save customer', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================
  // 3. CONTACT ACTIONS
  // ============================================================
  const handleOpenCreateContact = () => {
    setIsEditingContact(false);
    setContactFormData({
      id: null,
      customer: customers.length > 0 ? customers[0].id : '',
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      designation: '',
      notes: '',
    });
    setContactDialogOpen(true);
  };

  const handleOpenEditContact = (contact) => {
    handleCloseMenu();
    setIsEditingContact(true);
    setContactFormData({
      id: contact.id,
      customer: contact.customer || '',
      first_name: contact.first_name || '',
      last_name: contact.last_name || '',
      email: contact.email || '',
      phone: contact.phone || '',
      designation: contact.designation || contact.title || '',
      notes: contact.notes || '',
    });
    setContactDialogOpen(true);
  };

  const handleSaveContact = async (e) => {
    e.preventDefault();
    if (!contactFormData.first_name.trim()) {
      showSnackbar('First name is required', 'error');
      return;
    }
    try {
      setSubmitting(true);
      const payload = {
        ...contactFormData,
        customer: contactFormData.customer || null,
        designation: contactFormData.designation || '',
      };
      if (isEditingContact) {
        await crmService.updateContact(activeCompany.id, contactFormData.id, payload);
        showSnackbar('Contact updated successfully');
      } else {
        await crmService.createContact(activeCompany.id, payload);
        showSnackbar('Contact created successfully');
      }
      setContactDialogOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      showSnackbar('Failed to save contact', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================
  // 4. DEAL ACTIONS
  // ============================================================
  const handleOpenCreateDeal = () => {
    setIsEditingDeal(false);
    setDealFormData({
      id: null,
      title: '',
      customer: customers.length > 0 ? customers[0].id : '',
      contact: '',
      value: '',
      stage: 'Discovery',
      probability: 25,
      expected_close_date: '',
      notes: '',
    });
    setDealDialogOpen(true);
  };

  const handleOpenEditDeal = (deal) => {
    handleCloseMenu();
    setIsEditingDeal(true);
    setDealFormData({
      id: deal.id,
      title: deal.title || '',
      customer: deal.customer || '',
      contact: deal.contact || '',
      value: deal.value || '',
      stage: deal.stage || 'Discovery',
      probability: deal.probability || 25,
      expected_close_date: deal.expected_close_date || '',
      notes: deal.notes || '',
    });
    setDealDialogOpen(true);
  };

  const handleSaveDeal = async (e) => {
    e.preventDefault();
    if (!dealFormData.title.trim()) {
      showSnackbar('Deal title is required', 'error');
      return;
    }
    if (!dealFormData.customer) {
      showSnackbar('Customer account is required for deals', 'error');
      return;
    }
    try {
      setSubmitting(true);
      const payload = {
        ...dealFormData,
        value: dealFormData.value ? parseFloat(dealFormData.value) : 0,
        contact: dealFormData.contact || null,
        expected_close_date: dealFormData.expected_close_date || null,
      };
      if (isEditingDeal) {
        await crmService.updateDeal(activeCompany.id, dealFormData.id, payload);
        showSnackbar('Deal updated successfully');
      } else {
        await crmService.createDeal(activeCompany.id, payload);
        showSnackbar('Deal created successfully');
      }
      setDealDialogOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      showSnackbar('Failed to save deal', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFastUpdateDealStage = async (deal, newStage) => {
    try {
      let newProb = deal.probability;
      if (newStage === 'Won') newProb = 100;
      else if (newStage === 'Lost') newProb = 0;
      else if (newStage === 'Discovery') newProb = 25;
      else if (newStage === 'Proposal') newProb = 50;
      else if (newStage === 'Negotiation') newProb = 75;

      await crmService.updateDeal(activeCompany.id, deal.id, {
        stage: newStage,
        probability: newProb,
      });
      showSnackbar(`Deal moved to ${newStage}`);
      fetchData();
    } catch (err) {
      console.error(err);
      showSnackbar('Failed to update deal stage', 'error');
    }
  };

  // ============================================================
  // 5. ACTIVITY ACTIONS
  // ============================================================
  const handleOpenCreateActivity = () => {
    setActivityFormData({
      activity_type: 'Note',
      title: '',
      description: '',
      customer: '',
      contact: '',
      lead: '',
      deal: '',
      due_date: '',
      status: 'Completed',
    });
    setActivityDialogOpen(true);
  };

  const handleSaveActivity = async (e) => {
    e.preventDefault();
    if (!activityFormData.title.trim()) {
      showSnackbar('Activity title is required', 'error');
      return;
    }
    try {
      setSubmitting(true);
      const payload = {
        ...activityFormData,
        customer: activityFormData.customer || null,
        contact: activityFormData.contact || null,
        lead: activityFormData.lead || null,
        deal: activityFormData.deal || null,
        due_date: activityFormData.due_date || null,
      };
      await crmService.createActivity(activeCompany.id, payload);
      showSnackbar(`${activityFormData.activity_type} logged successfully`);
      setActivityDialogOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      showSnackbar('Failed to log activity', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================
  // DELETION CONFIRMATION
  // ============================================================
  const handleConfirmDelete = async () => {
    if (!deletingItem) return;
    try {
      setSubmitting(true);
      const { type, id } = deletingItem;
      if (type === 'lead') await crmService.deleteLead(activeCompany.id, id);
      else if (type === 'customer') await crmService.deleteCustomer(activeCompany.id, id);
      else if (type === 'contact') await crmService.deleteContact(activeCompany.id, id);
      else if (type === 'deal') await crmService.deleteDeal(activeCompany.id, id);
      else if (type === 'activity') await crmService.deleteActivity(activeCompany.id, id);

      showSnackbar(`Item removed / deactivated successfully`);
      setDeleteConfirmOpen(false);
      setDeletingItem(null);
      fetchData();
    } catch (err) {
      console.error(err);
      showSnackbar('Failed to remove item', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!activeCompany) {
    return (
      <Box sx={{ p: 3 }}>
        <EmptyState
          icon={BusinessOutlinedIcon}
          title="No Company Selected"
          description="Please select an active company from the top navigation bar to manage your CRM pipeline."
        />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="CRM Pipeline & Accounts"
        subtitle={`Managing relationships, leads, accounts, and deals for ${activeCompany.name}.`}
        breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'CRM' }]}
        action={
          <Stack direction="row" spacing={1}>
            <Tooltip title="Refresh CRM Data">
              <IconButton onClick={fetchData} color="primary" sx={{ border: 1, borderColor: 'divider' }}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            {currentTab === 0 && (
              <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={handleOpenCreateLead}>
                Create Lead
              </Button>
            )}
            {currentTab === 1 && (
              <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={handleOpenCreateCustomer}>
                Add Customer
              </Button>
            )}
            {currentTab === 2 && (
              <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={handleOpenCreateContact}>
                Add Contact
              </Button>
            )}
            {currentTab === 3 && (
              <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={handleOpenCreateDeal}>
                New Deal
              </Button>
            )}
            {currentTab === 4 && (
              <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={handleOpenCreateActivity}>
                Log Activity
              </Button>
            )}
          </Stack>
        }
      />

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={currentTab}
          onChange={handleTabChange}
          aria-label="crm navigation tabs"
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.9rem',
              minHeight: 48,
            },
          }}
        >
          <Tab icon={<PeopleAltOutlinedIcon fontSize="small" />} iconPosition="start" label="Leads" />
          <Tab icon={<BusinessOutlinedIcon fontSize="small" />} iconPosition="start" label="Customers" />
          <Tab icon={<ContactPhoneOutlinedIcon fontSize="small" />} iconPosition="start" label="Contacts" />
          <Tab icon={<HandshakeOutlinedIcon fontSize="small" />} iconPosition="start" label="Deals & Pipeline" />
          <Tab icon={<AssignmentOutlinedIcon fontSize="small" />} iconPosition="start" label="Activities & Notes" />
        </Tabs>
      </Box>

      {/* Loading & Error States */}
      {loading && !submitting && <LoadingState message="Connecting to CRM backend..." />}
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* TAB 0: LEADS */}
      {currentTab === 0 && !loading && (
        <Box>
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Total Leads"
                value={leads.length}
                subtitle="Captured prospects"
                icon={PeopleAltOutlinedIcon}
                color="#2563eb"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="New Leads"
                value={leads.filter((l) => l.status === 'New').length}
                subtitle="Needs follow-up"
                icon={AssignmentOutlinedIcon}
                color="#0284c7"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Qualified"
                value={leads.filter((l) => l.status === 'Qualified').length}
                subtitle="High conversion potential"
                icon={CheckCircleOutlinedIcon}
                color="#059669"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Converted"
                value={leads.filter((l) => l.status === 'Converted').length}
                subtitle="Moved to Customers"
                icon={TransformOutlinedIcon}
                color="#7c3aed"
              />
            </Grid>
          </Grid>

          {/* Search & Filter Bar */}
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={6} md={5}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Search leads by name, email, company..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" color="action" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Filter by Status</InputLabel>
                    <Select
                      value={leadStatusFilter}
                      label="Filter by Status"
                      onChange={(e) => setLeadStatusFilter(e.target.value)}
                    >
                      <MenuItem value="ALL">All Statuses</MenuItem>
                      <MenuItem value="New">New</MenuItem>
                      <MenuItem value="Contacted">Contacted</MenuItem>
                      <MenuItem value="Qualified">Qualified</MenuItem>
                      <MenuItem value="Lost">Lost</MenuItem>
                      <MenuItem value="Converted">Converted</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {leads.length === 0 ? (
            <EmptyState
              icon={PeopleAltOutlinedIcon}
              title="No Leads Found"
              description="Start prospecting by creating a new lead for this company."
              actionLabel="Create Lead"
              onAction={handleOpenCreateLead}
            />
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
              <Table>
                <TableHead sx={{ bgcolor: 'grey.50' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Lead Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Company</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Contact Info</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Est. Value</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Source</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {leads.map((lead) => (
                    <TableRow key={lead.id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {lead.first_name} {lead.last_name}
                        </Typography>
                        {!lead.is_active && (
                          <Chip label="Inactive" size="small" color="default" sx={{ height: 20, fontSize: '0.7rem' }} />
                        )}
                      </TableCell>
                      <TableCell>{lead.lead_company || '-'}</TableCell>
                      <TableCell>
                        <Typography variant="body2">{lead.email || '-'}</Typography>
                        <Typography variant="caption" color="text.secondary">{lead.phone || ''}</Typography>
                      </TableCell>
                      <TableCell>
                        {lead.estimated_value ? `$${Number(lead.estimated_value).toLocaleString()}` : '$0.00'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={lead.status}
                          size="small"
                          color={LEAD_STATUS_COLORS[lead.status] || 'default'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{lead.source || '-'}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          {lead.status !== 'Converted' && lead.is_active && (
                            <Tooltip title="Convert to Customer">
                              <IconButton
                                size="small"
                                color="secondary"
                                onClick={() => handleOpenConvertLead(lead)}
                              >
                                <TransformOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          <IconButton size="small" onClick={(e) => handleOpenMenu(e, { ...lead, entityType: 'lead' })}>
                            <MoreVertIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* TAB 1: CUSTOMERS */}
      {currentTab === 1 && !loading && (
        <Box>
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={4}>
              <StatCard
                title="Total Accounts"
                value={customers.length}
                subtitle="Client accounts"
                icon={BusinessOutlinedIcon}
                color="#2563eb"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <StatCard
                title="Corporate"
                value={customers.filter((c) => c.customer_type === 'Corporate').length}
                subtitle="Enterprise & B2B clients"
                icon={BusinessOutlinedIcon}
                color="#059669"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <StatCard
                title="Individual"
                value={customers.filter((c) => c.customer_type === 'Individual').length}
                subtitle="Direct consumers & retail"
                icon={PeopleAltOutlinedIcon}
                color="#d97706"
              />
            </Grid>
          </Grid>

          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search customers by company name, email, phone, industry..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                }}
              />
            </CardContent>
          </Card>

          {customers.length === 0 ? (
            <EmptyState
              icon={BusinessOutlinedIcon}
              title="No Customers Found"
              description="Keep client accounts organized. Add your first customer account or convert a lead."
              actionLabel="Add Customer"
              onAction={handleOpenCreateCustomer}
            />
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
              <Table>
                <TableHead sx={{ bgcolor: 'grey.50' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Account Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Industry</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Contact Info</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Contacts</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Deals</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {customers.map((cust) => (
                    <TableRow key={cust.id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {cust.name}
                        </Typography>
                        {cust.website && (
                          <Typography variant="caption" color="primary">
                            {cust.website}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={cust.customer_type}
                          size="small"
                          color={cust.customer_type === 'Corporate' ? 'primary' : 'default'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{cust.industry || '-'}</TableCell>
                      <TableCell>
                        <Typography variant="body2">{cust.email || '-'}</Typography>
                        <Typography variant="caption" color="text.secondary">{cust.phone || ''}</Typography>
                      </TableCell>
                      <TableCell>{cust.contacts_count || 0}</TableCell>
                      <TableCell>{cust.deals_count || 0}</TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={(e) => handleOpenMenu(e, { ...cust, entityType: 'customer' })}>
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* TAB 2: CONTACTS */}
      {currentTab === 2 && !loading && (
        <Box>
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search contacts by name, email, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                }}
              />
            </CardContent>
          </Card>

          {contacts.length === 0 ? (
            <EmptyState
              icon={ContactPhoneOutlinedIcon}
              title="No Contacts Found"
              description="Build your stakeholder network by adding direct contacts to client accounts."
              actionLabel="Add Contact"
              onAction={handleOpenCreateContact}
            />
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
              <Table>
                <TableHead sx={{ bgcolor: 'grey.50' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Contact Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Associated Customer</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Job Title</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Phone</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {contacts.map((contact) => (
                    <TableRow key={contact.id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {contact.first_name} {contact.last_name}
                        </Typography>
                      </TableCell>
                      <TableCell>{contact.customer_name || 'Individual'}</TableCell>
                      <TableCell>{contact.designation || contact.title || '-'}</TableCell>
                      <TableCell>{contact.email || '-'}</TableCell>
                      <TableCell>{contact.phone || '-'}</TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={(e) => handleOpenMenu(e, { ...contact, entityType: 'contact' })}>
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* TAB 3: DEALS & PIPELINE */}
      {currentTab === 3 && !loading && (
        <Box>
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={4}>
              <StatCard
                title="Total Deals"
                value={dealMetrics.total_deals}
                subtitle="Active pipeline opportunities"
                icon={HandshakeOutlinedIcon}
                color="#2563eb"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <StatCard
                title="Total Pipeline Value"
                value={`$${Number(dealMetrics.total_pipeline_value).toLocaleString()}`}
                subtitle="Unweighted pipeline volume"
                icon={MonetizationOnOutlinedIcon}
                color="#0284c7"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <StatCard
                title="Won Revenue"
                value={`$${Number(dealMetrics.won_value).toLocaleString()}`}
                subtitle="Closed-won opportunities"
                icon={CheckCircleOutlinedIcon}
                color="#059669"
              />
            </Grid>
          </Grid>

          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={6} md={5}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Search deals by title or customer..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" color="action" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Filter by Stage</InputLabel>
                    <Select
                      value={dealStageFilter}
                      label="Filter by Stage"
                      onChange={(e) => setDealStageFilter(e.target.value)}
                    >
                      <MenuItem value="ALL">All Stages</MenuItem>
                      {DEAL_STAGES.map((st) => (
                        <MenuItem key={st} value={st}>{st}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {deals.length === 0 ? (
            <EmptyState
              icon={HandshakeOutlinedIcon}
              title="No Deals Found"
              description="Track revenue opportunities by creating a new deal linked to a customer account."
              actionLabel="New Deal"
              onAction={handleOpenCreateDeal}
            />
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
              <Table>
                <TableHead sx={{ bgcolor: 'grey.50' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Opportunity</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Customer Account</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Value</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Current Stage</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Probability</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Target Close</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {deals.map((deal) => (
                    <TableRow key={deal.id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {deal.title}
                        </Typography>
                      </TableCell>
                      <TableCell>{deal.customer_name || '-'}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>
                        ${Number(deal.value).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <FormControl size="small">
                          <Select
                            value={deal.stage}
                            onChange={(e) => handleFastUpdateDealStage(deal, e.target.value)}
                            sx={{
                              height: 32,
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              color: `${DEAL_STAGE_COLORS[deal.stage]}.main`,
                            }}
                          >
                            {DEAL_STAGES.map((st) => (
                              <MenuItem key={st} value={st}>
                                {st}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>{deal.probability}%</TableCell>
                      <TableCell>{deal.expected_close_date || '-'}</TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={(e) => handleOpenMenu(e, { ...deal, entityType: 'deal' })}>
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* TAB 4: ACTIVITIES & NOTES */}
      {currentTab === 4 && !loading && (
        <Box>
          {/* Gmail / Local Status Banner */}
          <Alert
            icon={<MarkEmailReadOutlinedIcon fontSize="inherit" />}
            severity="info"
            sx={{ mb: 3 }}
          >
            <strong>CRM Communications Layer:</strong> Local Django dispatch is 100% active and operational.{' '}
            {gmailStatus && (
              <span>
                Backend status: <em>{gmailStatus.message}</em> ({gmailStatus.service}).
              </span>
            )}
          </Alert>

          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Filter by Activity Type</InputLabel>
                    <Select
                      value={activityTypeFilter}
                      label="Filter by Activity Type"
                      onChange={(e) => setActivityTypeFilter(e.target.value)}
                    >
                      <MenuItem value="ALL">All Activities</MenuItem>
                      <MenuItem value="Note">Notes</MenuItem>
                      <MenuItem value="Call">Phone Calls</MenuItem>
                      <MenuItem value="Meeting">Meetings</MenuItem>
                      <MenuItem value="Task">Tasks</MenuItem>
                      <MenuItem value="Email">Emails</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {activities.length === 0 ? (
            <EmptyState
              icon={AssignmentOutlinedIcon}
              title="No Activities Logged"
              description="Keep a complete audit trail of customer notes, calls, tasks, meetings, and emails."
              actionLabel="Log Activity"
              onAction={handleOpenCreateActivity}
            />
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
              <Table>
                <TableHead sx={{ bgcolor: 'grey.50' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Subject / Title</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Related Record</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Details</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Logged At</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {activities.map((act) => (
                    <TableRow key={act.id} hover>
                      <TableCell>
                        <Chip
                          icon={ACTIVITY_TYPE_ICONS[act.activity_type] || <AssignmentOutlinedIcon />}
                          label={act.activity_type}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {act.title}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {act.customer_name && <Typography variant="body2">Customer: {act.customer_name}</Typography>}
                        {act.lead_name && <Typography variant="caption" color="text.secondary">Lead: {act.lead_name}</Typography>}
                        {act.deal_title && <Typography variant="caption" color="primary" display="block">Deal: {act.deal_title}</Typography>}
                        {!act.customer_name && !act.lead_name && !act.deal_title && '-'}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 300 }}>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                          {act.description || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {act.created_at ? new Date(act.created_at).toLocaleString() : '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={act.status}
                          size="small"
                          color={act.status === 'Completed' ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => {
                            setDeletingItem({ type: 'activity', id: act.id, label: act.title });
                            setDeleteConfirmOpen(true);
                          }}
                        >
                          <DeleteOutlineOutlinedIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* ============================================================ */}
      {/* ACTION CONTEXT MENU */}
      {/* ============================================================ */}
      <Menu
        anchorEl={actionMenuAnchor}
        open={Boolean(actionMenuAnchor)}
        onClose={handleCloseMenu}
      >
        {activeItem?.entityType === 'lead' && [
          <MenuItem key="edit" onClick={() => handleOpenEditLead(activeItem)}>
            <ListItemIcon><EditOutlinedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Edit Lead</ListItemText>
          </MenuItem>,
          activeItem?.status !== 'Converted' && (
            <MenuItem key="convert" onClick={() => handleOpenConvertLead(activeItem)}>
              <ListItemIcon><TransformOutlinedIcon fontSize="small" color="secondary" /></ListItemIcon>
              <ListItemText>Convert to Customer</ListItemText>
            </MenuItem>
          ),
          <MenuItem
            key="delete"
            onClick={() => {
              handleCloseMenu();
              setDeletingItem({ type: 'lead', id: activeItem.id, label: `${activeItem.first_name} ${activeItem.last_name}` });
              setDeleteConfirmOpen(true);
            }}
          >
            <ListItemIcon><DeleteOutlineOutlinedIcon fontSize="small" color="error" /></ListItemIcon>
            <ListItemText sx={{ color: 'error.main' }}>Deactivate Lead</ListItemText>
          </MenuItem>,
        ]}

        {activeItem?.entityType === 'customer' && [
          <MenuItem key="edit" onClick={() => handleOpenEditCustomer(activeItem)}>
            <ListItemIcon><EditOutlinedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Edit Account</ListItemText>
          </MenuItem>,
          <MenuItem
            key="delete"
            onClick={() => {
              handleCloseMenu();
              setDeletingItem({ type: 'customer', id: activeItem.id, label: activeItem.name });
              setDeleteConfirmOpen(true);
            }}
          >
            <ListItemIcon><DeleteOutlineOutlinedIcon fontSize="small" color="error" /></ListItemIcon>
            <ListItemText sx={{ color: 'error.main' }}>Deactivate Customer</ListItemText>
          </MenuItem>,
        ]}

        {activeItem?.entityType === 'contact' && [
          <MenuItem key="edit" onClick={() => handleOpenEditContact(activeItem)}>
            <ListItemIcon><EditOutlinedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Edit Contact</ListItemText>
          </MenuItem>,
          <MenuItem
            key="delete"
            onClick={() => {
              handleCloseMenu();
              setDeletingItem({ type: 'contact', id: activeItem.id, label: `${activeItem.first_name} ${activeItem.last_name}` });
              setDeleteConfirmOpen(true);
            }}
          >
            <ListItemIcon><DeleteOutlineOutlinedIcon fontSize="small" color="error" /></ListItemIcon>
            <ListItemText sx={{ color: 'error.main' }}>Deactivate Contact</ListItemText>
          </MenuItem>,
        ]}

        {activeItem?.entityType === 'deal' && [
          <MenuItem key="edit" onClick={() => handleOpenEditDeal(activeItem)}>
            <ListItemIcon><EditOutlinedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Edit Deal</ListItemText>
          </MenuItem>,
          <MenuItem
            key="delete"
            onClick={() => {
              handleCloseMenu();
              setDeletingItem({ type: 'deal', id: activeItem.id, label: activeItem.title });
              setDeleteConfirmOpen(true);
            }}
          >
            <ListItemIcon><DeleteOutlineOutlinedIcon fontSize="small" color="error" /></ListItemIcon>
            <ListItemText sx={{ color: 'error.main' }}>Deactivate Deal</ListItemText>
          </MenuItem>,
        ]}
      </Menu>

      {/* ============================================================ */}
      {/* DIALOG: LEAD CREATE / EDIT */}
      {/* ============================================================ */}
      <Dialog open={leadDialogOpen} onClose={() => setLeadDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSaveLead}>
          <DialogTitle>{isEditingLead ? 'Edit Lead' : 'Create New Lead'}</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  label="First Name"
                  value={leadFormData.first_name}
                  onChange={(e) => setLeadFormData({ ...leadFormData, first_name: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Last Name"
                  value={leadFormData.last_name}
                  onChange={(e) => setLeadFormData({ ...leadFormData, last_name: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Company Name"
                  value={leadFormData.lead_company}
                  onChange={(e) => setLeadFormData({ ...leadFormData, lead_company: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="email"
                  label="Email"
                  value={leadFormData.email}
                  onChange={(e) => setLeadFormData({ ...leadFormData, email: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Phone"
                  value={leadFormData.phone}
                  onChange={(e) => setLeadFormData({ ...leadFormData, phone: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Estimated Value ($)"
                  value={leadFormData.estimated_value}
                  onChange={(e) => setLeadFormData({ ...leadFormData, estimated_value: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={leadFormData.status}
                    label="Status"
                    onChange={(e) => setLeadFormData({ ...leadFormData, status: e.target.value })}
                  >
                    <MenuItem value="New">New</MenuItem>
                    <MenuItem value="Contacted">Contacted</MenuItem>
                    <MenuItem value="Qualified">Qualified</MenuItem>
                    <MenuItem value="Lost">Lost</MenuItem>
                    <MenuItem value="Converted" disabled>Converted</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Source</InputLabel>
                  <Select
                    value={leadFormData.source}
                    label="Source"
                    onChange={(e) => setLeadFormData({ ...leadFormData, source: e.target.value })}
                  >
                    <MenuItem value="Website">Website</MenuItem>
                    <MenuItem value="Referral">Referral</MenuItem>
                    <MenuItem value="Cold Outreach">Cold Outreach</MenuItem>
                    <MenuItem value="Inbound Call">Inbound Call</MenuItem>
                    <MenuItem value="Social Media">Social Media</MenuItem>
                    <MenuItem value="Other">Other</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Notes"
                  value={leadFormData.notes}
                  onChange={(e) => setLeadFormData({ ...leadFormData, notes: e.target.value })}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setLeadDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? <CircularProgress size={24} /> : isEditingLead ? 'Save Changes' : 'Create Lead'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ============================================================ */}
      {/* DIALOG: CONVERT LEAD */}
      {/* ============================================================ */}
      <Dialog open={convertDialogOpen} onClose={() => setConvertDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TransformOutlinedIcon color="primary" /> Convert Lead to Customer Account
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Converting this lead will create an official Customer account and Contact stakeholder, marking the lead as Converted.
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label="Customer / Company Account Name"
                value={convertFormData.customer_name}
                onChange={(e) => setConvertFormData({ ...convertFormData, customer_name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={convertFormData.create_deal}
                    onChange={(e) => setConvertFormData({ ...convertFormData, create_deal: e.target.checked })}
                  />
                }
                label="Simultaneously create an Opportunity Deal"
              />
            </Grid>
            {convertFormData.create_deal && (
              <>
                <Grid item xs={12} sm={8}>
                  <TextField
                    fullWidth
                    label="Deal Opportunity Title"
                    value={convertFormData.deal_title}
                    onChange={(e) => setConvertFormData({ ...convertFormData, deal_title: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Deal Value ($)"
                    value={convertFormData.deal_value}
                    onChange={(e) => setConvertFormData({ ...convertFormData, deal_value: e.target.value })}
                  />
                </Grid>
              </>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setConvertDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleExecuteConvertLead}
            variant="contained"
            color="success"
            disabled={submitting || !convertFormData.customer_name.trim()}
          >
            {submitting ? <CircularProgress size={24} /> : 'Complete Conversion'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ============================================================ */}
      {/* DIALOG: CUSTOMER CREATE / EDIT */}
      {/* ============================================================ */}
      <Dialog open={customerDialogOpen} onClose={() => setCustomerDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSaveCustomer}>
          <DialogTitle>{isEditingCustomer ? 'Edit Customer Account' : 'Add New Customer Account'}</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  label="Customer / Company Name"
                  value={customerFormData.name}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, name: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Account Type</InputLabel>
                  <Select
                    value={customerFormData.customer_type}
                    label="Account Type"
                    onChange={(e) => setCustomerFormData({ ...customerFormData, customer_type: e.target.value })}
                  >
                    <MenuItem value="Corporate">Corporate</MenuItem>
                    <MenuItem value="Individual">Individual</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Industry"
                  value={customerFormData.industry}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, industry: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="email"
                  label="Primary Email"
                  value={customerFormData.email}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, email: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Primary Phone"
                  value={customerFormData.phone}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, phone: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Website URL"
                  value={customerFormData.website}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, website: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Billing Address"
                  value={customerFormData.address}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, address: e.target.value })}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setCustomerDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? <CircularProgress size={24} /> : isEditingCustomer ? 'Save Changes' : 'Create Customer'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ============================================================ */}
      {/* DIALOG: CONTACT CREATE / EDIT */}
      {/* ============================================================ */}
      <Dialog open={contactDialogOpen} onClose={() => setContactDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSaveContact}>
          <DialogTitle>{isEditingContact ? 'Edit Contact' : 'Add New Contact'}</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Associated Customer Account</InputLabel>
                  <Select
                    value={contactFormData.customer}
                    label="Associated Customer Account"
                    onChange={(e) => setContactFormData({ ...contactFormData, customer: e.target.value })}
                  >
                    <MenuItem value="">None / Standalone</MenuItem>
                    {customers.map((c) => (
                      <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  label="First Name"
                  value={contactFormData.first_name}
                  onChange={(e) => setContactFormData({ ...contactFormData, first_name: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Last Name"
                  value={contactFormData.last_name}
                  onChange={(e) => setContactFormData({ ...contactFormData, last_name: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="email"
                  label="Email"
                  value={contactFormData.email}
                  onChange={(e) => setContactFormData({ ...contactFormData, email: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Phone"
                  value={contactFormData.phone}
                  onChange={(e) => setContactFormData({ ...contactFormData, phone: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Job Title / Designation"
                  value={contactFormData.designation}
                  onChange={(e) => setContactFormData({ ...contactFormData, designation: e.target.value })}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setContactDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? <CircularProgress size={24} /> : isEditingContact ? 'Save Changes' : 'Create Contact'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ============================================================ */}
      {/* DIALOG: DEAL CREATE / EDIT */}
      {/* ============================================================ */}
      <Dialog open={dealDialogOpen} onClose={() => setDealDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSaveDeal}>
          <DialogTitle>{isEditingDeal ? 'Edit Deal Opportunity' : 'Create New Opportunity'}</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  label="Deal Title"
                  value={dealFormData.title}
                  onChange={(e) => setDealFormData({ ...dealFormData, title: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required>
                  <InputLabel>Customer Account</InputLabel>
                  <Select
                    value={dealFormData.customer}
                    label="Customer Account"
                    onChange={(e) => setDealFormData({ ...dealFormData, customer: e.target.value })}
                  >
                    {customers.map((c) => (
                      <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Key Contact</InputLabel>
                  <Select
                    value={dealFormData.contact}
                    label="Key Contact"
                    onChange={(e) => setDealFormData({ ...dealFormData, contact: e.target.value })}
                  >
                    <MenuItem value="">None</MenuItem>
                    {contacts.map((c) => (
                      <MenuItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Deal Value ($)"
                  value={dealFormData.value}
                  onChange={(e) => setDealFormData({ ...dealFormData, value: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Pipeline Stage</InputLabel>
                  <Select
                    value={dealFormData.stage}
                    label="Pipeline Stage"
                    onChange={(e) => setDealFormData({ ...dealFormData, stage: e.target.value })}
                  >
                    {DEAL_STAGES.map((st) => (
                      <MenuItem key={st} value={st}>{st}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Win Probability (%)"
                  value={dealFormData.probability}
                  onChange={(e) => setDealFormData({ ...dealFormData, probability: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="date"
                  label="Target Close Date"
                  InputLabelProps={{ shrink: true }}
                  value={dealFormData.expected_close_date}
                  onChange={(e) => setDealFormData({ ...dealFormData, expected_close_date: e.target.value })}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setDealDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? <CircularProgress size={24} /> : isEditingDeal ? 'Save Changes' : 'Create Deal'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ============================================================ */}
      {/* DIALOG: LOG ACTIVITY */}
      {/* ============================================================ */}
      <Dialog open={activityDialogOpen} onClose={() => setActivityDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSaveActivity}>
          <DialogTitle>Log CRM Activity / Interaction</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Activity Type</InputLabel>
                  <Select
                    value={activityFormData.activity_type}
                    label="Activity Type"
                    onChange={(e) => setActivityFormData({ ...activityFormData, activity_type: e.target.value })}
                  >
                    <MenuItem value="Note">Note</MenuItem>
                    <MenuItem value="Call">Phone Call</MenuItem>
                    <MenuItem value="Meeting">Meeting</MenuItem>
                    <MenuItem value="Task">Task</MenuItem>
                    <MenuItem value="Email">Email Communication</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={activityFormData.status}
                    label="Status"
                    onChange={(e) => setActivityFormData({ ...activityFormData, status: e.target.value })}
                  >
                    <MenuItem value="Completed">Completed</MenuItem>
                    <MenuItem value="Scheduled">Scheduled</MenuItem>
                    <MenuItem value="Cancelled">Cancelled</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  label="Title / Subject"
                  value={activityFormData.title}
                  onChange={(e) => setActivityFormData({ ...activityFormData, title: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Link to Customer Account</InputLabel>
                  <Select
                    value={activityFormData.customer}
                    label="Link to Customer Account"
                    onChange={(e) => setActivityFormData({ ...activityFormData, customer: e.target.value })}
                  >
                    <MenuItem value="">None</MenuItem>
                    {customers.map((c) => (
                      <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Link to Lead</InputLabel>
                  <Select
                    value={activityFormData.lead}
                    label="Link to Lead"
                    onChange={(e) => setActivityFormData({ ...activityFormData, lead: e.target.value })}
                  >
                    <MenuItem value="">None</MenuItem>
                    {leads.map((l) => (
                      <MenuItem key={l.id} value={l.id}>{l.first_name} {l.last_name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Description / Meeting Notes / Email Content"
                  value={activityFormData.description}
                  onChange={(e) => setActivityFormData({ ...activityFormData, description: e.target.value })}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setActivityDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? <CircularProgress size={24} /> : 'Log Activity'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ============================================================ */}
      {/* DIALOG: CONFIRM DELETE */}
      {/* ============================================================ */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Confirm Action</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Are you sure you want to deactivate or remove <strong>{deletingItem?.label}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained" disabled={submitting}>
            {submitting ? <CircularProgress size={24} /> : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notification feedback snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
