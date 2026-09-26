import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  InputAdornment,
  IconButton,
  Avatar,
  Paper,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  Tooltip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';

// Icons
import SendIcon from '@mui/icons-material/Send';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import DeleteSweepOutlinedIcon from '@mui/icons-material/DeleteSweepOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import PointOfSaleOutlinedIcon from '@mui/icons-material/PointOfSaleOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined';

import PageHeader from '../components/common/PageHeader';
import StatCard from '../components/common/StatCard';
import EmptyState from '../components/common/EmptyState';
import LoadingState from '../components/common/LoadingState';
import aiService from '../services/aiService';
import { useCompany } from '../context/CompanyContext';
import { extractErrorMessage } from '../utils/errorUtils';

const QUICK_PROMPTS = [
  "What are this month's sales?",
  "Which invoices are outstanding?",
  "Which products have low stock?",
  "What is our current profit?",
  "Which customers owe money?",
  "Show recent purchase orders.",
];

export default function AIPage() {
  const { currentCompany, companies } = useCompany();
  // Selected company filter: 'global' or company ID string
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState(
    currentCompany?.id ? String(currentCompany.id) : 'global'
  );

  useEffect(() => {
    if (currentCompany?.id && selectedCompanyFilter !== 'global') {
      setSelectedCompanyFilter(String(currentCompany.id));
    }
  }, [currentCompany?.id]);

  const activeTargetCompanyId =
    selectedCompanyFilter === 'global' ? null : Number(selectedCompanyFilter);

  // View tabs
  const [activeTab, setActiveTab] = useState(0);

  // Dashboard Data State
  const [dashboardData, setDashboardData] = useState(null);
  const [summaryData, setSummaryData] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [dashboardError, setDashboardError] = useState('');

  // Ask AI Chat State
  const [messages, setMessages] = useState([
    {
      sender: 'assistant',
      text: "👋 Hello! I am your **ICORP Global ERP Assistant**. I provide real-time business telemetry, cross-ledger synthesis, and operational answers grounded directly in your authorized ERP database across all workspaces.\n\nAsk me anything or select a prompt below!",
      timestamp: new Date(),
    },
  ]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [chatError, setChatError] = useState('');

  const chatBottomRef = useRef(null);

  // Fetch Dashboard & Summary
  const fetchTelemetry = useCallback(async () => {
    setLoadingDashboard(true);
    setDashboardError('');
    try {
      const [dash, summary] = await Promise.all([
        aiService.getDashboard(activeTargetCompanyId),
        aiService.getSummary(activeTargetCompanyId),
      ]);
      setDashboardData(dash);
      setSummaryData(summary);
    } catch (err) {
      setDashboardError(extractErrorMessage(err, 'Failed to load AI business intelligence telemetry.'));
    } finally {
      setLoadingDashboard(false);
    }
  }, [activeTargetCompanyId]);

  useEffect(() => {
    fetchTelemetry();
  }, [fetchTelemetry]);

  // Scroll chat to bottom
  useEffect(() => {
    if (activeTab === 2) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  // Handle Ask Submit
  const handleAsk = async (textToSend) => {
    const q = (textToSend || inputQuestion).trim();
    if (!q || isAsking) return;

    setInputQuestion('');
    setChatError('');

    // Append user question
    const userMsg = { sender: 'user', text: q, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setIsAsking(true);

    try {
      const res = await aiService.ask(activeTargetCompanyId, q);
      const assistantMsg = {
        sender: 'assistant',
        text: res.answer,
        fallbackUsed: res.fallback_used,
        llmAugmented: res.llm_augmented,
        data: res.data,
        suggested: res.suggested_questions || [],
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errMsg = extractErrorMessage(err, 'Could not retrieve answer from AI service.');
      setChatError(errMsg);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: `⚠️ **Error:** ${errMsg}`,
          isError: true,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsAsking(false);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        sender: 'assistant',
        text: "Conversation cleared. How can I assist you with your ERP operations today?",
        timestamp: new Date(),
      },
    ]);
  };

  const insights = dashboardData?.insights || {};
  const sales = insights.sales || {};
  const purchases = insights.purchases || {};
  const inventory = insights.inventory || {};
  const finance = insights.finance || {};
  const crm = insights.crm || {};
  const hr = insights.hr || {};
  const recPay = dashboardData?.receivables_payables || {};

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1440, margin: '0 auto' }}>
      {/* Header */}
      <PageHeader
        title="AI Assistant & Business Insights"
        subtitle="Real-time multi-module business intelligence, cross-ledger synthesis, and ERP-grounded query assistant."
        action={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Chip
              icon={<SecurityOutlinedIcon fontSize="small" />}
              label="ERP-Grounded & Read-Only"
              size="small"
              color="success"
              variant="outlined"
              sx={{ fontWeight: 600, display: { xs: 'none', sm: 'inline-flex' } }}
            />
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchTelemetry}
              disabled={loadingDashboard}
              size="small"
            >
              Refresh
            </Button>
          </Stack>
        }
      />

      {/* Workspace Scope Switcher */}
      <Card sx={{ mb: 3, p: 1.5, bgcolor: 'background.subtle', border: '1px solid #e2e8f0' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'flex-start', sm: 'center' }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            ASSISTANT SCOPE:
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip
              icon={<AutoAwesomeIcon fontSize="small" />}
              label="🌐 Global (All Workspaces)"
              clickable
              color={selectedCompanyFilter === 'global' ? 'primary' : 'default'}
              variant={selectedCompanyFilter === 'global' ? 'filled' : 'outlined'}
              onClick={() => setSelectedCompanyFilter('global')}
              sx={{ fontWeight: 700 }}
            />
            {(dashboardData?.authorized_companies || companies || []).map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                clickable
                color={String(selectedCompanyFilter) === String(c.id) ? 'primary' : 'default'}
                variant={String(selectedCompanyFilter) === String(c.id) ? 'filled' : 'outlined'}
                onClick={() => setSelectedCompanyFilter(String(c.id))}
                sx={{ fontWeight: 600 }}
              />
            ))}
          </Stack>
        </Stack>
      </Card>

      {dashboardError && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setDashboardError('')}>
          {dashboardError}
        </Alert>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(e, val) => setActiveTab(val)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab
            icon={<AutoAwesomeIcon fontSize="small" />}
            iconPosition="start"
            label="AI Overview & Insights"
          />
          <Tab
            icon={<WarningAmberOutlinedIcon fontSize="small" />}
            iconPosition="start"
            label={`Alerts & Trends (${dashboardData?.alerts?.length || 0})`}
          />
          <Tab
            icon={<SmartToyOutlinedIcon fontSize="small" />}
            iconPosition="start"
            label="Ask AI Assistant"
          />
        </Tabs>
      </Box>

      {loadingDashboard && activeTab !== 2 ? (
        <LoadingState message="Generating AI business insights and computing cross-module telemetry..." />
      ) : (
        <>
          {/* ======================================================== */}
          {/* TAB 0: AI OVERVIEW & MODULE INSIGHTS CARDS */}
          {/* ======================================================== */}
          {activeTab === 0 && (
            <Stack spacing={3}>
              {/* Executive Business Summary Banner */}
              <Card
                sx={{
                  background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                  color: '#ffffff',
                  borderRadius: 2,
                  boxShadow: 2,
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start" justifyContent="space-between">
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 48, height: 48 }}>
                        <AutoAwesomeIcon />
                      </Avatar>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#ffffff' }}>
                          Executive Operational Digest
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                          Live telemetry generated as of {dashboardData?.generated_at || 'now'}
                        </Typography>
                      </Box>
                    </Stack>
                    <Chip
                      label="Company Active"
                      size="small"
                      sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: '#ffffff', fontWeight: 600 }}
                    />
                  </Stack>
                  <Typography
                    variant="body1"
                    sx={{
                      mt: 2,
                      lineHeight: 1.6,
                      color: 'rgba(255,255,255,0.95)',
                      fontSize: '0.95rem',
                    }}
                  >
                    {dashboardData?.business_summary ||
                      'Operational baseline established across CRM, Employees, Inventory, Sales, Purchases, and Finance.'}
                  </Typography>
                </CardContent>
              </Card>

              {/* High-Level KPI StatCards */}
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <StatCard
                    title="Net Operating Profit"
                    value={finance.net_profit_formatted || '$0.00'}
                    subtitle={`Gross: ${finance.gross_profit_formatted || '$0.00'}`}
                    icon={AccountBalanceWalletOutlinedIcon}
                    color="primary.main"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <StatCard
                    title="Month Sales"
                    value={sales.month_sales_formatted || '$0.00'}
                    subtitle={`${sales.month_invoice_count || 0} invoice(s) this month`}
                    icon={PointOfSaleOutlinedIcon}
                    color="success.main"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <StatCard
                    title="Total Purchases"
                    value={purchases.total_purchases_formatted || '$0.00'}
                    subtitle={`Unpaid bills: ${purchases.unpaid_bills_formatted || '$0.00'}`}
                    icon={ShoppingCartOutlinedIcon}
                    color="warning.main"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <StatCard
                    title="Liquid Capital"
                    value={recPay.liquid_funds_formatted || '$0.00'}
                    subtitle={`Working Capital: ${recPay.net_working_capital_formatted || '$0.00'}`}
                    icon={AccountBalanceWalletOutlinedIcon}
                    color="info.main"
                  />
                </Grid>
              </Grid>

              {/* Multi-Entity Workspace Breakdown (Global Mode) */}
              {dashboardData?.is_global && dashboardData?.company_breakdown?.length > 0 && (
                <Card sx={{ p: 2.5 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                    Consolidated Entity Breakdown
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Real-time operational metrics across all authorized company workspaces.
                  </Typography>
                  <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                    <Table size="small">
                      <TableHead sx={{ bgcolor: 'background.subtle' }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>Company Workspace</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Total Sales</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Procurement Spend</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Net Margin</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Catalog Items</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Employees</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Active Deals</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {dashboardData.company_breakdown.map((row) => (
                          <TableRow key={row.id} hover>
                            <TableCell sx={{ fontWeight: 700 }}>{row.name}</TableCell>
                            <TableCell>{row.total_sales_formatted}</TableCell>
                            <TableCell>{row.total_purchases_formatted}</TableCell>
                            <TableCell sx={{ fontWeight: 600, color: row.net_profit_formatted?.startsWith('-') ? 'error.main' : 'success.main' }}>
                              {row.net_profit_formatted}
                            </TableCell>
                            <TableCell>{row.total_products}</TableCell>
                            <TableCell>{row.total_employees}</TableCell>
                            <TableCell>{row.active_deals}</TableCell>
                            <TableCell align="right">
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => setSelectedCompanyFilter(String(row.id))}
                                sx={{ textTransform: 'none', py: 0.25 }}
                              >
                                Focus Company
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Card>
              )}

              {/* Business Insights Cards (6 Core Modules) */}
              <Typography variant="h6" sx={{ fontWeight: 700, mt: 1 }}>
                Cross-Module Intelligence Cards
              </Typography>

              <Grid container spacing={2.5}>
                {/* 1. Sales Insights Card */}
                <Grid item xs={12} md={6}>
                  <Card sx={{ height: '100%', borderRadius: 2 }}>
                    <CardContent>
                      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                        <Avatar sx={{ bgcolor: 'primary.light', color: 'primary.main', width: 36, height: 36 }}>
                          <PointOfSaleOutlinedIcon fontSize="small" />
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            Sales Intelligence
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Customer billing, collections & orders
                          </Typography>
                        </Box>
                      </Stack>
                      <Divider sx={{ mb: 2 }} />
                      <Grid container spacing={2} sx={{ mb: 2 }}>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">All-Time Sales</Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700 }}>{sales.total_sales_formatted || '$0.00'}</Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">Total Orders</Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700 }}>{sales.total_orders_count || 0}</Typography>
                        </Grid>
                      </Grid>
                      <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 1 }}>
                        Recent Sales Orders:
                      </Typography>
                      {sales.recent_orders?.length > 0 ? (
                        <Stack spacing={1}>
                          {sales.recent_orders.slice(0, 3).map((o, idx) => (
                            <Box key={idx} sx={{ p: 1, bgcolor: 'background.subtle', borderRadius: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>{o.order_number}</Typography>
                                <Typography variant="caption" color="text.secondary">{o.customer}</Typography>
                              </Box>
                              <Box sx={{ textAlign: 'right' }}>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>${Number(o.total).toFixed(2)}</Typography>
                                <Chip label={o.status} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
                              </Box>
                            </Box>
                          ))}
                        </Stack>
                      ) : (
                        <Typography variant="caption" color="text.secondary">No sales orders found.</Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>

                {/* 2. Purchases Insights Card */}
                <Grid item xs={12} md={6}>
                  <Card sx={{ height: '100%', borderRadius: 2 }}>
                    <CardContent>
                      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                        <Avatar sx={{ bgcolor: 'warning.light', color: 'warning.main', width: 36, height: 36 }}>
                          <ShoppingCartOutlinedIcon fontSize="small" />
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            Procurement & Purchases
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Vendor orders, billing & liabilities
                          </Typography>
                        </Box>
                      </Stack>
                      <Divider sx={{ mb: 2 }} />
                      <Grid container spacing={2} sx={{ mb: 2 }}>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">Total Procurement</Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700 }}>{purchases.total_purchases_formatted || '$0.00'}</Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">Unpaid Bills</Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700, color: 'error.main' }}>
                            {purchases.unpaid_bills_formatted || '$0.00'}
                          </Typography>
                        </Grid>
                      </Grid>
                      <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 1 }}>
                        Recent Purchase Orders:
                      </Typography>
                      {purchases.recent_pos?.length > 0 ? (
                        <Stack spacing={1}>
                          {purchases.recent_pos.slice(0, 3).map((po, idx) => (
                            <Box key={idx} sx={{ p: 1, bgcolor: 'background.subtle', borderRadius: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>{po.order_number}</Typography>
                                <Typography variant="caption" color="text.secondary">{po.vendor}</Typography>
                              </Box>
                              <Box sx={{ textAlign: 'right' }}>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>${Number(po.total).toFixed(2)}</Typography>
                                <Chip label={po.status} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
                              </Box>
                            </Box>
                          ))}
                        </Stack>
                      ) : (
                        <Typography variant="caption" color="text.secondary">No purchase orders found.</Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>

                {/* 3. Inventory Insights Card */}
                <Grid item xs={12} md={6}>
                  <Card sx={{ height: '100%', borderRadius: 2 }}>
                    <CardContent>
                      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                        <Avatar sx={{ bgcolor: 'secondary.light', color: 'secondary.main', width: 36, height: 36 }}>
                          <Inventory2OutlinedIcon fontSize="small" />
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            Inventory & Warehouse
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            SKU catalog, valuation & stock alerts
                          </Typography>
                        </Box>
                      </Stack>
                      <Divider sx={{ mb: 2 }} />
                      <Grid container spacing={2} sx={{ mb: 2 }}>
                        <Grid item xs={4}>
                          <Typography variant="caption" color="text.secondary">Catalog SKUs</Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700 }}>{inventory.total_products || 0}</Typography>
                        </Grid>
                        <Grid item xs={4}>
                          <Typography variant="caption" color="text.secondary">Valuation</Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700 }}>{inventory.total_valuation_formatted || '$0.00'}</Typography>
                        </Grid>
                        <Grid item xs={4}>
                          <Typography variant="caption" color="text.secondary">Low Stock</Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700, color: inventory.low_stock_count > 0 ? 'warning.main' : 'success.main' }}>
                            {inventory.low_stock_count || 0}
                          </Typography>
                        </Grid>
                      </Grid>
                      <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 1 }}>
                        Stock Status Summary:
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Chip
                          icon={<CheckCircleOutlineIcon />}
                          label={`${(inventory.total_products || 0) - (inventory.low_stock_count || 0) - (inventory.out_of_stock_count || 0)} In-Stock`}
                          size="small"
                          color="success"
                          variant="outlined"
                        />
                        <Chip
                          icon={<WarningAmberOutlinedIcon />}
                          label={`${inventory.low_stock_count || 0} Low-Stock`}
                          size="small"
                          color="warning"
                          variant="outlined"
                        />
                        <Chip
                          icon={<ErrorOutlineIcon />}
                          label={`${inventory.out_of_stock_count || 0} Out-of-Stock`}
                          size="small"
                          color="error"
                          variant="outlined"
                        />
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>

                {/* 4. Finance Insights Card */}
                <Grid item xs={12} md={6}>
                  <Card sx={{ height: '100%', borderRadius: 2 }}>
                    <CardContent>
                      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                        <Avatar sx={{ bgcolor: 'info.light', color: 'info.main', width: 36, height: 36 }}>
                          <AccountBalanceWalletOutlinedIcon fontSize="small" />
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            Financial Position & Working Capital
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Cash/bank liquidity, AR, and AP
                          </Typography>
                        </Box>
                      </Stack>
                      <Divider sx={{ mb: 2 }} />
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">Accounts Receivable</Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700, color: 'success.main' }}>
                            {recPay.total_receivables_formatted || '$0.00'}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">Accounts Payable</Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700, color: 'warning.main' }}>
                            {recPay.total_payables_formatted || '$0.00'}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">Liquid Funds (Cash+Bank)</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>{recPay.liquid_funds_formatted || '$0.00'}</Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">Net Working Capital</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>{recPay.net_working_capital_formatted || '$0.00'}</Typography>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>

                {/* 5. CRM Insights Card */}
                <Grid item xs={12} md={6}>
                  <Card sx={{ height: '100%', borderRadius: 2 }}>
                    <CardContent>
                      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                        <Avatar sx={{ bgcolor: 'success.light', color: 'success.main', width: 36, height: 36 }}>
                          <PeopleAltOutlinedIcon fontSize="small" />
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            CRM & Sales Pipeline
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Customers, leads, and active deal pipeline
                          </Typography>
                        </Box>
                      </Stack>
                      <Divider sx={{ mb: 2 }} />
                      <Grid container spacing={2}>
                        <Grid item xs={4}>
                          <Typography variant="caption" color="text.secondary">Customers</Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700 }}>{crm.total_customers || 0}</Typography>
                        </Grid>
                        <Grid item xs={4}>
                          <Typography variant="caption" color="text.secondary">Conversion Rate</Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700 }}>{crm.conversion_rate_percentage || 0}%</Typography>
                        </Grid>
                        <Grid item xs={4}>
                          <Typography variant="caption" color="text.secondary">Pipeline Value</Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700 }}>{crm.pipeline_value_formatted || '$0.00'}</Typography>
                        </Grid>
                      </Grid>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                        Total Leads: {crm.total_leads || 0} ({crm.converted_leads || 0} converted) | Active Deals: {crm.total_deals || 0}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                {/* 6. HR & Staffing Insights Card */}
                <Grid item xs={12} md={6}>
                  <Card sx={{ height: '100%', borderRadius: 2 }}>
                    <CardContent>
                      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                        <Avatar sx={{ bgcolor: 'error.light', color: 'error.main', width: 36, height: 36 }}>
                          <BadgeOutlinedIcon fontSize="small" />
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            Human Resources & Headcount
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Active workforce and department allocation
                          </Typography>
                        </Box>
                      </Stack>
                      <Divider sx={{ mb: 2 }} />
                      <Grid container spacing={2}>
                        <Grid item xs={4}>
                          <Typography variant="caption" color="text.secondary">Total Headcount</Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700 }}>{hr.total_employees || 0}</Typography>
                        </Grid>
                        <Grid item xs={4}>
                          <Typography variant="caption" color="text.secondary">Active Staff</Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700, color: 'success.main' }}>
                            {hr.active_employees || 0}
                          </Typography>
                        </Grid>
                        <Grid item xs={4}>
                          <Typography variant="caption" color="text.secondary">Departments</Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700 }}>{hr.departments_count || 0}</Typography>
                        </Grid>
                      </Grid>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                        Key Departments: {hr.departments?.map((d) => `${d.department} (${d.count})`).join(', ') || 'N/A'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Actionable Recommendations */}
              <Card sx={{ borderRadius: 2 }}>
                <CardContent>
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                    <Avatar sx={{ bgcolor: 'primary.light', color: 'primary.main', width: 36, height: 36 }}>
                      <LightbulbOutlinedIcon />
                    </Avatar>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      AI Action Recommendations
                    </Typography>
                  </Stack>
                  <Divider sx={{ mb: 2 }} />
                  <Stack spacing={1.5}>
                    {dashboardData?.recommendations?.map((rec, idx) => (
                      <Box
                        key={idx}
                        sx={{
                          p: 1.5,
                          bgcolor: 'background.subtle',
                          borderLeft: '4px solid #3b82f6',
                          borderRadius: 1,
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {rec}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          )}

          {/* ======================================================== */}
          {/* TAB 1: ALERTS, TRENDS & OBSERVATIONS */}
          {/* ======================================================== */}
          {activeTab === 1 && (
            <Stack spacing={3}>
              {/* Dynamic Alerts */}
              <Card sx={{ borderRadius: 2 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                    Active Telemetry Alerts
                  </Typography>
                  {dashboardData?.alerts?.length > 0 ? (
                    <Stack spacing={1.5}>
                      {dashboardData.alerts.map((al, idx) => (
                        <Alert key={idx} severity={al.type || 'info'} sx={{ fontWeight: 500 }}>
                          <strong>{al.title}:</strong> {al.message}
                        </Alert>
                      ))}
                    </Stack>
                  ) : (
                    <Alert severity="success">
                      No active operational alerts. All parameters are functioning normally.
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* Key Trends */}
              <Card sx={{ borderRadius: 2 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                    Key Performance Trends
                  </Typography>
                  <Grid container spacing={2}>
                    {dashboardData?.key_trends?.map((t, idx) => {
                      const isUp = t.trend === 'up';
                      const isDown = t.trend === 'down';
                      return (
                        <Grid item xs={12} sm={6} key={idx}>
                          <Paper
                            variant="outlined"
                            sx={{
                              p: 2,
                              borderRadius: 2,
                              bgcolor: isUp ? '#f0fdf4' : isDown ? '#fef2f2' : 'background.subtle',
                              borderColor: isUp ? '#bbf7d0' : isDown ? '#fecaca' : '#e2e8f0',
                            }}
                          >
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                              {isUp ? (
                                <TrendingUpIcon color="success" />
                              ) : isDown ? (
                                <TrendingDownIcon color="error" />
                              ) : (
                                <TrendingFlatIcon color="action" />
                              )}
                              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                {t.title}
                              </Typography>
                            </Stack>
                            <Typography variant="body2" color="text.secondary">
                              {t.description}
                            </Typography>
                          </Paper>
                        </Grid>
                      );
                    })}
                  </Grid>
                </CardContent>
              </Card>

              {/* Low Stock Warnings Table */}
              <Card sx={{ borderRadius: 2 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                    Low-Stock & Reorder Warnings
                  </Typography>
                  {dashboardData?.low_stock_warnings?.length > 0 ? (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>SKU</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Product Name</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Current Stock</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Reorder Level</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Unit Cost</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {dashboardData.low_stock_warnings.map((p, idx) => {
                            const isOutOfStock = Number(p.current_stock) <= 0;
                            return (
                              <TableRow key={idx} hover>
                                <TableCell sx={{ fontWeight: 600 }}>{p.sku}</TableCell>
                                <TableCell>{p.name}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, color: isOutOfStock ? 'error.main' : 'warning.main' }}>
                                  {p.current_stock} {p.unit || ''}
                                </TableCell>
                                <TableCell align="right">{p.reorder_level}</TableCell>
                                <TableCell align="right">${Number(p.cost_price || 0).toFixed(2)}</TableCell>
                                <TableCell>
                                  <Chip
                                    label={isOutOfStock ? 'OUT OF STOCK' : 'LOW STOCK'}
                                    size="small"
                                    color={isOutOfStock ? 'error' : 'warning'}
                                    sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }}
                                  />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      All products currently meet or exceed minimum reorder stock thresholds.
                    </Typography>
                  )}
                </CardContent>
              </Card>

              {/* Sales & Purchase Observations */}
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Card sx={{ height: '100%', borderRadius: 2 }}>
                    <CardContent>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
                        Sales Ledger Observations
                      </Typography>
                      <Stack spacing={1}>
                        {dashboardData?.observations?.sales?.map((obs, idx) => (
                          <Box key={idx} sx={{ p: 1, bgcolor: 'background.subtle', borderRadius: 1 }}>
                            <Typography variant="body2">{obs}</Typography>
                          </Box>
                        ))}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Card sx={{ height: '100%', borderRadius: 2 }}>
                    <CardContent>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
                        Purchase Ledger Observations
                      </Typography>
                      <Stack spacing={1}>
                        {dashboardData?.observations?.purchases?.map((obs, idx) => (
                          <Box key={idx} sx={{ p: 1, bgcolor: 'background.subtle', borderRadius: 1 }}>
                            <Typography variant="body2">{obs}</Typography>
                          </Box>
                        ))}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Stack>
          )}

          {/* ======================================================== */}
          {/* TAB 2: ASK AI ASSISTANT CHAT BOX */}
          {/* ======================================================== */}
          {activeTab === 2 && (
            <Card sx={{ borderRadius: 2, overflow: 'hidden', boxShadow: 2 }}>
              {/* Chat Header */}
              <Box
                sx={{
                  p: 2,
                  bgcolor: 'background.subtle',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                    <SmartToyOutlinedIcon fontSize="small" />
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Ask AI Assistant
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Grounded strictly in {currentCompany?.name || 'All Workspaces'}'s data
                    </Typography>
                  </Box>
                </Stack>
                <Tooltip title="Clear chat history">
                  <IconButton size="small" onClick={handleClearChat} disabled={isAsking}>
                    <DeleteSweepOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>

              {/* Quick Prompts Carousel / Bar */}
              <Box sx={{ p: 1.5, bgcolor: '#ffffff', borderBottom: '1px solid #f1f5f9' }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 1 }}>
                  Suggested Questions:
                </Typography>
                <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5 }}>
                  {QUICK_PROMPTS.map((q, idx) => (
                    <Chip
                      key={idx}
                      label={q}
                      size="small"
                      onClick={() => handleAsk(q)}
                      disabled={isAsking}
                      clickable
                      variant="outlined"
                      sx={{
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        '&:hover': { bgcolor: '#eff6ff', borderColor: 'primary.main' },
                      }}
                    />
                  ))}
                </Stack>
              </Box>

              {/* Chat Message Scroll Area */}
              <Box
                sx={{
                  p: 2.5,
                  minHeight: 380,
                  maxHeight: 520,
                  overflowY: 'auto',
                  bgcolor: '#fdfdfd',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                {messages.map((m, idx) => {
                  const isUser = m.sender === 'user';
                  return (
                    <Box
                      key={idx}
                      sx={{
                        display: 'flex',
                        justifyContent: isUser ? 'flex-end' : 'flex-start',
                        gap: 1.5,
                        maxWidth: '100%',
                      }}
                    >
                      {!isUser && (
                        <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32, mt: 0.5 }}>
                          <SmartToyOutlinedIcon fontSize="small" />
                        </Avatar>
                      )}
                      <Paper
                        elevation={0}
                        sx={{
                          p: 2,
                          maxWidth: { xs: '85%', md: '75%' },
                          bgcolor: isUser ? 'primary.main' : '#ffffff',
                          color: isUser ? '#ffffff' : 'text.primary',
                          border: isUser ? 'none' : '1px solid #e2e8f0',
                          borderRadius: 2,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                          {m.text}
                        </Typography>
                        {m.fallbackUsed && (
                          <Chip
                            label="ERP Data Grounded"
                            size="small"
                            variant="outlined"
                            sx={{ mt: 1, height: 18, fontSize: '0.65rem' }}
                          />
                        )}
                      </Paper>
                      {isUser && (
                        <Avatar sx={{ bgcolor: '#475569', width: 32, height: 32, mt: 0.5 }}>
                          <PersonOutlinedIcon fontSize="small" />
                        </Avatar>
                      )}
                    </Box>
                  );
                })}

                {isAsking && (
                  <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                    <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                      <SmartToyOutlinedIcon fontSize="small" />
                    </Avatar>
                    <Paper
                      elevation={0}
                      sx={{ p: 2, bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 2 }}
                    >
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <CircularProgress size={16} />
                        <Typography variant="body2" color="text.secondary">
                          Retrieving and analyzing verified ERP records...
                        </Typography>
                      </Stack>
                    </Paper>
                  </Box>
                )}
                <div ref={chatBottomRef} />
              </Box>

              {chatError && (
                <Alert severity="error" sx={{ m: 2 }} onClose={() => setChatError('')}>
                  {chatError}
                </Alert>
              )}

              {/* Chat Input Bar */}
              <Box
                component="form"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAsk();
                }}
                sx={{
                  p: 2,
                  bgcolor: '#ffffff',
                  borderTop: '1px solid #e2e8f0',
                }}
              >
                <TextField
                  fullWidth
                  placeholder="Ask a question about sales, inventory, profit, or unpaid bills..."
                  value={inputQuestion}
                  onChange={(e) => setInputQuestion(e.target.value)}
                  disabled={isAsking}
                  size="small"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          color="primary"
                          type="submit"
                          disabled={isAsking || !inputQuestion.trim()}
                          edge="end"
                        >
                          <SendIcon />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Card>
          )}
        </>
      )}
    </Box>
  );
}
