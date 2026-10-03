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
  TextField,
  Paper,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  IconButton,
  Tooltip,
} from '@mui/material';

// Icons
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import PointOfSaleOutlinedIcon from '@mui/icons-material/PointOfSaleOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import TrendingDownOutlinedIcon from '@mui/icons-material/TrendingDownOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';

import PageHeader from '../components/common/PageHeader';
import StatCard from '../components/common/StatCard';
import EmptyState from '../components/common/EmptyState';
import LoadingState from '../components/common/LoadingState';
import reportsService from '../services/reportsService';
import { useCompany } from '../context/CompanyContext';
import { extractErrorMessage } from '../utils/errorUtils';



export default function ReportsPage() {
  const { activeCompany, loading: companyLoading } = useCompany();

  // Tab Index: 0=Executive, 1=Sales, 2=Purchase, 3=Inventory, 4=CRM, 5=Finance, 6=HR, 7=Monthly
  const [activeTab, setActiveTab] = useState(0);

  // Date Range Filtering (Default: current month start to today)
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  const [dateFrom, setDateFrom] = useState(firstDayOfMonth);
  const [dateTo, setDateTo] = useState(today);

  // Data States
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Tab Type Mapping
  const tabTypes = ['executive', 'sales', 'purchase', 'inventory', 'crm', 'finance', 'employees', 'monthly'];
  const currentReportType = tabTypes[activeTab];

  // Fetch Report Data based on active tab and date filters
  const loadReport = useCallback(async () => {
    if (!activeCompany?.id) return;
    try {
      setLoading(true);
      setError(null);
      let data = null;

      switch (activeTab) {
        case 0:
          data = await reportsService.getExecutiveReport(activeCompany.id, dateFrom, dateTo);
          break;
        case 1:
          data = await reportsService.getSalesReport(activeCompany.id, dateFrom, dateTo);
          break;
        case 2:
          data = await reportsService.getPurchaseReport(activeCompany.id, dateFrom, dateTo);
          break;
        case 3:
          data = await reportsService.getInventoryReport(activeCompany.id);
          break;
        case 4:
          data = await reportsService.getCRMReport(activeCompany.id, dateFrom, dateTo);
          break;
        case 5:
          data = await reportsService.getFinanceReport(activeCompany.id, dateFrom, dateTo);
          break;
        case 6:
          data = await reportsService.getEmployeeReport(activeCompany.id);
          break;
        case 7:
          data = await reportsService.getMonthlyReport(activeCompany.id, 6);
          break;
        default:
          data = await reportsService.getExecutiveReport(activeCompany.id, dateFrom, dateTo);
      }
      setReportData(data);
    } catch (err) {
      console.error('Failed to load report:', err);
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [activeCompany?.id, activeTab, dateFrom, dateTo]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // Handle Preset Filters
  const applyPreset = (preset) => {
    const todayDate = new Date();
    const todayStr = todayDate.toISOString().slice(0, 10);

    if (preset === 'this_month') {
      const start = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1).toISOString().slice(0, 10);
      setDateFrom(start);
      setDateTo(todayStr);
    } else if (preset === 'last_30') {
      const past = new Date(todayDate.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      setDateFrom(past);
      setDateTo(todayStr);
    } else if (preset === 'ytd') {
      const start = new Date(todayDate.getFullYear(), 0, 1).toISOString().slice(0, 10);
      setDateFrom(start);
      setDateTo(todayStr);
    } else if (preset === 'all') {
      setDateFrom('');
      setDateTo('');
    }
  };

  // Handle CSV Export
  const handleExportCSV = async () => {
    if (!activeCompany?.id || exporting) return;
    try {
      setExporting(true);
      await reportsService.downloadCSV(activeCompany.id, currentReportType, dateFrom, dateTo);
    } catch (err) {
      console.error('CSV export failed:', err);
      alert('Failed to export CSV: ' + extractErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  if (companyLoading) {
    return <LoadingState message="Loading company context..." />;
  }

  if (!activeCompany) {
    return (
      <EmptyState
        title="No Company Selected"
        description="Please select an active company to access consolidated reporting and administrative summaries."
      />
    );
  }

  return (
    <Box sx={{ pb: 6 }}>
      {/* Page Header */}
      <PageHeader
        title="Reporting & Admin Consolidation"
        subtitle="Centralized operational telemetry, cross-module business intelligence, and audit-ready data exports."
        action={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Button
              variant="outlined"
              color="primary"
              startIcon={exporting ? <CircularProgress size={16} /> : <FileDownloadOutlinedIcon />}
              onClick={handleExportCSV}
              disabled={exporting || loading}
              size="small"
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
            >
              Export {currentReportType.toUpperCase()} (CSV)
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={<RefreshIcon />}
              onClick={loadReport}
              disabled={loading}
              size="small"
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
            >
              Refresh
            </Button>
          </Stack>
        }
      />

      {/* Date Range & Preset Filtering Toolbar */}
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2.5, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, md: 5 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <TextField
                label="Date From"
                type="date"
                size="small"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ minWidth: 150 }}
              />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>to</Typography>
              <TextField
                label="Date To"
                type="date"
                size="small"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ minWidth: 150 }}
              />
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, md: 7 }}>
            <Stack direction="row" spacing={1} justifyContent={{ xs: 'flex-start', md: 'flex-end' }} flexWrap="wrap">
              <Typography variant="caption" sx={{ alignSelf: 'center', mr: 1, color: 'text.secondary', fontWeight: 600 }}>
                Presets:
              </Typography>
              <Chip label="This Month" size="small" onClick={() => applyPreset('this_month')} clickable variant="outlined" />
              <Chip label="Last 30 Days" size="small" onClick={() => applyPreset('last_30')} clickable variant="outlined" />
              <Chip label="Year to Date" size="small" onClick={() => applyPreset('ytd')} clickable variant="outlined" />
              <Chip label="All Time" size="small" onClick={() => applyPreset('all')} clickable variant="outlined" />
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* Navigation Tabs (8 Modules) */}
      <Paper variant="outlined" sx={{ borderRadius: 2.5, mb: 3, overflow: 'hidden' }}>
        <Tabs
          value={activeTab}
          onChange={(_, val) => setActiveTab(val)}
          variant="scrollable"
          scrollButtons="auto"
          indicatorColor="primary"
          textColor="primary"
          sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
        >
          <Tab icon={<AssessmentOutlinedIcon />} iconPosition="start" label="Executive" />
          <Tab icon={<PointOfSaleOutlinedIcon />} iconPosition="start" label="Sales" />
          <Tab icon={<ShoppingCartOutlinedIcon />} iconPosition="start" label="Purchase" />
          <Tab icon={<Inventory2OutlinedIcon />} iconPosition="start" label="Inventory" />
          <Tab icon={<PeopleAltOutlinedIcon />} iconPosition="start" label="CRM" />
          <Tab icon={<AccountBalanceWalletOutlinedIcon />} iconPosition="start" label="Finance" />
          <Tab icon={<BadgeOutlinedIcon />} iconPosition="start" label="Employees" />
          <Tab icon={<CalendarMonthOutlinedIcon />} iconPosition="start" label="Monthly Trends" />
        </Tabs>
      </Paper>

      {/* Loading & Error States */}
      {loading ? (
        <LoadingState message={`Generating ${currentReportType.toUpperCase()} consolidated report...`} />
      ) : error ? (
        <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>
      ) : !reportData ? (
        <EmptyState title="No Report Available" description="No report telemetry found for this criteria." />
      ) : (
        <Box>
          {/* ============================================================
              TAB 0: EXECUTIVE DASHBOARD REPORT
              ============================================================ */}
          {activeTab === 0 && (
            <Box>
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard
                    title="Total Sales (Invoiced)"
                    value={reportData.kpis?.sales_total_formatted || '₹0.00'}
                    subtitle={`Paid: ${reportData.kpis?.sales_paid_formatted || '₹0.00'}`}
                    icon={PointOfSaleOutlinedIcon}
                    color="primary"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard
                    title="Total Purchases (Billed)"
                    value={reportData.kpis?.purchase_total_formatted || '₹0.00'}
                    subtitle={`Paid: ${reportData.kpis?.purchase_paid_formatted || '₹0.00'}`}
                    icon={ShoppingCartOutlinedIcon}
                    color="warning"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard
                    title="Operating Net Profit"
                    value={reportData.kpis?.net_profit_formatted || '₹0.00'}
                    subtitle={`Gross: ${reportData.kpis?.gross_profit_formatted || '₹0.00'}`}
                    icon={TrendingUpOutlinedIcon}
                    color="success"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard
                    title="Liquid Funds (Cash+Bank)"
                    value={reportData.kpis?.liquid_funds_formatted || '₹0.00'}
                    subtitle={`Receivables: ${reportData.kpis?.sales_outstanding_formatted || '₹0.00'}`}
                    icon={AccountBalanceWalletOutlinedIcon}
                    color="info"
                  />
                </Grid>
              </Grid>

              {/* Secondary Metrics Row */}
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Card variant="outlined" sx={{ borderRadius: 2.5, height: '100%' }}>
                    <CardContent>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
                        Operational Comparison: Sales vs Purchases
                      </Typography>
                      <Divider sx={{ mb: 2 }} />
                      <Stack spacing={2}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2" color="text.secondary">Sales Invoices Total</Typography>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            {reportData.kpis?.sales_total_formatted} ({reportData.kpis?.invoices_count} invoices)
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2" color="text.secondary">Purchase Bills Total</Typography>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'warning.main' }}>
                            {reportData.kpis?.purchase_total_formatted} ({reportData.kpis?.bills_count} bills)
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2" color="text.secondary">Net Cash Collections Difference</Typography>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'success.main' }}>
                            {reportData.sales_vs_purchase?.net_cash_flow_formatted}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2" color="text.secondary">Operating Profit Margin %</Typography>
                          <Chip label={`${reportData.kpis?.margin_percentage}%`} color="primary" size="small" />
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <Card variant="outlined" sx={{ borderRadius: 2.5, height: '100%' }}>
                    <CardContent>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
                        Enterprise Capacity & Staffing
                      </Typography>
                      <Divider sx={{ mb: 2 }} />
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 4 }}>
                          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', borderRadius: 2 }}>
                            <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                              {reportData.kpis?.total_customers || 0}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">Active Customers</Typography>
                          </Paper>
                        </Grid>
                        <Grid size={{ xs: 4 }}>
                          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', borderRadius: 2 }}>
                            <Typography variant="h5" sx={{ fontWeight: 700, color: 'info.main' }}>
                              {reportData.kpis?.total_employees || 0}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">Total Staff</Typography>
                          </Paper>
                        </Grid>
                        <Grid size={{ xs: 4 }}>
                          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', borderRadius: 2 }}>
                            <Typography variant="h5" sx={{ fontWeight: 700, color: 'warning.main' }}>
                              {reportData.kpis?.total_skus || 0}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">Cataloged SKUs</Typography>
                          </Paper>
                        </Grid>
                      </Grid>
                      <Box sx={{ mt: 2.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          Inventory Valuation: <strong>{reportData.kpis?.total_inventory_valuation_formatted}</strong> • Low Stock Items: <strong>{reportData.kpis?.low_stock_count}</strong>
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* ============================================================
              TAB 1: SALES SUMMARY REPORT
              ============================================================ */}
          {activeTab === 1 && (
            <Box>
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard
                    title="Invoiced Revenue"
                    value={reportData.summary?.total_invoiced_formatted || '₹0.00'}
                    subtitle={`${reportData.summary?.invoices_count || 0} invoices`}
                    icon={PointOfSaleOutlinedIcon}
                    color="primary"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard
                    title="Collected Payments"
                    value={reportData.summary?.total_paid_formatted || '₹0.00'}
                    subtitle="Received to date"
                    icon={CheckCircleOutlinedIcon}
                    color="success"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard
                    title="Outstanding Receivables"
                    value={reportData.summary?.total_balance_due_formatted || '₹0.00'}
                    subtitle="Unpaid invoices"
                    icon={WarningAmberOutlinedIcon}
                    color="error"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard
                    title="Average Order Value"
                    value={reportData.summary?.average_order_value_formatted || '₹0.00'}
                    subtitle={`${formatCurrency(reportData.summary?.total_orders || 0)} total sales orders`}
                    icon={TrendingUpOutlinedIcon}
                    color="info"
                  />
                </Grid>
              </Grid>

              {/* Status Breakdown & Top Customers */}
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Card variant="outlined" sx={{ borderRadius: 2.5 }}>
                    <CardContent>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Invoices by Status</Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>Count</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>Total Value</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {reportData.status_breakdown?.map((s) => (
                              <TableRow key={s.status}>
                                <TableCell><Chip label={s.status} size="small" variant="outlined" /></TableCell>
                                <TableCell align="right">{s.count}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 600 }}>{s.total_formatted}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <Card variant="outlined" sx={{ borderRadius: 2.5 }}>
                    <CardContent>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Top 5 Customers by Revenue</Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 700 }}>Customer</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>Invoices</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>Total Revenue</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {reportData.top_customers?.map((c) => (
                              <TableRow key={c.customer_id}>
                                <TableCell sx={{ fontWeight: 600 }}>{c.customer_name}</TableCell>
                                <TableCell align="right">{c.invoices_count}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, color: 'primary.main' }}>
                                  {c.total_revenue_formatted}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Itemized Invoices Table */}
              {reportData.recent_invoices?.length > 0 && (
                <Card variant="outlined" sx={{ borderRadius: 2.5 }}>
                  <CardContent>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
                      Recent Invoices in Period
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>Invoice #</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Customer</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Due Date</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Total</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Balance Due</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {reportData.recent_invoices.map((inv) => (
                            <TableRow key={inv.id} hover>
                              <TableCell sx={{ fontWeight: 600 }}>{inv.invoice_number}</TableCell>
                              <TableCell>{inv.customer_name}</TableCell>
                              <TableCell>{inv.invoice_date}</TableCell>
                              <TableCell>{inv.due_date}</TableCell>
                              <TableCell><Chip label={inv.status} size="small" variant="outlined" /></TableCell>
                              <TableCell align="right">{formatCurrency(inv.total)}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700, color: Number(inv.balance_due) > 0 ? 'error.main' : 'success.main' }}>
                                {formatCurrency(inv.balance_due)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              )}
            </Box>
          )}

          {/* ============================================================
              TAB 2: PURCHASE SUMMARY REPORT
              ============================================================ */}
          {activeTab === 2 && (
            <Box>
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard
                    title="Total Procurement"
                    value={reportData.summary?.total_billed_formatted || '₹0.00'}
                    subtitle={`${reportData.summary?.bills_count || 0} vendor bills`}
                    icon={ShoppingCartOutlinedIcon}
                    color="warning"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard
                    title="Disbursed Payments"
                    value={reportData.summary?.total_paid_formatted || '₹0.00'}
                    subtitle="Paid to suppliers"
                    icon={CheckCircleOutlinedIcon}
                    color="success"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard
                    title="Accounts Payable (A/P)"
                    value={reportData.summary?.total_balance_due_formatted || '₹0.00'}
                    subtitle="Unpaid obligations"
                    icon={WarningAmberOutlinedIcon}
                    color="error"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard
                    title="Average PO Size"
                    value={reportData.summary?.average_po_value_formatted || '₹0.00'}
                    subtitle={`${formatCurrency(reportData.summary?.total_purchase_orders || 0)} total POs`}
                    icon={TrendingDownOutlinedIcon}
                    color="info"
                  />
                </Grid>
              </Grid>

              {/* Top Vendors */}
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Card variant="outlined" sx={{ borderRadius: 2.5 }}>
                    <CardContent>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Top 5 Suppliers by Spend</Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 700 }}>Supplier</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>Bills</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>Total Spend</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {reportData.top_vendors?.map((v) => (
                              <TableRow key={v.vendor_id}>
                                <TableCell sx={{ fontWeight: 600 }}>{v.vendor_name}</TableCell>
                                <TableCell align="right">{v.bills_count}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, color: 'warning.main' }}>
                                  {v.total_spend_formatted}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <Card variant="outlined" sx={{ borderRadius: 2.5 }}>
                    <CardContent>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Bills by Status</Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>Count</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>Total Value</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {reportData.status_breakdown?.map((s) => (
                              <TableRow key={s.status}>
                                <TableCell><Chip label={s.status} size="small" variant="outlined" /></TableCell>
                                <TableCell align="right">{s.count}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 600 }}>{s.total_formatted}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* ============================================================
              TAB 3: INVENTORY OVERVIEW REPORT
              ============================================================ */}
          {activeTab === 3 && (
            <Box>
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <StatCard
                    title="Total Inventory Valuation"
                    value={reportData.summary?.total_valuation_formatted || '₹0.00'}
                    subtitle={`${formatCurrency(reportData.summary?.total_skus || 0)} active SKUs`}
                    icon={Inventory2OutlinedIcon}
                    color="primary"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <StatCard
                    title="Low Stock Items"
                    value={reportData.summary?.low_stock_count || 0}
                    subtitle="SKUs below reorder level"
                    icon={WarningAmberOutlinedIcon}
                    color="warning"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <StatCard
                    title="Active Storage Facilities"
                    value={reportData.summary?.warehouses_count || 0}
                    subtitle="Warehouses cataloged"
                    icon={BusinessOutlinedIcon}
                    color="info"
                  />
                </Grid>
              </Grid>

              {/* Low Stock Items List */}
              {reportData.low_stock_items?.length > 0 && (
                <Card variant="outlined" sx={{ borderRadius: 2.5, mb: 3 }}>
                  <CardContent>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5, color: 'error.main' }}>
                      ⚠️ Critical Low Stock & Reorder Alerts
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>SKU</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Product Name</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Current Stock</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Reorder Level</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Cost Price</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {reportData.low_stock_items.map((itm) => (
                            <TableRow key={itm.id} hover>
                              <TableCell sx={{ fontWeight: 600 }}>{itm.sku}</TableCell>
                              <TableCell>{itm.name}</TableCell>
                              <TableCell>{itm.category}</TableCell>
                              <TableCell align="right">
                                <Chip label={itm.quantity} size="small" color="error" variant="outlined" />
                              </TableCell>
                              <TableCell align="right">{itm.reorder_level}</TableCell>
                              <TableCell align="right">{formatCurrency(itm.cost_price)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              )}

              {/* Warehouse Breakdown */}
              {reportData.warehouses?.length > 0 && (
                <Card variant="outlined" sx={{ borderRadius: 2.5 }}>
                  <CardContent>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
                      Warehouse Stock Distribution
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>Warehouse</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Code</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Items Stored</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Total Quantity</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Total Valuation</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {reportData.warehouses.map((wh) => (
                            <TableRow key={wh.warehouse_id} hover>
                              <TableCell sx={{ fontWeight: 600 }}>{wh.name}</TableCell>
                              <TableCell>{wh.code}</TableCell>
                              <TableCell align="right">{wh.items_count}</TableCell>
                              <TableCell align="right">{wh.total_quantity}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>{wh.total_valuation_formatted}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              )}
            </Box>
          )}

          {/* ============================================================
              TAB 4: CRM PIPELINE REPORT
              ============================================================ */}
          {activeTab === 4 && (
            <Box>
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard
                    title="Total Customers"
                    value={reportData.summary?.total_customers || 0}
                    subtitle={`Corporate: ${reportData.summary?.corporate_customers || 0}`}
                    icon={PeopleAltOutlinedIcon}
                    color="primary"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard
                    title="Total Leads"
                    value={reportData.summary?.total_leads || 0}
                    subtitle={`Converted: ${reportData.summary?.converted_leads || 0}`}
                    icon={TrendingUpOutlinedIcon}
                    color="info"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard
                    title="Conversion Rate"
                    value={`${reportData.summary?.conversion_rate_percentage || 0}%`}
                    subtitle="Lead to customer"
                    icon={CheckCircleOutlinedIcon}
                    color="success"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard
                    title="Deal Pipeline Value"
                    value={reportData.summary?.total_deal_pipeline_value_formatted || '₹0.00'}
                    subtitle={`${formatCurrency(reportData.summary?.total_deals || 0)} active deals`}
                    icon={AccountBalanceWalletOutlinedIcon}
                    color="warning"
                  />
                </Grid>
              </Grid>

              {/* Leads Funnel & Deals Breakdown */}
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Card variant="outlined" sx={{ borderRadius: 2.5 }}>
                    <CardContent>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Leads Funnel by Status</Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>Count</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>Estimated Value</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {reportData.leads_funnel?.map((l) => (
                              <TableRow key={l.status}>
                                <TableCell><Chip label={l.status} size="small" variant="outlined" /></TableCell>
                                <TableCell align="right">{l.count}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 600 }}>{l.total_value_formatted}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <Card variant="outlined" sx={{ borderRadius: 2.5 }}>
                    <CardContent>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Deals by Stage</Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 700 }}>Stage</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>Deals</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>Value</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {reportData.deals_breakdown?.map((d) => (
                              <TableRow key={d.stage}>
                                <TableCell><Chip label={d.stage} size="small" color="primary" variant="outlined" /></TableCell>
                                <TableCell align="right">{d.count}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700 }}>{d.total_value_formatted}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* ============================================================
              TAB 5: FINANCE & P&L REPORT
              ============================================================ */}
          {activeTab === 5 && (
            <Box>
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard
                    title="Net Profit"
                    value={reportData.pnl?.net_profit_formatted || '₹0.00'}
                    subtitle="Income statement"
                    icon={TrendingUpOutlinedIcon}
                    color="success"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard
                    title="Operating Revenue"
                    value={reportData.pnl?.operating_revenue_formatted || '₹0.00'}
                    subtitle="Total revenue"
                    icon={PointOfSaleOutlinedIcon}
                    color="primary"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard
                    title="Total Liquid Capital"
                    value={reportData.liquidity?.total_liquid_capital_formatted || '₹0.00'}
                    subtitle={`Bank: ${formatCurrency(reportData.liquidity?.total_bank_balance_formatted || '₹0.00')}`}
                    icon={AccountBalanceWalletOutlinedIcon}
                    color="info"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard
                    title="Operating Expenses"
                    value={reportData.pnl?.operating_expenses_formatted || '₹0.00'}
                    subtitle={`COGS: ${reportData.pnl?.cost_of_goods_sold_formatted || '₹0.00'}`}
                    icon={TrendingDownOutlinedIcon}
                    color="warning"
                  />
                </Grid>
              </Grid>

              {/* Financial Balance Sheet Overview */}
              <Card variant="outlined" sx={{ borderRadius: 2.5 }}>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
                    Balance Sheet & Liquidity Summary
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableBody>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>Commercial Bank Accounts Balance</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>{reportData.liquidity?.total_bank_balance_formatted}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>Cash & Petty Cash Registers Balance</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>{reportData.liquidity?.total_cash_balance_formatted}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>Total Accounts Receivable (A/R)</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: 'primary.main' }}>{reportData.receivables?.total_receivables_formatted}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>Total Accounts Payable (A/P)</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: 'error.main' }}>{reportData.payables?.total_payables_formatted}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Box>
          )}

          {/* ============================================================
              TAB 6: EMPLOYEE & HR REPORT
              ============================================================ */}
          {activeTab === 6 && (
            <Box>
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <StatCard
                    title="Total Headcount"
                    value={reportData.summary?.total_employees || 0}
                    subtitle="Employees on roster"
                    icon={BadgeOutlinedIcon}
                    color="primary"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <StatCard
                    title="Active Employees"
                    value={reportData.summary?.active_employees || 0}
                    subtitle="Current active staff"
                    icon={CheckCircleOutlinedIcon}
                    color="success"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <StatCard
                    title="Departments"
                    value={reportData.summary?.departments_count || 0}
                    subtitle="Operational units"
                    icon={BusinessOutlinedIcon}
                    color="info"
                  />
                </Grid>
              </Grid>

              {/* Department Distribution & Employee Roster */}
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, md: 5 }}>
                  <Card variant="outlined" sx={{ borderRadius: 2.5 }}>
                    <CardContent>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Department Headcounts</Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 700 }}>Department</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>Staff Count</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {reportData.departments?.map((d) => (
                              <TableRow key={d.department}>
                                <TableCell sx={{ fontWeight: 600 }}>{d.department}</TableCell>
                                <TableCell align="right">
                                  <Chip label={d.count} size="small" color="primary" variant="outlined" />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid size={{ xs: 12, md: 7 }}>
                  <Card variant="outlined" sx={{ borderRadius: 2.5 }}>
                    <CardContent>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Staff Roster</Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 700 }}>ID</TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>Department</TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>Designation</TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {reportData.roster?.map((emp) => (
                              <TableRow key={emp.id} hover>
                                <TableCell sx={{ fontWeight: 600 }}>{emp.employee_id}</TableCell>
                                <TableCell>{emp.name}</TableCell>
                                <TableCell>{emp.department}</TableCell>
                                <TableCell>{emp.designation}</TableCell>
                                <TableCell>
                                  <Chip
                                    label={emp.is_active ? 'Active' : 'Inactive'}
                                    size="small"
                                    color={emp.is_active ? 'success' : 'default'}
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* ============================================================
              TAB 7: MONTHLY BUSINESS TRENDS REPORT
              ============================================================ */}
          {activeTab === 7 && (
            <Box>
              <Card variant="outlined" sx={{ borderRadius: 2.5 }}>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
                    Historical Monthly Comparison
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Past 6 months chronological trajectory across sales invoices, purchase bills, and cash collections.
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead sx={{ backgroundColor: 'action.hover' }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>Month</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>Sales Invoiced</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>Purchases Billed</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>Collections Received</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>Operating Net Margin</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {reportData.monthly_history?.map((m) => {
                          const isPositive = Number(m.net_margin) >= 0;
                          return (
                            <TableRow key={m.month_key} hover>
                              <TableCell sx={{ fontWeight: 700 }}>{m.month_label}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600, color: 'primary.main' }}>
                                {m.sales_formatted}
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600, color: 'warning.main' }}>
                                {m.purchases_formatted}
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600 }}>
                                {m.collections_formatted}
                              </TableCell>
                              <TableCell align="right">
                                <Chip
                                  label={m.net_margin_formatted}
                                  size="small"
                                  color={isPositive ? 'success' : 'error'}
                                  sx={{ fontWeight: 700 }}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
