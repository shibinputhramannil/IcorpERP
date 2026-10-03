import { formatCurrency } from '../utils/currency';
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
  InputAdornment,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
} from '@mui/material';

// Icons
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import TrendingDownOutlinedIcon from '@mui/icons-material/TrendingDownOutlined';
import MonetizationOnOutlinedIcon from '@mui/icons-material/MonetizationOnOutlined';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import SyncAltIcon from '@mui/icons-material/SyncAlt';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import LocalAtmOutlinedIcon from '@mui/icons-material/LocalAtmOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';

import PageHeader from '../components/common/PageHeader';
import EmptyState from '../components/common/EmptyState';
import LoadingState from '../components/common/LoadingState';
import StatCard from '../components/common/StatCard';
import financeService from '../services/financeService';
import { useCompany } from '../context/CompanyContext';
import { extractErrorMessage } from '../utils/errorUtils';

const CATEGORY_COLORS = {
  ASSET: 'primary',
  LIABILITY: 'warning',
  EQUITY: 'info',
  REVENUE: 'success',
  EXPENSE: 'error',
};



export default function FinancePage() {
  const { activeCompany, loading: companyLoading } = useCompany();
  const companyId = activeCompany?.id;

  // Primary Navigation
  const [activeTab, setActiveTab] = useState(0);

  // Notifications
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const showSnackbar = (message, severity = 'info') => setSnackbar({ open: true, message, severity });
  const handleCloseSnackbar = () => setSnackbar((prev) => ({ ...prev, open: false }));

  // Loading States
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Tab 0: Dashboard Data
  const [dashboard, setDashboard] = useState(null);

  // Tab 1: Chart of Accounts Data
  const [accounts, setAccounts] = useState([]);
  const [coaCategoryFilter, setCoaCategoryFilter] = useState('ALL');
  const [coaSearch, setCoaSearch] = useState('');
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountFormData, setAccountFormData] = useState({
    account_code: '',
    account_name: '',
    category: 'ASSET',
    description: '',
    opening_balance: '0.00',
  });

  // Tab 2: Journal Entries Data
  const [journalEntries, setJournalEntries] = useState([]);
  const [jeSearch, setJeSearch] = useState('');
  const [jeRefFilter, setJeRefFilter] = useState('ALL');
  const [jeModalOpen, setJeModalOpen] = useState(false);
  const [jeViewModalOpen, setJeViewModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [jeFormData, setJeFormData] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    description: '',
    reference_type: 'MANUAL',
    reference_id: '',
    lines: [
      { account: '', debit: '0.00', credit: '0.00', description: '' },
      { account: '', debit: '0.00', credit: '0.00', description: '' },
    ],
  });

  // Tab 3: General Ledger Data
  const [selectedGlAccount, setSelectedGlAccount] = useState('');
  const [glDateFrom, setGlDateFrom] = useState('');
  const [glDateTo, setGlDateTo] = useState('');
  const [glReports, setGlReports] = useState([]);

  // Tab 4 & 5: AR & AP Data
  const [arData, setArData] = useState(null);
  const [apData, setApData] = useState(null);

  // Tab 6: Cash & Bank Data
  const [bankAccounts, setBankAccounts] = useState([]);
  const [cashAccounts, setCashAccounts] = useState([]);
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [bankFormData, setBankFormData] = useState({
    account: '',
    bank_name: '',
    account_name: '',
    account_number: '',
    branch_name: '',
    swift_or_ifsc: '',
    currency: 'USD',
    opening_balance: '0.00',
  });
  const [cashModalOpen, setCashModalOpen] = useState(false);
  const [cashFormData, setCashFormData] = useState({
    account: '',
    account_name: '',
    opening_balance: '0.00',
  });

  // Tab 7: Financial Statements Data
  const [statementType, setStatementType] = useState('TB'); // TB, PNL, BS
  const [trialBalanceData, setTrialBalanceData] = useState(null);
  const [pnlData, setPnlData] = useState(null);
  const [bsData, setBsData] = useState(null);
  const [statementDateFrom, setStatementDateFrom] = useState('');
  const [statementDateTo, setStatementDateTo] = useState('');

  // ============================================================
  // FETCHERS
  // ============================================================

  const fetchDashboard = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      const data = await financeService.getDashboard(companyId);
      setDashboard(data);
    } catch (err) {
      showSnackbar(extractErrorMessage(err, 'Failed to load finance dashboard'), 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  const fetchAccounts = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      const data = await financeService.getAccounts(companyId);
      setAccounts(data);
    } catch (err) {
      showSnackbar(extractErrorMessage(err, 'Failed to load accounts'), 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  const fetchJournalEntries = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      const params = {};
      if (jeRefFilter !== 'ALL') params.reference_type = jeRefFilter;
      const data = await financeService.getJournalEntries(companyId, params);
      setJournalEntries(data);
    } catch (err) {
      showSnackbar(extractErrorMessage(err, 'Failed to load journal entries'), 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId, jeRefFilter]);

  const fetchGeneralLedger = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      const params = {};
      if (selectedGlAccount) params.account = selectedGlAccount;
      if (glDateFrom) params.date_from = glDateFrom;
      if (glDateTo) params.date_to = glDateTo;
      const data = await financeService.getGeneralLedger(companyId, params);
      setGlReports(data);
    } catch (err) {
      showSnackbar(extractErrorMessage(err, 'Failed to load general ledger'), 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedGlAccount, glDateFrom, glDateTo]);

  const fetchAR = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      const data = await financeService.getAccountsReceivable(companyId);
      setArData(data);
    } catch (err) {
      showSnackbar(extractErrorMessage(err, 'Failed to load Accounts Receivable'), 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  const fetchAP = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      const data = await financeService.getAccountsPayable(companyId);
      setApData(data);
    } catch (err) {
      showSnackbar(extractErrorMessage(err, 'Failed to load Accounts Payable'), 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  const fetchCashAndBank = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      const [banks, cash] = await Promise.all([
        financeService.getBankAccounts(companyId),
        financeService.getCashAccounts(companyId),
      ]);
      setBankAccounts(banks);
      setCashAccounts(cash);
    } catch (err) {
      showSnackbar(extractErrorMessage(err, 'Failed to load cash and bank accounts'), 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  const fetchStatements = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      if (statementType === 'TB') {
        const data = await financeService.getTrialBalance(companyId, {
          as_of_date: statementDateTo || undefined,
        });
        setTrialBalanceData(data);
      } else if (statementType === 'PNL') {
        const data = await financeService.getProfitLoss(companyId, {
          date_from: statementDateFrom || undefined,
          date_to: statementDateTo || undefined,
        });
        setPnlData(data);
      } else if (statementType === 'BS') {
        const data = await financeService.getBalanceSheet(companyId, {
          as_of_date: statementDateTo || undefined,
        });
        setBsData(data);
      }
    } catch (err) {
      showSnackbar(extractErrorMessage(err, 'Failed to generate financial statement'), 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId, statementType, statementDateFrom, statementDateTo]);

  // Load based on active tab
  useEffect(() => {
    if (!companyId) return;
    if (activeTab === 0) fetchDashboard();
    else if (activeTab === 1) fetchAccounts();
    else if (activeTab === 2) {
      fetchJournalEntries();
      fetchAccounts();
    } else if (activeTab === 3) {
      fetchAccounts();
      fetchGeneralLedger();
    } else if (activeTab === 4) fetchAR();
    else if (activeTab === 5) fetchAP();
    else if (activeTab === 6) {
      fetchCashAndBank();
      fetchAccounts();
    } else if (activeTab === 7) fetchStatements();
  }, [
    companyId,
    activeTab,
    fetchDashboard,
    fetchAccounts,
    fetchJournalEntries,
    fetchGeneralLedger,
    fetchAR,
    fetchAP,
    fetchCashAndBank,
    fetchStatements,
  ]);

  // ============================================================
  // ACTIONS: SEED DEFAULTS & SYNC RECORDS
  // ============================================================

  const handleSeedDefaults = async () => {
    if (!companyId) return;
    try {
      setActionLoading(true);
      const res = await financeService.seedDefaultAccounts(companyId);
      showSnackbar(res.message || 'Standard Chart of Accounts initialized successfully!', 'success');
      if (activeTab === 0) fetchDashboard();
      if (activeTab === 1) fetchAccounts();
    } catch (err) {
      showSnackbar(extractErrorMessage(err, 'Failed to initialize default accounts'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSyncRecords = async () => {
    if (!companyId) return;
    try {
      setActionLoading(true);
      const res = await financeService.syncRecords(companyId);
      const s = res.synced || {};
      showSnackbar(
        `Sync completed: ${s.sales_invoices || 0} Invoices, ${s.sales_payments || 0} Receipts, ${s.purchase_bills || 0} Bills, ${s.purchase_payments || 0} Disbursals.`,
        'success'
      );
      if (activeTab === 0) fetchDashboard();
      if (activeTab === 2) fetchJournalEntries();
    } catch (err) {
      showSnackbar(extractErrorMessage(err, 'Failed to synchronize financial records'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // ============================================================
  // ACTIONS: CREATE ACCOUNT
  // ============================================================

  const handleCreateAccountSubmit = async (e) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      setActionLoading(true);
      await financeService.createAccount(companyId, accountFormData);
      showSnackbar(`Account ${accountFormData.account_code} - ${accountFormData.account_name} created successfully!`, 'success');
      setAccountModalOpen(false);
      setAccountFormData({
        account_code: '',
        account_name: '',
        category: 'ASSET',
        description: '',
        opening_balance: '0.00',
      });
      fetchAccounts();
    } catch (err) {
      showSnackbar(extractErrorMessage(err, 'Failed to create account'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // ============================================================
  // ACTIONS: JOURNAL ENTRY CREATION & CANCELLATION
  // ============================================================

  const handleAddJeLine = () => {
    setJeFormData((prev) => ({
      ...prev,
      lines: [...prev.lines, { account: '', debit: '0.00', credit: '0.00', description: '' }],
    }));
  };

  const handleRemoveJeLine = (index) => {
    if (jeFormData.lines.length <= 2) {
      showSnackbar('A journal entry must contain at least 2 lines.', 'warning');
      return;
    }
    setJeFormData((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index),
    }));
  };

  const handleJeLineChange = (index, field, value) => {
    setJeFormData((prev) => {
      const updatedLines = [...prev.lines];
      updatedLines[index] = { ...updatedLines[index], [field]: value };
      return { ...prev, lines: updatedLines };
    });
  };

  // Compute live debits and credits
  const totalJeDebit = jeFormData.lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
  const totalJeCredit = jeFormData.lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
  const isJeBalanced = Math.abs(totalJeDebit - totalJeCredit) < 0.001 && totalJeDebit > 0;

  const handleCreateJournalEntrySubmit = async (e) => {
    e.preventDefault();
    if (!companyId) return;
    if (!isJeBalanced) {
      showSnackbar(
        `Entry is unbalanced! Total debits ($${totalJeDebit.toFixed(2)}) must equal total credits ($${totalJeCredit.toFixed(2)}).`,
        'error'
      );
      return;
    }

    try {
      setActionLoading(true);
      const res = await financeService.createJournalEntry(companyId, jeFormData);
      showSnackbar(`Journal entry ${res.entry_number} posted successfully!`, 'success');
      setJeModalOpen(false);
      setJeFormData({
        entry_date: new Date().toISOString().split('T')[0],
        description: '',
        reference_type: 'MANUAL',
        reference_id: '',
        lines: [
          { account: '', debit: '0.00', credit: '0.00', description: '' },
          { account: '', debit: '0.00', credit: '0.00', description: '' },
        ],
      });
      fetchJournalEntries();
    } catch (err) {
      showSnackbar(extractErrorMessage(err, 'Failed to post journal entry'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelJournalEntry = async (entryId) => {
    if (!companyId) return;
    if (!window.confirm('Are you sure you want to cancel this journal entry? Cancelled entries remain in the audit trail.')) return;
    try {
      setActionLoading(true);
      await financeService.cancelJournalEntry(companyId, entryId);
      showSnackbar('Journal entry cancelled successfully.', 'success');
      fetchJournalEntries();
    } catch (err) {
      showSnackbar(extractErrorMessage(err, 'Failed to cancel journal entry'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // ============================================================
  // ACTIONS: CASH & BANK CREATION
  // ============================================================

  const handleCreateBankSubmit = async (e) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      setActionLoading(true);
      await financeService.createBankAccount(companyId, bankFormData);
      showSnackbar('Bank account registered successfully!', 'success');
      setBankModalOpen(false);
      fetchCashAndBank();
    } catch (err) {
      showSnackbar(extractErrorMessage(err, 'Failed to register bank account'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateCashSubmit = async (e) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      setActionLoading(true);
      await financeService.createCashAccount(companyId, cashFormData);
      showSnackbar('Cash register registered successfully!', 'success');
      setCashModalOpen(false);
      fetchCashAndBank();
    } catch (err) {
      showSnackbar(extractErrorMessage(err, 'Failed to register cash register'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  if (companyLoading) {
    return <LoadingState message="Loading company context..." />;
  }

  if (!activeCompany) {
    return (
      <Box sx={{ p: 4 }}>
        <EmptyState
          title="No Company Selected"
          description="Please select or create an active company to access Finance & Accounting."
        />
      </Box>
    );
  }

  // Filtered Chart of Accounts
  const filteredAccounts = accounts.filter((acc) => {
    if (coaCategoryFilter !== 'ALL' && acc.category !== coaCategoryFilter) return false;
    if (coaSearch.trim()) {
      const q = coaSearch.toLowerCase();
      return (
        acc.account_code.toLowerCase().includes(q) ||
        acc.account_name.toLowerCase().includes(q) ||
        (acc.description && acc.description.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Filtered Journal Entries
  const filteredJournalEntries = journalEntries.filter((je) => {
    if (jeSearch.trim()) {
      const q = jeSearch.toLowerCase();
      return (
        je.entry_number.toLowerCase().includes(q) ||
        je.description.toLowerCase().includes(q) ||
        (je.reference_id && je.reference_id.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <PageHeader
        title="Finance & Accounting"
        subtitle={`Double-entry accounting, General Ledger, and financial statements for ${activeCompany.name}`}
        actions={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Button
              variant="outlined"
              color="primary"
              startIcon={<AutoFixHighIcon />}
              onClick={handleSeedDefaults}
              disabled={actionLoading}
            >
              Seed Default CoA
            </Button>
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<SyncAltIcon />}
              onClick={handleSyncRecords}
              disabled={actionLoading}
            >
              Sync Sales & Bills
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setJeModalOpen(true)}
              disabled={actionLoading}
            >
              New Journal Entry
            </Button>
          </Stack>
        }
      />

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, val) => setActiveTab(val)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab icon={<AssessmentOutlinedIcon />} iconPosition="start" label="Dashboard" />
          <Tab icon={<MenuBookOutlinedIcon />} iconPosition="start" label="Chart of Accounts" />
          <Tab icon={<ReceiptLongOutlinedIcon />} iconPosition="start" label="Journal Entries" />
          <Tab icon={<AccountBalanceWalletOutlinedIcon />} iconPosition="start" label="General Ledger" />
          <Tab icon={<TrendingUpOutlinedIcon />} iconPosition="start" label="Accounts Receivable" />
          <Tab icon={<TrendingDownOutlinedIcon />} iconPosition="start" label="Accounts Payable" />
          <Tab icon={<AccountBalanceOutlinedIcon />} iconPosition="start" label="Cash & Bank" />
          <Tab icon={<MonetizationOnOutlinedIcon />} iconPosition="start" label="Financial Statements" />
        </Tabs>
      </Box>

      {/* ============================================================ */}
      {/* TAB 0: EXECUTIVE DASHBOARD */}
      {/* ============================================================ */}
      {activeTab === 0 && (
        <Box>
          {loading && !dashboard ? (
            <LoadingState message="Calculating real-time financial KPIs..." />
          ) : (
            <Stack spacing={3}>
              {/* Primary KPIs */}
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <StatCard
                    title="Total Revenue"
                    value={formatCurrency(dashboard?.kpis?.total_revenue)}
                    subtitle="Gross earned from sales"
                    color="success"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <StatCard
                    title="Total Expenses"
                    value={formatCurrency(dashboard?.kpis?.total_expenses)}
                    subtitle="COGS & operating costs"
                    color="error"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <StatCard
                    title="Net Profit"
                    value={formatCurrency(dashboard?.kpis?.net_profit)}
                    subtitle={
                      Number(dashboard?.kpis?.net_profit || 0) >= 0 ? 'Operating surplus' : 'Operating deficit'
                    }
                    color={Number(dashboard?.kpis?.net_profit || 0) >= 0 ? 'success' : 'error'}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <StatCard
                    title="Liquid Cash & Bank"
                    value={formatCurrency(dashboard?.kpis?.total_liquid_funds)}
                    subtitle={`Cash: ${formatCurrency(dashboard?.kpis?.cash_balance)} | Bank: ${formatCurrency(dashboard?.kpis?.bank_balance)}`}
                    color="info"
                  />
                </Grid>
              </Grid>

              {/* Secondary KPIs: Receivables vs Payables & Inventory */}
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={4}>
                  <Card sx={{ height: '100%', borderLeft: '4px solid #3b82f6' }}>
                    <CardContent>
                      <Typography variant="overline" color="text.secondary">
                        Accounts Receivable (Owed to You)
                      </Typography>
                      <Typography variant="h5" fontWeight="bold" sx={{ my: 0.5, color: '#1e40af' }}>
                        {formatCurrency(dashboard?.kpis?.accounts_receivable)}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip
                          size="small"
                          label={`Overdue: ${formatCurrency(dashboard?.receivables_summary?.overdue)}`}
                          color={Number(dashboard?.receivables_summary?.overdue || 0) > 0 ? 'error' : 'default'}
                        />
                        <Typography variant="caption" color="text.secondary">
                          Collected: {formatCurrency(dashboard?.receivables_summary?.paid)}
                        </Typography>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Card sx={{ height: '100%', borderLeft: '4px solid #f59e0b' }}>
                    <CardContent>
                      <Typography variant="overline" color="text.secondary">
                        Accounts Payable (You Owe Vendors)
                      </Typography>
                      <Typography variant="h5" fontWeight="bold" sx={{ my: 0.5, color: '#b45309' }}>
                        {formatCurrency(dashboard?.kpis?.accounts_payable)}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip
                          size="small"
                          label={`Overdue: ${formatCurrency(dashboard?.payables_summary?.overdue)}`}
                          color={Number(dashboard?.payables_summary?.overdue || 0) > 0 ? 'error' : 'default'}
                        />
                        <Typography variant="caption" color="text.secondary">
                          Paid: {formatCurrency(dashboard?.payables_summary?.paid)}
                        </Typography>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Card sx={{ height: '100%', borderLeft: '4px solid #10b981' }}>
                    <CardContent>
                      <Typography variant="overline" color="text.secondary">
                        Inventory Valuation
                      </Typography>
                      <Typography variant="h5" fontWeight="bold" sx={{ my: 0.5, color: '#047857' }}>
                        {formatCurrency(dashboard?.kpis?.inventory_valuation)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Physical warehouse on-hand stock valued at cost
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* 6-Month Monthly Performance Trend */}
              <Card>
                <CardContent>
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    6-Month Financial Performance Trends
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Real-time comparison of monthly revenue, expenditures, and net income.
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead sx={{ bgcolor: 'action.hover' }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>Period Month</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>Revenue</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>Expenses</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>Net Income</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 'bold' }}>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {dashboard?.monthly_trends?.map((m, idx) => (
                          <TableRow key={idx} hover>
                            <TableCell sx={{ fontWeight: 'medium' }}>{m.month}</TableCell>
                            <TableCell align="right" sx={{ color: 'success.main', fontWeight: 'bold' }}>
                              {formatCurrency(m.revenue)}
                            </TableCell>
                            <TableCell align="right" sx={{ color: 'error.main' }}>
                              {formatCurrency(m.expenses)}
                            </TableCell>
                            <TableCell
                              align="right"
                              sx={{
                                fontWeight: 'bold',
                                color: m.net_profit >= 0 ? 'success.main' : 'error.main',
                              }}
                            >
                              {formatCurrency(m.net_profit)}
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                size="small"
                                label={m.net_profit >= 0 ? 'Profitable' : 'Deficit'}
                                color={m.net_profit >= 0 ? 'success' : 'error'}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Stack>
          )}
        </Box>
      )}

      {/* ============================================================ */}
      {/* TAB 1: CHART OF ACCOUNTS */}
      {/* ============================================================ */}
      {activeTab === 1 && (
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {['ALL', 'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'].map((cat) => (
                <Chip
                  key={cat}
                  label={cat}
                  clickable
                  color={coaCategoryFilter === cat ? 'primary' : 'default'}
                  onClick={() => setCoaCategoryFilter(cat)}
                  sx={{ my: 0.5 }}
                />
              ))}
            </Stack>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <TextField
                size="small"
                placeholder="Search code or name..."
                value={coaSearch}
                onChange={(e) => setCoaSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAccountModalOpen(true)}>
                Add Account
              </Button>
            </Stack>
          </Stack>

          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead sx={{ bgcolor: 'action.hover' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Code</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Account Name</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Category</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Normal Balance</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Current Net Balance</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>System</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredAccounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        No accounts found. Click "Seed Default CoA" to initialize the standard Chart of Accounts.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAccounts.map((acc) => (
                    <TableRow key={acc.id} hover>
                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                        {acc.account_code}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {acc.account_name}
                        </Typography>
                        {acc.description && (
                          <Typography variant="caption" color="text.secondary">
                            {acc.description}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={acc.category_display || acc.category}
                          color={CATEGORY_COLORS[acc.category] || 'default'}
                        />
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem', fontWeight: 'medium' }}>
                        {acc.normal_balance_type}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                        {formatCurrency(acc.current_balance)}
                      </TableCell>
                      <TableCell align="center">
                        {acc.is_system && <Chip size="small" label="System" variant="outlined" />}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          size="small"
                          label={acc.is_active ? 'Active' : 'Inactive'}
                          color={acc.is_active ? 'success' : 'default'}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      )}

      {/* ============================================================ */}
      {/* TAB 2: JOURNAL ENTRIES */}
      {/* ============================================================ */}
      {activeTab === 2 && (
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1.5} alignItems="center">
              <TextField
                size="small"
                placeholder="Search JE #, description..."
                value={jeSearch}
                onChange={(e) => setJeSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Reference Type</InputLabel>
                <Select
                  value={jeRefFilter}
                  label="Reference Type"
                  onChange={(e) => setJeRefFilter(e.target.value)}
                >
                  <MenuItem value="ALL">All References</MenuItem>
                  <MenuItem value="SALES_INVOICE">Sales Invoice</MenuItem>
                  <MenuItem value="SALES_PAYMENT">Sales Payment</MenuItem>
                  <MenuItem value="PURCHASE_BILL">Purchase Bill</MenuItem>
                  <MenuItem value="PURCHASE_PAYMENT">Purchase Payment</MenuItem>
                  <MenuItem value="MANUAL">Manual Entry</MenuItem>
                </Select>
              </FormControl>
              <IconButton onClick={fetchJournalEntries} size="small">
                <RefreshIcon />
              </IconButton>
            </Stack>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setJeModalOpen(true)}>
              Post Journal Entry
            </Button>
          </Stack>

          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead sx={{ bgcolor: 'action.hover' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Entry #</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Description</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Reference</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total DR = CR</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>Status</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredJournalEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        No journal entries found. Click "Post Journal Entry" or "Sync Sales & Bills" to generate entries.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredJournalEntries.map((je) => (
                    <TableRow key={je.id} hover>
                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                        {je.entry_number}
                      </TableCell>
                      <TableCell>{je.entry_date}</TableCell>
                      <TableCell sx={{ maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {je.description}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={je.reference_type || 'MANUAL'}
                          variant="outlined"
                          color={je.reference_type?.startsWith('SALES') ? 'primary' : 'default'}
                        />
                        {je.reference_id && (
                          <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary', fontFamily: 'monospace' }}>
                            {je.reference_id}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                        {formatCurrency(je.total_debit)}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          size="small"
                          label={je.status}
                          color={je.status === 'POSTED' ? 'success' : 'error'}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={0.5} justifyContent="center">
                          <Tooltip title="View Posting Details">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setSelectedEntry(je);
                                setJeViewModalOpen(true);
                              }}
                            >
                              <VisibilityOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {je.status === 'POSTED' && (
                            <Tooltip title="Cancel Entry (Audit reversal)">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleCancelJournalEntry(je.id)}
                              >
                                <CancelOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      )}

      {/* ============================================================ */}
      {/* TAB 3: GENERAL LEDGER */}
      {/* ============================================================ */}
      {activeTab === 3 && (
        <Stack spacing={2}>
          <Card variant="outlined">
            <CardContent>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Account</InputLabel>
                    <Select
                      value={selectedGlAccount}
                      label="Account"
                      onChange={(e) => setSelectedGlAccount(e.target.value)}
                    >
                      <MenuItem value="">All Accounts</MenuItem>
                      {accounts.map((acc) => (
                        <MenuItem key={acc.id} value={acc.id}>
                          {acc.account_code} - {acc.account_name} ({acc.category})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    type="date"
                    label="Date From"
                    InputLabelProps={{ shrink: true }}
                    value={glDateFrom}
                    onChange={(e) => setGlDateFrom(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    type="date"
                    label="Date To"
                    InputLabelProps={{ shrink: true }}
                    value={glDateTo}
                    onChange={(e) => setGlDateTo(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={fetchGeneralLedger}
                    startIcon={<RefreshIcon />}
                  >
                    Filter
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {glReports.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">
                No ledger activity matching the specified criteria.
              </Typography>
            </Paper>
          ) : (
            glReports.map((report) => (
              <Card key={report.account_id} variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Typography variant="h6" fontWeight="bold">
                        {report.account_code} - {report.account_name}
                      </Typography>
                      <Chip size="small" label={report.category} color={CATEGORY_COLORS[report.category] || 'default'} />
                      <Chip size="small" label={`Normal: ${report.normal_balance_type}`} variant="outlined" />
                    </Stack>
                    <Stack direction="row" spacing={2}>
                      <Typography variant="body2">
                        Opening: <strong>{formatCurrency(report.opening_balance)}</strong>
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'success.main' }}>
                        DR: <strong>{formatCurrency(report.total_debit)}</strong>
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'error.main' }}>
                        CR: <strong>{formatCurrency(report.total_credit)}</strong>
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        Closing: <strong>{formatCurrency(report.closing_balance)}</strong>
                      </Typography>
                    </Stack>
                  </Stack>

                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead sx={{ bgcolor: 'action.hover' }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Entry #</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Description</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Reference</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>Debit</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>Credit</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>Running Balance</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {report.transactions.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} align="center" sx={{ py: 2 }}>
                              <Typography variant="body2" color="text.secondary">
                                No posted transactions in this window. Balance remains at opening value.
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          report.transactions.map((tx) => (
                            <TableRow key={tx.line_id} hover>
                              <TableCell>{tx.entry_date}</TableCell>
                              <TableCell sx={{ fontFamily: 'monospace', fontWeight: 'medium' }}>
                                {tx.entry_number}
                              </TableCell>
                              <TableCell>{tx.description}</TableCell>
                              <TableCell>
                                <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                                  {tx.reference_type} {tx.reference_id && `(${tx.reference_id})`}
                                </Typography>
                              </TableCell>
                              <TableCell align="right" sx={{ color: Number(tx.debit) > 0 ? 'success.main' : 'text.disabled' }}>
                                {Number(tx.debit) > 0 ? formatCurrency(tx.debit) : '-'}
                              </TableCell>
                              <TableCell align="right" sx={{ color: Number(tx.credit) > 0 ? 'error.main' : 'text.disabled' }}>
                                {Number(tx.credit) > 0 ? formatCurrency(tx.credit) : '-'}
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                {formatCurrency(tx.running_balance)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            ))
          )}
        </Stack>
      )}

      {/* ============================================================ */}
      {/* TAB 4: ACCOUNTS RECEIVABLE */}
      {/* ============================================================ */}
      {activeTab === 4 && (
        <Stack spacing={3}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Total Invoiced"
                value={formatCurrency(arData?.total_receivables)}
                subtitle={`${arData?.invoices_count || 0} customer invoices`}
                color="primary"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Total Collected"
                value={formatCurrency(arData?.total_paid)}
                subtitle="Cleared receipts"
                color="success"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Outstanding A/R"
                value={formatCurrency(arData?.total_outstanding)}
                subtitle="Pending customer payment"
                color="warning"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Overdue A/R"
                value={formatCurrency(arData?.total_overdue)}
                subtitle="Due date passed"
                color="error"
              />
            </Grid>
          </Grid>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Customer Aging & Receivable Breakdown
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead sx={{ bgcolor: 'action.hover' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Customer Name</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Contact</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold' }}>Invoices</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total Invoiced</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total Paid</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Balance Due</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Overdue Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {!arData?.customer_breakdown || arData.customer_breakdown.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                          <Typography color="text.secondary">No customer receivable records found.</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      arData.customer_breakdown.map((c) => (
                        <TableRow key={c.customer_id} hover>
                          <TableCell sx={{ fontWeight: 'bold' }}>{c.customer_name}</TableCell>
                          <TableCell>
                            <Typography variant="caption" display="block">{c.email || '-'}</Typography>
                            <Typography variant="caption" color="text.secondary">{c.phone || '-'}</Typography>
                          </TableCell>
                          <TableCell align="center">{c.invoice_count}</TableCell>
                          <TableCell align="right">{formatCurrency(c.total_invoiced)}</TableCell>
                          <TableCell align="right" sx={{ color: 'success.main' }}>{formatCurrency(c.total_paid)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(c.balance_due)}</TableCell>
                          <TableCell
                            align="right"
                            sx={{
                              color: Number(c.overdue_amount) > 0 ? 'error.main' : 'text.secondary',
                              fontWeight: Number(c.overdue_amount) > 0 ? 'bold' : 'normal',
                            }}
                          >
                            {formatCurrency(c.overdue_amount)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Stack>
      )}

      {/* ============================================================ */}
      {/* TAB 5: ACCOUNTS PAYABLE */}
      {/* ============================================================ */}
      {activeTab === 5 && (
        <Stack spacing={3}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Total Billed"
                value={formatCurrency(apData?.total_payables)}
                subtitle={`${apData?.bills_count || 0} vendor bills`}
                color="primary"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Total Paid"
                value={formatCurrency(apData?.total_paid)}
                subtitle="Disbursed payments"
                color="success"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Outstanding A/P"
                value={formatCurrency(apData?.total_outstanding)}
                subtitle="Pending remittance"
                color="warning"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Overdue A/P"
                value={formatCurrency(apData?.total_overdue)}
                subtitle="Due date passed"
                color="error"
              />
            </Grid>
          </Grid>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Vendor Aging & Payable Breakdown
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead sx={{ bgcolor: 'action.hover' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Vendor Name</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Contact</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold' }}>Bills</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total Billed</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total Paid</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Balance Due</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Overdue Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {!apData?.vendor_breakdown || apData.vendor_breakdown.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                          <Typography color="text.secondary">No vendor payable records found.</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      apData.vendor_breakdown.map((v) => (
                        <TableRow key={v.vendor_id} hover>
                          <TableCell sx={{ fontWeight: 'bold' }}>{v.vendor_name}</TableCell>
                          <TableCell>
                            <Typography variant="caption" display="block">{v.email || '-'}</Typography>
                            <Typography variant="caption" color="text.secondary">{v.phone || '-'}</Typography>
                          </TableCell>
                          <TableCell align="center">{v.bills_count}</TableCell>
                          <TableCell align="right">{formatCurrency(v.total_billed)}</TableCell>
                          <TableCell align="right" sx={{ color: 'success.main' }}>{formatCurrency(v.total_paid)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(v.balance_due)}</TableCell>
                          <TableCell
                            align="right"
                            sx={{
                              color: Number(v.overdue_amount) > 0 ? 'error.main' : 'text.secondary',
                              fontWeight: Number(v.overdue_amount) > 0 ? 'bold' : 'normal',
                            }}
                          >
                            {formatCurrency(v.overdue_amount)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Stack>
      )}

      {/* ============================================================ */}
      {/* TAB 6: CASH & BANK */}
      {/* ============================================================ */}
      {activeTab === 6 && (
        <Stack spacing={3}>
          {/* Bank Accounts Section */}
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h6" fontWeight="bold">
                Operating Bank Accounts
              </Typography>
              <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setBankModalOpen(true)}>
                Add Bank Account
              </Button>
            </Stack>
            <Grid container spacing={2}>
              {bankAccounts.length === 0 ? (
                <Grid item xs={12}>
                  <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                    <Typography color="text.secondary">No bank accounts registered.</Typography>
                  </Paper>
                </Grid>
              ) : (
                bankAccounts.map((b) => (
                  <Grid item xs={12} sm={6} md={4} key={b.id}>
                    <Card variant="outlined" sx={{ borderTop: '4px solid #3b82f6' }}>
                      <CardContent>
                        <Typography variant="overline" color="text.secondary">
                          {b.bank_name}
                        </Typography>
                        <Typography variant="h6" fontWeight="bold">
                          {b.account_name || 'Operating Account'}
                        </Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                          A/C: {b.account_number}
                        </Typography>
                        <Divider sx={{ my: 1.5 }} />
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" color="text.secondary">
                            Code: {b.account_code}
                          </Typography>
                          <Typography variant="h6" fontWeight="bold" sx={{ color: '#1e40af' }}>
                            {formatCurrency(b.current_balance)}
                          </Typography>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                ))
              )}
            </Grid>
          </Box>

          {/* Cash Accounts Section */}
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h6" fontWeight="bold">
                Cash Registers & Petty Cash
              </Typography>
              <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setCashModalOpen(true)}>
                Add Cash Register
              </Button>
            </Stack>
            <Grid container spacing={2}>
              {cashAccounts.length === 0 ? (
                <Grid item xs={12}>
                  <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                    <Typography color="text.secondary">No cash registers registered.</Typography>
                  </Paper>
                </Grid>
              ) : (
                cashAccounts.map((c) => (
                  <Grid item xs={12} sm={6} md={4} key={c.id}>
                    <Card variant="outlined" sx={{ borderTop: '4px solid #10b981' }}>
                      <CardContent>
                        <Typography variant="overline" color="text.secondary">
                          Cash Account
                        </Typography>
                        <Typography variant="h6" fontWeight="bold">
                          {c.account_name}
                        </Typography>
                        <Divider sx={{ my: 1.5 }} />
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" color="text.secondary">
                            Code: {c.account_code}
                          </Typography>
                          <Typography variant="h6" fontWeight="bold" sx={{ color: '#047857' }}>
                            {formatCurrency(c.current_balance)}
                          </Typography>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                ))
              )}
            </Grid>
          </Box>
        </Stack>
      )}

      {/* ============================================================ */}
      {/* TAB 7: FINANCIAL STATEMENTS */}
      {/* ============================================================ */}
      {activeTab === 7 && (
        <Stack spacing={2}>
          <Card variant="outlined">
            <CardContent>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems="center">
                <Stack direction="row" spacing={1}>
                  <Button
                    variant={statementType === 'TB' ? 'contained' : 'outlined'}
                    onClick={() => setStatementType('TB')}
                  >
                    Trial Balance
                  </Button>
                  <Button
                    variant={statementType === 'PNL' ? 'contained' : 'outlined'}
                    onClick={() => setStatementType('PNL')}
                  >
                    Profit & Loss (P&L)
                  </Button>
                  <Button
                    variant={statementType === 'BS' ? 'contained' : 'outlined'}
                    onClick={() => setStatementType('BS')}
                  >
                    Balance Sheet
                  </Button>
                </Stack>

                <Stack direction="row" spacing={1.5} alignItems="center">
                  {statementType === 'PNL' && (
                    <TextField
                      size="small"
                      type="date"
                      label="From"
                      InputLabelProps={{ shrink: true }}
                      value={statementDateFrom}
                      onChange={(e) => setStatementDateFrom(e.target.value)}
                    />
                  )}
                  <TextField
                    size="small"
                    type="date"
                    label={statementType === 'PNL' ? 'To' : 'As of Date'}
                    InputLabelProps={{ shrink: true }}
                    value={statementDateTo}
                    onChange={(e) => setStatementDateTo(e.target.value)}
                  />
                  <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchStatements}>
                    Generate
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          {/* 1. Trial Balance Report */}
          {statementType === 'TB' && trialBalanceData && (
            <Card variant="outlined">
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Typography variant="h6" fontWeight="bold">
                    Trial Balance as of {trialBalanceData.as_of_date}
                  </Typography>
                  <Chip
                    icon={<CheckCircleOutlineOutlinedIcon />}
                    label={trialBalanceData.is_balanced ? 'Balanced (Total DR == Total CR)' : 'Unbalanced!'}
                    color={trialBalanceData.is_balanced ? 'success' : 'error'}
                  />
                </Stack>

                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead sx={{ bgcolor: 'action.hover' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>Code</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Account Name</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Category</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Debit Balance</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Credit Balance</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {trialBalanceData.accounts?.map((acc) => (
                        <TableRow key={acc.account_id} hover>
                          <TableCell sx={{ fontFamily: 'monospace' }}>{acc.account_code}</TableCell>
                          <TableCell>{acc.account_name}</TableCell>
                          <TableCell>
                            <Chip size="small" label={acc.category} color={CATEGORY_COLORS[acc.category] || 'default'} />
                          </TableCell>
                          <TableCell align="right">
                            {Number(acc.debit_balance) > 0 ? formatCurrency(acc.debit_balance) : '-'}
                          </TableCell>
                          <TableCell align="right">
                            {Number(acc.credit_balance) > 0 ? formatCurrency(acc.credit_balance) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Grand Totals */}
                      <TableRow sx={{ bgcolor: 'action.selected' }}>
                        <TableCell colSpan={3} sx={{ fontWeight: 'bold', fontSize: '1rem' }}>
                          Grand Totals
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '1rem', color: 'success.main' }}>
                          {formatCurrency(trialBalanceData.total_debits)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '1rem', color: 'success.main' }}>
                          {formatCurrency(trialBalanceData.total_credits)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}

          {/* 2. Profit & Loss Report */}
          {statementType === 'PNL' && pnlData && (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                  Income Statement (Profit & Loss)
                </Typography>

                {/* Revenue Section */}
                <Typography variant="subtitle1" fontWeight="bold" sx={{ color: 'success.main', mt: 1 }}>
                  Operating Revenue
                </Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                  <Table size="small">
                    <TableBody>
                      {pnlData.revenue?.items?.map((item) => (
                        <TableRow key={item.account_id}>
                          <TableCell>{item.account_code} - {item.account_name}</TableCell>
                          <TableCell align="right">{formatCurrency(item.amount)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow sx={{ bgcolor: 'action.hover' }}>
                        <TableCell sx={{ fontWeight: 'bold' }}>Total Revenue</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                          {formatCurrency(pnlData.revenue?.total)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Cost of Goods Sold Section */}
                <Typography variant="subtitle1" fontWeight="bold" sx={{ color: 'warning.main' }}>
                  Cost of Goods Sold (COGS)
                </Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                  <Table size="small">
                    <TableBody>
                      {pnlData.cost_of_goods_sold?.items?.map((item) => (
                        <TableRow key={item.account_id}>
                          <TableCell>{item.account_code} - {item.account_name}</TableCell>
                          <TableCell align="right">{formatCurrency(item.amount)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow sx={{ bgcolor: 'action.hover' }}>
                        <TableCell sx={{ fontWeight: 'bold' }}>Total COGS</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: 'warning.main' }}>
                          {formatCurrency(pnlData.cost_of_goods_sold?.total)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Gross Profit Callout */}
                <Paper sx={{ p: 2, bgcolor: 'background.default', mb: 2, display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="h6" fontWeight="bold">Gross Profit</Typography>
                  <Typography variant="h6" fontWeight="bold" sx={{ color: 'primary.main' }}>
                    {formatCurrency(pnlData.gross_profit)}
                  </Typography>
                </Paper>

                {/* Operating Expenses Section */}
                <Typography variant="subtitle1" fontWeight="bold" sx={{ color: 'error.main' }}>
                  Operating & Administrative Expenses
                </Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                  <Table size="small">
                    <TableBody>
                      {pnlData.operating_expenses?.items?.map((item) => (
                        <TableRow key={item.account_id}>
                          <TableCell>{item.account_code} - {item.account_name}</TableCell>
                          <TableCell align="right">{formatCurrency(item.amount)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow sx={{ bgcolor: 'action.hover' }}>
                        <TableCell sx={{ fontWeight: 'bold' }}>Total Operating Expenses</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                          {formatCurrency(pnlData.operating_expenses?.total)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Net Income Callout */}
                <Paper
                  sx={{
                    p: 2.5,
                    bgcolor: Number(pnlData.net_profit) >= 0 ? (theme => theme.palette.mode === 'dark' ? 'rgba(16,185,129,0.1)' : '#ecfdf5') : (theme => theme.palette.mode === 'dark' ? 'rgba(239,68,68,0.1)' : '#fef2f2'),
                    border: '1px solid',
                    borderColor: Number(pnlData.net_profit) >= 0 ? '#10b981' : '#ef4444',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Typography variant="h5" fontWeight="bold" sx={{ color: Number(pnlData.net_profit) >= 0 ? '#047857' : '#b91c1c' }}>
                    Net Income (Profit / Loss)
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" sx={{ color: Number(pnlData.net_profit) >= 0 ? '#047857' : '#b91c1c' }}>
                    {formatCurrency(pnlData.net_profit)}
                  </Typography>
                </Paper>
              </CardContent>
            </Card>
          )}

          {/* 3. Balance Sheet Report */}
          {statementType === 'BS' && bsData && (
            <Card variant="outlined">
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Typography variant="h6" fontWeight="bold">
                    Balance Sheet as of {bsData.as_of_date}
                  </Typography>
                  <Chip
                    icon={<CheckCircleOutlineOutlinedIcon />}
                    label={bsData.is_balanced ? 'Assets = Liabilities + Equity' : 'Equation Discrepancy!'}
                    color={bsData.is_balanced ? 'success' : 'error'}
                  />
                </Stack>

                <Grid container spacing={3}>
                  {/* Left: Assets */}
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle1" fontWeight="bold" sx={{ color: 'primary.main', mb: 1 }}>
                      ASSETS
                    </Typography>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableBody>
                          {bsData.assets?.items?.map((item) => (
                            <TableRow key={item.account_id}>
                              <TableCell>{item.account_code} - {item.account_name}</TableCell>
                              <TableCell align="right">{formatCurrency(item.balance)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow sx={{ bgcolor: 'action.selected' }}>
                            <TableCell sx={{ fontWeight: 'bold', fontSize: '1rem' }}>Total Assets</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '1rem', color: 'primary.main' }}>
                              {formatCurrency(bsData.assets?.total)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Grid>

                  {/* Right: Liabilities & Equity */}
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle1" fontWeight="bold" sx={{ color: 'warning.main', mb: 1 }}>
                      LIABILITIES
                    </Typography>
                    <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                      <Table size="small">
                        <TableBody>
                          {bsData.liabilities?.items?.map((item) => (
                            <TableRow key={item.account_id}>
                              <TableCell>{item.account_code} - {item.account_name}</TableCell>
                              <TableCell align="right">{formatCurrency(item.balance)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow sx={{ bgcolor: 'action.hover' }}>
                            <TableCell sx={{ fontWeight: 'bold' }}>Total Liabilities</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', color: 'warning.main' }}>
                              {formatCurrency(bsData.liabilities?.total)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>

                    <Typography variant="subtitle1" fontWeight="bold" sx={{ color: 'info.main', mb: 1 }}>
                      EQUITY
                    </Typography>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableBody>
                          {bsData.equity?.items?.map((item) => (
                            <TableRow key={item.account_id}>
                              <TableCell>{item.account_code} - {item.account_name}</TableCell>
                              <TableCell align="right">{formatCurrency(item.balance)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow>
                            <TableCell sx={{ fontStyle: 'italic' }}>
                              Current Period Retained Earnings (Net Profit)
                            </TableCell>
                            <TableCell align="right" sx={{ fontStyle: 'italic' }}>
                              {formatCurrency(bsData.equity?.current_period_earnings)}
                            </TableCell>
                          </TableRow>
                          <TableRow sx={{ bgcolor: 'action.hover' }}>
                            <TableCell sx={{ fontWeight: 'bold' }}>Total Equity</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', color: 'info.main' }}>
                              {formatCurrency(bsData.equity?.total)}
                            </TableCell>
                          </TableRow>
                          <TableRow sx={{ bgcolor: 'action.selected' }}>
                            <TableCell sx={{ fontWeight: 'bold', fontSize: '1rem' }}>
                              Total Liabilities & Equity
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '1rem', color: 'primary.main' }}>
                              {formatCurrency(bsData.total_liabilities_and_equity)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          )}
        </Stack>
      )}

      {/* ============================================================ */}
      {/* MODAL 1: CREATE ACCOUNT */}
      {/* ============================================================ */}
      <Dialog open={accountModalOpen} onClose={() => setAccountModalOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleCreateAccountSubmit}>
          <DialogTitle>Add Chart of Accounts Entity</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    required
                    label="Account Code"
                    placeholder="e.g. 6400"
                    value={accountFormData.account_code}
                    onChange={(e) => setAccountFormData({ ...accountFormData, account_code: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={8}>
                  <TextField
                    fullWidth
                    required
                    label="Account Name"
                    placeholder="e.g. Software Subscriptions"
                    value={accountFormData.account_name}
                    onChange={(e) => setAccountFormData({ ...accountFormData, account_name: e.target.value })}
                  />
                </Grid>
              </Grid>

              <FormControl fullWidth required>
                <InputLabel>Category</InputLabel>
                <Select
                  value={accountFormData.category}
                  label="Category"
                  onChange={(e) => setAccountFormData({ ...accountFormData, category: e.target.value })}
                >
                  <MenuItem value="ASSET">Asset (Normal: Debit)</MenuItem>
                  <MenuItem value="LIABILITY">Liability (Normal: Credit)</MenuItem>
                  <MenuItem value="EQUITY">Equity (Normal: Credit)</MenuItem>
                  <MenuItem value="REVENUE">Revenue (Normal: Credit)</MenuItem>
                  <MenuItem value="EXPENSE">Expense (Normal: Debit)</MenuItem>
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="Opening Balance"
                type="number"
                inputProps={{ step: '0.01' }}
                value={accountFormData.opening_balance}
                onChange={(e) => setAccountFormData({ ...accountFormData, opening_balance: e.target.value })}
              />

              <TextField
                fullWidth
                multiline
                rows={2}
                label="Description / Purpose"
                value={accountFormData.description}
                onChange={(e) => setAccountFormData({ ...accountFormData, description: e.target.value })}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAccountModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={actionLoading}>
              {actionLoading ? <CircularProgress size={20} /> : 'Save Account'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ============================================================ */}
      {/* MODAL 2: NEW JOURNAL ENTRY */}
      {/* ============================================================ */}
      <Dialog open={jeModalOpen} onClose={() => setJeModalOpen(false)} maxWidth="md" fullWidth>
        <form onSubmit={handleCreateJournalEntrySubmit}>
          <DialogTitle>Post Double-Entry Journal Entry</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    required
                    type="date"
                    label="Entry Date"
                    InputLabelProps={{ shrink: true }}
                    value={jeFormData.entry_date}
                    onChange={(e) => setJeFormData({ ...jeFormData, entry_date: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth size="medium">
                    <InputLabel>Reference Type</InputLabel>
                    <Select
                      value={jeFormData.reference_type}
                      label="Reference Type"
                      onChange={(e) => setJeFormData({ ...jeFormData, reference_type: e.target.value })}
                    >
                      <MenuItem value="MANUAL">Manual Adjustment</MenuItem>
                      <MenuItem value="SALES_INVOICE">Sales Invoice</MenuItem>
                      <MenuItem value="SALES_PAYMENT">Sales Payment</MenuItem>
                      <MenuItem value="PURCHASE_BILL">Purchase Bill</MenuItem>
                      <MenuItem value="PURCHASE_PAYMENT">Purchase Payment</MenuItem>
                      <MenuItem value="CASH_TRANSFER">Cash / Bank Transfer</MenuItem>
                      <MenuItem value="OPENING_BALANCE">Opening Balance</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Reference ID / Doc #"
                    placeholder="e.g. DOC-9901"
                    value={jeFormData.reference_id}
                    onChange={(e) => setJeFormData({ ...jeFormData, reference_id: e.target.value })}
                  />
                </Grid>
              </Grid>

              <TextField
                fullWidth
                required
                label="Transaction Description"
                placeholder="Narrative explanation of the transaction"
                value={jeFormData.description}
                onChange={(e) => setJeFormData({ ...jeFormData, description: e.target.value })}
              />

              <Divider />

              {/* Line items table */}
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="subtitle2" fontWeight="bold">
                    Journal Posting Lines (Min 2 required)
                  </Typography>
                  <Button size="small" startIcon={<AddIcon />} onClick={handleAddJeLine}>
                    Add Line
                  </Button>
                </Stack>

                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead sx={{ bgcolor: 'action.hover' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold', width: '35%' }}>Account</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', width: '20%' }}>Debit ($)</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', width: '20%' }}>Credit ($)</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', width: '20%' }}>Line Memo</TableCell>
                        <TableCell sx={{ width: '5%' }} />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {jeFormData.lines.map((line, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <FormControl fullWidth size="small" required>
                              <Select
                                value={line.account}
                                displayEmpty
                                onChange={(e) => handleJeLineChange(idx, 'account', e.target.value)}
                              >
                                <MenuItem value="">
                                  <em>Select Account...</em>
                                </MenuItem>
                                {accounts.map((acc) => (
                                  <MenuItem key={acc.id} value={acc.id}>
                                    {acc.account_code} - {acc.account_name} ({acc.category})
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              type="number"
                              inputProps={{ step: '0.01', min: '0' }}
                              value={line.debit}
                              onChange={(e) => handleJeLineChange(idx, 'debit', e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              type="number"
                              inputProps={{ step: '0.01', min: '0' }}
                              value={line.credit}
                              onChange={(e) => handleJeLineChange(idx, 'credit', e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              placeholder="Memo"
                              value={line.description}
                              onChange={(e) => handleJeLineChange(idx, 'description', e.target.value)}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleRemoveJeLine(idx)}
                              disabled={jeFormData.lines.length <= 2}
                            >
                              <DeleteOutlineOutlinedIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}

                      {/* Totals & Balance Verification */}
                      <TableRow sx={{ bgcolor: 'action.selected' }}>
                        <TableCell sx={{ fontWeight: 'bold' }}>Totals & Balance</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: 'success.main' }}>
                          ${totalJeDebit.toFixed(2)}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: 'success.main' }}>
                          ${totalJeCredit.toFixed(2)}
                        </TableCell>
                        <TableCell colSpan={2}>
                          {isJeBalanced ? (
                            <Chip size="small" label="Balanced" color="success" icon={<CheckCircleOutlineOutlinedIcon />} />
                          ) : (
                            <Chip
                              size="small"
                              label={`Diff: ${formatCurrency(Math.abs(totalJeDebit - totalJeCredit).toFixed(2))}`}
                              color="error"
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setJeModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={actionLoading || !isJeBalanced}>
              {actionLoading ? <CircularProgress size={20} /> : 'Post to General Ledger'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ============================================================ */}
      {/* MODAL 3: VIEW JOURNAL ENTRY DETAILS */}
      {/* ============================================================ */}
      <Dialog open={jeViewModalOpen} onClose={() => setJeViewModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Journal Entry {selectedEntry?.entry_number}</DialogTitle>
        <DialogContent dividers>
          {selectedEntry && (
            <Stack spacing={2}>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Posting Date</Typography>
                  <Typography variant="body1" fontWeight="medium">{selectedEntry.entry_date}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Status</Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <Chip size="small" label={selectedEntry.status} color={selectedEntry.status === 'POSTED' ? 'success' : 'error'} />
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Reference</Typography>
                  <Typography variant="body2">{selectedEntry.reference_type} {selectedEntry.reference_id && `(${selectedEntry.reference_id})`}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Created By</Typography>
                  <Typography variant="body2">{selectedEntry.created_by_name}</Typography>
                </Grid>
              </Grid>

              <Typography variant="caption" color="text.secondary">Narrative Description</Typography>
              <Typography variant="body2" sx={{ fontStyle: 'italic', bgcolor: 'action.hover', p: 1, borderRadius: 1 }}>
                {selectedEntry.description}
              </Typography>

              <Typography variant="subtitle2" fontWeight="bold">Lines Breakdown</Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead sx={{ bgcolor: 'action.hover' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Account</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Debit</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Credit</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedEntry.lines?.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">{line.account_code} - {line.account_name}</Typography>
                          {line.description && <Typography variant="caption" color="text.secondary">{line.description}</Typography>}
                        </TableCell>
                        <TableCell align="right" sx={{ color: Number(line.debit) > 0 ? 'success.main' : 'text.disabled' }}>
                          {Number(line.debit) > 0 ? formatCurrency(line.debit) : '-'}
                        </TableCell>
                        <TableCell align="right" sx={{ color: Number(line.credit) > 0 ? 'error.main' : 'text.disabled' }}>
                          {Number(line.credit) > 0 ? formatCurrency(line.credit) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ bgcolor: 'action.selected' }}>
                      <TableCell sx={{ fontWeight: 'bold' }}>Totals</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(selectedEntry.total_debit)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(selectedEntry.total_credit)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setJeViewModalOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* ============================================================ */}
      {/* MODAL 4: ADD BANK ACCOUNT */}
      {/* ============================================================ */}
      <Dialog open={bankModalOpen} onClose={() => setBankModalOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleCreateBankSubmit}>
          <DialogTitle>Register Operating Bank Account</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <FormControl fullWidth required>
                <InputLabel>Chart of Accounts Asset Account</InputLabel>
                <Select
                  value={bankFormData.account}
                  label="Chart of Accounts Asset Account"
                  onChange={(e) => setBankFormData({ ...bankFormData, account: e.target.value })}
                >
                  {accounts
                    .filter((a) => a.category === 'ASSET')
                    .map((a) => (
                      <MenuItem key={a.id} value={a.id}>
                        {a.account_code} - {a.account_name}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>

              <TextField
                fullWidth
                required
                label="Bank Name"
                placeholder="e.g. JPMorgan Chase"
                value={bankFormData.bank_name}
                onChange={(e) => setBankFormData({ ...bankFormData, bank_name: e.target.value })}
              />

              <TextField
                fullWidth
                label="Account Label / Description"
                placeholder="e.g. Main Payroll Checking"
                value={bankFormData.account_name}
                onChange={(e) => setBankFormData({ ...bankFormData, account_name: e.target.value })}
              />

              <Grid container spacing={2}>
                <Grid item xs={12} sm={8}>
                  <TextField
                    fullWidth
                    required
                    label="Account Number"
                    value={bankFormData.account_number}
                    onChange={(e) => setBankFormData({ ...bankFormData, account_number: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Currency"
                    value={bankFormData.currency}
                    onChange={(e) => setBankFormData({ ...bankFormData, currency: e.target.value })}
                  />
                </Grid>
              </Grid>

              <TextField
                fullWidth
                label="Branch / Routing Number"
                value={bankFormData.branch_name}
                onChange={(e) => setBankFormData({ ...bankFormData, branch_name: e.target.value })}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setBankModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={actionLoading}>
              {actionLoading ? <CircularProgress size={20} /> : 'Save Bank Account'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ============================================================ */}
      {/* MODAL 5: ADD CASH ACCOUNT */}
      {/* ============================================================ */}
      <Dialog open={cashModalOpen} onClose={() => setCashModalOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleCreateCashSubmit}>
          <DialogTitle>Register Cash Register / Petty Cash</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <FormControl fullWidth required>
                <InputLabel>Chart of Accounts Asset Account</InputLabel>
                <Select
                  value={cashFormData.account}
                  label="Chart of Accounts Asset Account"
                  onChange={(e) => setCashFormData({ ...cashFormData, account: e.target.value })}
                >
                  {accounts
                    .filter((a) => a.category === 'ASSET')
                    .map((a) => (
                      <MenuItem key={a.id} value={a.id}>
                        {a.account_code} - {a.account_name}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>

              <TextField
                fullWidth
                required
                label="Register / Drawer Name"
                placeholder="e.g. Front Desk Petty Cash"
                value={cashFormData.account_name}
                onChange={(e) => setCashFormData({ ...cashFormData, account_name: e.target.value })}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCashModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={actionLoading}>
              {actionLoading ? <CircularProgress size={20} /> : 'Save Cash Register'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Feedback Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
