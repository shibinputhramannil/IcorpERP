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
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import StoreOutlinedIcon from '@mui/icons-material/StoreOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import TransformOutlinedIcon from '@mui/icons-material/TransformOutlined';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import MonetizationOnOutlinedIcon from '@mui/icons-material/MonetizationOnOutlined';
import PendingActionsOutlinedIcon from '@mui/icons-material/PendingActionsOutlined';

import PageHeader from '../components/common/PageHeader';
import EmptyState from '../components/common/EmptyState';
import LoadingState from '../components/common/LoadingState';
import StatCard from '../components/common/StatCard';
import purchaseService from '../services/purchaseService';
import inventoryService from '../services/inventoryService';
import { useCompany } from '../context/CompanyContext';

const QUOTATION_STATUS_COLORS = {
  DRAFT: 'default',
  SENT: 'info',
  ACCEPTED: 'primary',
  REJECTED: 'error',
  EXPIRED: 'warning',
  CONVERTED: 'success',
};

const ORDER_STATUS_COLORS = {
  DRAFT: 'default',
  CONFIRMED: 'info',
  PROCESSING: 'warning',
  PARTIALLY_RECEIVED: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'error',
};

export default function PurchasePage() {
  const { activeCompany } = useCompany();

  // Tab state: 0=Dashboard, 1=Quotations, 2=Purchase Orders, 3=Vendors & History
  const [currentTab, setCurrentTab] = useState(0);

  // Data states
  const [dashboard, setDashboard] = useState(null);
  const [quotations, setQuotations] = useState([]);
  const [orders, setOrders] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [quoteStatusFilter, setQuoteStatusFilter] = useState('ALL');
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');

  // Loading & Feedback states
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Dialog states
  const [openQuoteModal, setOpenQuoteModal] = useState(false);
  const [openOrderModal, setOpenOrderModal] = useState(false);
  const [convertDialog, setConvertDialog] = useState({ open: false, quotation: null, warehouse: '' });
  const [viewDetailModal, setViewDetailModal] = useState({ open: false, type: '', data: null });
  const [vendorHistoryModal, setVendorHistoryModal] = useState({
    open: false,
    vendorId: null,
    vendorName: '',
    loading: false,
    data: null,
    tab: 0,
  });

  // Form State for Quotation
  const [quoteForm, setQuoteForm] = useState({
    vendor: '',
    quotation_date: new Date().toISOString().split('T')[0],
    valid_until: '',
    notes: '',
    items: [
      { product: '', description: '', quantity: '1.00', unit_price: '0.00', discount: '0.00', tax: '0.00' },
    ],
  });

  // Form State for Order
  const [orderForm, setOrderForm] = useState({
    vendor: '',
    warehouse: '',
    order_date: new Date().toISOString().split('T')[0],
    expected_date: '',
    notes: '',
    items: [
      { product: '', description: '', quantity: '1.00', unit_price: '0.00', discount: '0.00', tax: '0.00' },
    ],
  });

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  // ============================================================
  // DATA FETCHING
  // ============================================================
  const fetchData = useCallback(async () => {
    if (!activeCompany?.id) return;
    setLoading(true);
    try {
      if (currentTab === 0) {
        const [dashData, vList, pList, wList] = await Promise.all([
          purchaseService.getDashboard(activeCompany.id),
          inventoryService.getVendors(activeCompany.id),
          inventoryService.getProducts(activeCompany.id),
          inventoryService.getWarehouses(activeCompany.id),
        ]);
        setDashboard(dashData);
        setVendors(vList || []);
        setProducts(pList || []);
        setWarehouses(wList || []);
      } else if (currentTab === 1) {
        const params = {};
        if (quoteStatusFilter !== 'ALL') params.status = quoteStatusFilter;
        if (searchQuery) params.search = searchQuery;
        const [qData, vList, pList] = await Promise.all([
          purchaseService.getQuotations(activeCompany.id, params),
          inventoryService.getVendors(activeCompany.id),
          inventoryService.getProducts(activeCompany.id),
        ]);
        setQuotations(qData || []);
        setVendors(vList || []);
        setProducts(pList || []);
      } else if (currentTab === 2) {
        const params = {};
        if (orderStatusFilter !== 'ALL') params.status = orderStatusFilter;
        if (searchQuery) params.search = searchQuery;
        const [oData, vList, pList, wList] = await Promise.all([
          purchaseService.getOrders(activeCompany.id, params),
          inventoryService.getVendors(activeCompany.id),
          inventoryService.getProducts(activeCompany.id),
          inventoryService.getWarehouses(activeCompany.id),
        ]);
        setOrders(oData || []);
        setVendors(vList || []);
        setProducts(pList || []);
        setWarehouses(wList || []);
      } else if (currentTab === 3) {
        const vList = await inventoryService.getVendors(activeCompany.id);
        setVendors(vList || []);
      }
    } catch (err) {
      console.error('Error fetching purchase data:', err);
      showSnackbar('Failed to load purchase records.', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeCompany?.id, currentTab, quoteStatusFilter, orderStatusFilter, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ============================================================
  // QUOTATION HANDLERS
  // ============================================================
  const handleOpenQuoteModal = () => {
    setQuoteForm({
      vendor: vendors.length > 0 ? vendors[0].id : '',
      quotation_date: new Date().toISOString().split('T')[0],
      valid_until: '',
      notes: '',
      items: [
        { product: products.length > 0 ? products[0].id : '', description: '', quantity: '1.00', unit_price: products.length > 0 ? String(products[0].cost_price || '0.00') : '0.00', discount: '0.00', tax: '0.00' },
      ],
    });
    setOpenQuoteModal(true);
  };

  const handleAddQuoteItem = () => {
    setQuoteForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { product: products.length > 0 ? products[0].id : '', description: '', quantity: '1.00', unit_price: products.length > 0 ? String(products[0].cost_price || '0.00') : '0.00', discount: '0.00', tax: '0.00' },
      ],
    }));
  };

  const handleRemoveQuoteItem = (index) => {
    if (quoteForm.items.length <= 1) return;
    setQuoteForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleQuoteItemChange = (index, field, value) => {
    setQuoteForm((prev) => {
      const updated = [...prev.items];
      updated[index] = { ...updated[index], [field]: value };
      if (field === 'product') {
        const prod = products.find((p) => p.id === parseInt(value) || p.id === value);
        if (prod) {
          updated[index].unit_price = String(prod.cost_price || '0.00');
        }
      }
      return { ...prev, items: updated };
    });
  };

  const calculateQuoteFormTotal = () => {
    let sub = 0;
    let disc = 0;
    let tx = 0;
    quoteForm.items.forEach((itm) => {
      const q = parseFloat(itm.quantity) || 0;
      const p = parseFloat(itm.unit_price) || 0;
      const d = parseFloat(itm.discount) || 0;
      const t = parseFloat(itm.tax) || 0;
      sub += q * p;
      disc += d;
      tx += t;
    });
    return { subtotal: sub, discount: disc, tax: tx, total: Math.max(0, sub - disc + tx) };
  };

  const handleSubmitQuote = async (e) => {
    e.preventDefault();
    if (!activeCompany?.id) return;
    if (!quoteForm.vendor) {
      showSnackbar('Please select a vendor.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await purchaseService.createQuotation(activeCompany.id, quoteForm);
      showSnackbar('Purchase quotation created successfully!');
      setOpenQuoteModal(false);
      fetchData();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.detail || JSON.stringify(err.response?.data) || 'Failed to create quotation.';
      showSnackbar(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteQuote = async (quote) => {
    if (!window.confirm(`Delete purchase quotation ${quote.quotation_number}?`)) return;
    try {
      await purchaseService.deleteQuotation(activeCompany.id, quote.id);
      showSnackbar(`Quotation ${quote.quotation_number} deleted.`);
      fetchData();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.detail || 'Failed to delete quotation.';
      showSnackbar(msg, 'error');
    }
  };

  // ============================================================
  // CONVERSION HANDLERS
  // ============================================================
  const handleOpenConvertDialog = (quote) => {
    setConvertDialog({
      open: true,
      quotation: quote,
      warehouse: warehouses.length > 0 ? warehouses[0].id : '',
    });
  };

  const handleConfirmConvert = async () => {
    if (!convertDialog.quotation || !activeCompany?.id) return;
    setSubmitting(true);
    try {
      const payload = {};
      if (convertDialog.warehouse) payload.warehouse = convertDialog.warehouse;
      const order = await purchaseService.convertToOrder(activeCompany.id, convertDialog.quotation.id, payload);
      showSnackbar(`Quotation converted to Purchase Order ${order.order_number}!`);
      setConvertDialog({ open: false, quotation: null, warehouse: '' });
      fetchData();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.detail || 'Failed to convert quotation.';
      showSnackbar(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================
  // ORDER HANDLERS
  // ============================================================
  const handleOpenOrderModal = () => {
    setOrderForm({
      vendor: vendors.length > 0 ? vendors[0].id : '',
      warehouse: warehouses.length > 0 ? warehouses[0].id : '',
      order_date: new Date().toISOString().split('T')[0],
      expected_date: '',
      notes: '',
      items: [
        { product: products.length > 0 ? products[0].id : '', description: '', quantity: '1.00', unit_price: products.length > 0 ? String(products[0].cost_price || '0.00') : '0.00', discount: '0.00', tax: '0.00' },
      ],
    });
    setOpenOrderModal(true);
  };

  const handleAddOrderItem = () => {
    setOrderForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { product: products.length > 0 ? products[0].id : '', description: '', quantity: '1.00', unit_price: products.length > 0 ? String(products[0].cost_price || '0.00') : '0.00', discount: '0.00', tax: '0.00' },
      ],
    }));
  };

  const handleRemoveOrderItem = (index) => {
    if (orderForm.items.length <= 1) return;
    setOrderForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleOrderItemChange = (index, field, value) => {
    setOrderForm((prev) => {
      const updated = [...prev.items];
      updated[index] = { ...updated[index], [field]: value };
      if (field === 'product') {
        const prod = products.find((p) => p.id === parseInt(value) || p.id === value);
        if (prod) {
          updated[index].unit_price = String(prod.cost_price || '0.00');
        }
      }
      return { ...prev, items: updated };
    });
  };

  const calculateOrderFormTotal = () => {
    let sub = 0;
    let disc = 0;
    let tx = 0;
    orderForm.items.forEach((itm) => {
      const q = parseFloat(itm.quantity) || 0;
      const p = parseFloat(itm.unit_price) || 0;
      const d = parseFloat(itm.discount) || 0;
      const t = parseFloat(itm.tax) || 0;
      sub += q * p;
      disc += d;
      tx += t;
    });
    return { subtotal: sub, discount: disc, tax: tx, total: Math.max(0, sub - disc + tx) };
  };

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    if (!activeCompany?.id) return;
    if (!orderForm.vendor) {
      showSnackbar('Please select a vendor.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await purchaseService.createOrder(activeCompany.id, orderForm);
      showSnackbar('Purchase order created successfully!');
      setOpenOrderModal(false);
      fetchData();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.detail || JSON.stringify(err.response?.data) || 'Failed to create order.';
      showSnackbar(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      await purchaseService.updateOrder(activeCompany.id, orderId, { status: newStatus });
      showSnackbar(`Order status updated to ${newStatus}`);
      fetchData();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.detail || 'Failed to update order status.';
      showSnackbar(msg, 'error');
    }
  };

  const handleDeleteOrder = async (order) => {
    if (!window.confirm(`Delete purchase order ${order.order_number}?`)) return;
    try {
      await purchaseService.deleteOrder(activeCompany.id, order.id);
      showSnackbar(`Purchase order ${order.order_number} deleted.`);
      fetchData();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.detail || 'Failed to delete order.';
      showSnackbar(msg, 'error');
    }
  };

  // ============================================================
  // VENDOR HISTORY MODAL
  // ============================================================
  const handleOpenVendorHistory = async (vendorId, vendorName) => {
    if (!vendorId || !activeCompany?.id) return;
    setVendorHistoryModal({
      open: true,
      vendorId,
      vendorName: vendorName || 'Vendor',
      loading: true,
      data: null,
      tab: 0,
    });
    try {
      const data = await purchaseService.getVendorHistory(activeCompany.id, vendorId);
      setVendorHistoryModal((prev) => ({
        ...prev,
        loading: false,
        data,
      }));
    } catch (err) {
      console.error('Error loading vendor history:', err);
      showSnackbar('Failed to load vendor purchase history.', 'error');
      setVendorHistoryModal((prev) => ({ ...prev, loading: false }));
    }
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <PageHeader
        title="Purchase Management"
        subtitle="Procurement quotations, purchase orders, vendor tracking, and lifecycle conversion"
        action={
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchData}
              disabled={loading}
            >
              Refresh
            </Button>
            {currentTab === 1 && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleOpenQuoteModal}
              >
                New Quotation
              </Button>
            )}
            {currentTab === 2 && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleOpenOrderModal}
              >
                New Purchase Order
              </Button>
            )}
          </Stack>
        }
      />

      {/* Module Tabs */}
      <Tabs
        value={currentTab}
        onChange={(e, val) => {
          setCurrentTab(val);
          setSearchQuery('');
        }}
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
      >
        <Tab icon={<ShoppingCartOutlinedIcon />} iconPosition="start" label="Dashboard" />
        <Tab icon={<RequestQuoteOutlinedIcon />} iconPosition="start" label="Purchase Quotations" />
        <Tab icon={<ReceiptLongOutlinedIcon />} iconPosition="start" label="Purchase Orders" />
        <Tab icon={<StoreOutlinedIcon />} iconPosition="start" label="Vendors & History" />
      </Tabs>

      {/* ============================================================ */}
      {/* TAB 0: DASHBOARD */}
      {/* ============================================================ */}
      {currentTab === 0 && (
        <Box>
          {loading && !dashboard ? (
            <LoadingState message="Loading procurement metrics..." />
          ) : !dashboard ? (
            <EmptyState title="No procurement data available" />
          ) : (
            <Stack spacing={3}>
              {/* Metric Cards */}
              <Grid container spacing={2.5}>
                <Grid item xs={12} sm={6} md={3}>
                  <StatCard
                    title="Total Quotations"
                    value={dashboard.metrics?.total_purchase_quotations || 0}
                    subtitle={`${dashboard.metrics?.accepted_quotations || 0} accepted, ${dashboard.metrics?.converted_quotations || 0} converted`}
                    icon={RequestQuoteOutlinedIcon}
                    color="primary"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <StatCard
                    title="Total Purchase Orders"
                    value={dashboard.metrics?.total_purchase_orders || 0}
                    subtitle={`${dashboard.metrics?.confirmed_orders || 0} confirmed, ${dashboard.metrics?.completed_orders || 0} completed`}
                    icon={ReceiptLongOutlinedIcon}
                    color="info"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <StatCard
                    title="Total Spend"
                    value={`$${parseFloat(dashboard.metrics?.total_purchase_value || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                    subtitle="Committed procurement value"
                    icon={MonetizationOnOutlinedIcon}
                    color="success"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <StatCard
                    title="Pending Orders Value"
                    value={`$${parseFloat(dashboard.metrics?.pending_purchase_value || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                    subtitle={`${dashboard.metrics?.active_vendors || 0} active vendors`}
                    icon={PendingActionsOutlinedIcon}
                    color="warning"
                  />
                </Grid>
              </Grid>

              {/* Recent Activity Grids */}
              <Grid container spacing={3}>
                {/* Recent Quotations */}
                <Grid item xs={12} lg={6}>
                  <Card variant="outlined">
                    <CardContent sx={{ p: 2.5 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                        <Typography variant="h6" fontWeight={700}>
                          Recent Quotations
                        </Typography>
                        <Button size="small" onClick={() => setCurrentTab(1)}>View All</Button>
                      </Stack>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: 'action.hover' }}>
                              <TableCell>Quote #</TableCell>
                              <TableCell>Vendor</TableCell>
                              <TableCell align="right">Total</TableCell>
                              <TableCell align="center">Status</TableCell>
                              <TableCell align="right">Action</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(dashboard.recent_quotations || []).length === 0 ? (
                              <TableRow><TableCell colSpan={5} align="center">No quotations recorded yet</TableCell></TableRow>
                            ) : (
                              dashboard.recent_quotations.map((q) => (
                                <TableRow key={q.id} hover>
                                  <TableCell sx={{ fontWeight: 600 }}>{q.quotation_number}</TableCell>
                                  <TableCell>{q.vendor_name}</TableCell>
                                  <TableCell align="right">${parseFloat(q.total).toFixed(2)}</TableCell>
                                  <TableCell align="center">
                                    <Chip label={q.status} size="small" color={QUOTATION_STATUS_COLORS[q.status] || 'default'} />
                                  </TableCell>
                                  <TableCell align="right">
                                    {q.status !== 'CONVERTED' && (
                                      <Tooltip title="Convert to Purchase Order">
                                        <IconButton size="small" color="primary" onClick={() => handleOpenConvertDialog(q)}>
                                          <TransformOutlinedIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                    )}
                                    <Tooltip title="View Details">
                                      <IconButton size="small" onClick={() => setViewDetailModal({ open: true, type: 'quote', data: q })}>
                                        <VisibilityOutlinedIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Recent Purchase Orders */}
                <Grid item xs={12} lg={6}>
                  <Card variant="outlined">
                    <CardContent sx={{ p: 2.5 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                        <Typography variant="h6" fontWeight={700}>
                          Recent Purchase Orders
                        </Typography>
                        <Button size="small" onClick={() => setCurrentTab(2)}>View All</Button>
                      </Stack>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: 'action.hover' }}>
                              <TableCell>PO #</TableCell>
                              <TableCell>Vendor</TableCell>
                              <TableCell align="right">Total</TableCell>
                              <TableCell align="center">Status</TableCell>
                              <TableCell align="right">Action</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(dashboard.recent_orders || []).length === 0 ? (
                              <TableRow><TableCell colSpan={5} align="center">No purchase orders recorded yet</TableCell></TableRow>
                            ) : (
                              dashboard.recent_orders.map((o) => (
                                <TableRow key={o.id} hover>
                                  <TableCell sx={{ fontWeight: 600 }}>{o.order_number}</TableCell>
                                  <TableCell>{o.vendor_name}</TableCell>
                                  <TableCell align="right">${parseFloat(o.total).toFixed(2)}</TableCell>
                                  <TableCell align="center">
                                    <Chip label={o.status} size="small" color={ORDER_STATUS_COLORS[o.status] || 'default'} />
                                  </TableCell>
                                  <TableCell align="right">
                                    <Tooltip title="View Details">
                                      <IconButton size="small" onClick={() => setViewDetailModal({ open: true, type: 'order', data: o })}>
                                        <VisibilityOutlinedIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Stack>
          )}
        </Box>
      )}

      {/* ============================================================ */}
      {/* TAB 1: PURCHASE QUOTATIONS */}
      {/* ============================================================ */}
      {currentTab === 1 && (
        <Stack spacing={2.5}>
          {/* Filters Bar */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search quotation #, vendor, or notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={quoteStatusFilter}
                    label="Status"
                    onChange={(e) => setQuoteStatusFilter(e.target.value)}
                  >
                    <MenuItem value="ALL">All Statuses</MenuItem>
                    <MenuItem value="DRAFT">Draft</MenuItem>
                    <MenuItem value="SENT">Sent</MenuItem>
                    <MenuItem value="ACCEPTED">Accepted</MenuItem>
                    <MenuItem value="REJECTED">Rejected</MenuItem>
                    <MenuItem value="EXPIRED">Expired</MenuItem>
                    <MenuItem value="CONVERTED">Converted</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Paper>

          {/* Quotations Table */}
          {loading ? (
            <LoadingState message="Loading purchase quotations..." />
          ) : quotations.length === 0 ? (
            <EmptyState
              title="No Purchase Quotations Found"
              description="Create a quotation from a supplier to begin the procurement workflow."
              action={
                <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenQuoteModal}>
                  New Quotation
                </Button>
              }
            />
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell>Quotation #</TableCell>
                    <TableCell>Vendor</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Valid Until</TableCell>
                    <TableCell align="center">Items</TableCell>
                    <TableCell align="right">Subtotal</TableCell>
                    <TableCell align="right">Discount</TableCell>
                    <TableCell align="right">Tax</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {quotations.map((q) => (
                    <TableRow key={q.id} hover>
                      <TableCell sx={{ fontWeight: 700 }}>
                        <Chip label={q.quotation_number} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Tooltip title="View Vendor History">
                          <Typography
                            variant="body2"
                            fontWeight={600}
                            sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline', color: 'primary.main' } }}
                            onClick={() => handleOpenVendorHistory(q.vendor, q.vendor_name)}
                          >
                            {q.vendor_name}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>{q.quotation_date}</TableCell>
                      <TableCell>{q.valid_until || '—'}</TableCell>
                      <TableCell align="center">{q.items_count}</TableCell>
                      <TableCell align="right">${parseFloat(q.subtotal).toFixed(2)}</TableCell>
                      <TableCell align="right">${parseFloat(q.discount).toFixed(2)}</TableCell>
                      <TableCell align="right">${parseFloat(q.tax).toFixed(2)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: 'primary.main' }}>
                        ${parseFloat(q.total).toFixed(2)}
                      </TableCell>
                      <TableCell align="center">
                        <Chip label={q.status} size="small" color={QUOTATION_STATUS_COLORS[q.status] || 'default'} />
                      </TableCell>
                      <TableCell align="right">
                        {q.status !== 'CONVERTED' && (
                          <Tooltip title="Convert to Purchase Order">
                            <IconButton size="small" color="primary" onClick={() => handleOpenConvertDialog(q)}>
                              <TransformOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="View Details">
                          <IconButton size="small" onClick={() => setViewDetailModal({ open: true, type: 'quote', data: q })}>
                            <VisibilityOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {q.status !== 'CONVERTED' && (
                          <Tooltip title="Delete Quotation">
                            <IconButton size="small" color="error" onClick={() => handleDeleteQuote(q)}>
                              <DeleteOutlineOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Stack>
      )}

      {/* ============================================================ */}
      {/* TAB 2: PURCHASE ORDERS */}
      {/* ============================================================ */}
      {currentTab === 2 && (
        <Stack spacing={2.5}>
          {/* Filters Bar */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search order #, vendor, or notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={orderStatusFilter}
                    label="Status"
                    onChange={(e) => setOrderStatusFilter(e.target.value)}
                  >
                    <MenuItem value="ALL">All Statuses</MenuItem>
                    <MenuItem value="DRAFT">Draft</MenuItem>
                    <MenuItem value="CONFIRMED">Confirmed</MenuItem>
                    <MenuItem value="PROCESSING">Processing</MenuItem>
                    <MenuItem value="PARTIALLY_RECEIVED">Partially Received</MenuItem>
                    <MenuItem value="COMPLETED">Completed</MenuItem>
                    <MenuItem value="CANCELLED">Cancelled</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Paper>

          {/* Orders Table */}
          {loading ? (
            <LoadingState message="Loading purchase orders..." />
          ) : orders.length === 0 ? (
            <EmptyState
              title="No Purchase Orders Found"
              description="Create a purchase order directly or convert one from an accepted quotation."
              action={
                <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenOrderModal}>
                  New Purchase Order
                </Button>
              }
            />
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell>Order #</TableCell>
                    <TableCell>Vendor</TableCell>
                    <TableCell>Warehouse</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Expected</TableCell>
                    <TableCell align="center">Items</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {orders.map((o) => (
                    <TableRow key={o.id} hover>
                      <TableCell sx={{ fontWeight: 700 }}>
                        <Chip label={o.order_number} size="small" variant="outlined" />
                        {o.quotation_number && (
                          <Typography variant="caption" display="block" color="text.secondary">
                            Ref: {o.quotation_number}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Tooltip title="View Vendor History">
                          <Typography
                            variant="body2"
                            fontWeight={600}
                            sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline', color: 'primary.main' } }}
                            onClick={() => handleOpenVendorHistory(o.vendor, o.vendor_name)}
                          >
                            {o.vendor_name}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        {o.warehouse_name ? (
                          <Chip icon={<WarehouseOutlinedIcon />} label={o.warehouse_name} size="small" variant="outlined" />
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>{o.order_date}</TableCell>
                      <TableCell>{o.expected_date || '—'}</TableCell>
                      <TableCell align="center">{o.items_count}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: 'info.main' }}>
                        ${parseFloat(o.total).toFixed(2)}
                      </TableCell>
                      <TableCell align="center">
                        <Chip label={o.status} size="small" color={ORDER_STATUS_COLORS[o.status] || 'default'} />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="View Details">
                          <IconButton size="small" onClick={() => setViewDetailModal({ open: true, type: 'order', data: o })}>
                            <VisibilityOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {o.status !== 'CANCELLED' && o.status !== 'COMPLETED' && (
                          <Tooltip title="Cancel Order">
                            <IconButton size="small" color="error" onClick={() => handleUpdateOrderStatus(o.id, 'CANCELLED')}>
                              <CancelOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {o.status !== 'COMPLETED' && (
                          <Tooltip title="Delete Order">
                            <IconButton size="small" color="error" onClick={() => handleDeleteOrder(o)}>
                              <DeleteOutlineOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Stack>
      )}

      {/* ============================================================ */}
      {/* TAB 3: VENDORS & PURCHASE HISTORY */}
      {/* ============================================================ */}
      {currentTab === 3 && (
        <Stack spacing={2.5}>
          {loading ? (
            <LoadingState message="Loading vendors..." />
          ) : vendors.length === 0 ? (
            <EmptyState title="No vendors found" description="Configure vendors in the Inventory module." />
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell>Vendor Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>Tax ID</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="center">History</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {vendors.map((v) => (
                    <TableRow key={v.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{v.name}</TableCell>
                      <TableCell>{v.email || '—'}</TableCell>
                      <TableCell>{v.phone || '—'}</TableCell>
                      <TableCell>{v.tax_id || '—'}</TableCell>
                      <TableCell align="center">
                        <Chip
                          label={v.is_active ? 'Active' : 'Inactive'}
                          size="small"
                          color={v.is_active ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<HistoryOutlinedIcon />}
                          onClick={() => handleOpenVendorHistory(v.id, v.name)}
                        >
                          View History
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Stack>
      )}

      {/* ============================================================ */}
      {/* CREATE QUOTATION DIALOG */}
      {/* ============================================================ */}
      <Dialog open={openQuoteModal} onClose={() => setOpenQuoteModal(false)} maxWidth="md" fullWidth>
        <form onSubmit={handleSubmitQuote}>
          <DialogTitle>Create Purchase Quotation</DialogTitle>
          <DialogContent dividers sx={{ p: 3 }}>
            <Grid container spacing={2} sx={{ mb: 2.5 }}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small" required>
                  <InputLabel>Vendor</InputLabel>
                  <Select
                    value={quoteForm.vendor}
                    label="Vendor"
                    onChange={(e) => setQuoteForm((prev) => ({ ...prev, vendor: e.target.value }))}
                  >
                    {vendors.map((v) => (
                      <MenuItem key={v.id} value={v.id}>{v.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="Quotation Date"
                  InputLabelProps={{ shrink: true }}
                  value={quoteForm.quotation_date}
                  onChange={(e) => setQuoteForm((prev) => ({ ...prev, quotation_date: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="Valid Until"
                  InputLabelProps={{ shrink: true }}
                  value={quoteForm.valid_until}
                  onChange={(e) => setQuoteForm((prev) => ({ ...prev, valid_until: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Notes / Terms"
                  value={quoteForm.notes}
                  onChange={(e) => setQuoteForm((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography variant="subtitle1" fontWeight={700}>Line Items</Typography>
              <Button size="small" startIcon={<AddIcon />} onClick={handleAddQuoteItem}>Add Item</Button>
            </Stack>

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell sx={{ minWidth: 160 }}>Product</TableCell>
                    <TableCell sx={{ width: 100 }}>Qty</TableCell>
                    <TableCell sx={{ width: 110 }}>Unit Price</TableCell>
                    <TableCell sx={{ width: 100 }}>Discount</TableCell>
                    <TableCell sx={{ width: 90 }}>Tax</TableCell>
                    <TableCell align="right" sx={{ width: 110 }}>Line Total</TableCell>
                    <TableCell align="center" sx={{ width: 50 }}></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {quoteForm.items.map((item, idx) => {
                    const q = parseFloat(item.quantity) || 0;
                    const p = parseFloat(item.unit_price) || 0;
                    const d = parseFloat(item.discount) || 0;
                    const t = parseFloat(item.tax) || 0;
                    const lineTotal = Math.max(0, q * p - d + t);

                    return (
                      <TableRow key={idx}>
                        <TableCell>
                          <FormControl fullWidth size="small">
                            <Select
                              value={item.product}
                              onChange={(e) => handleQuoteItemChange(idx, 'product', e.target.value)}
                            >
                              {products.map((pr) => (
                                <MenuItem key={pr.id} value={pr.id}>{pr.name} [{pr.sku}]</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            type="number"
                            inputProps={{ min: 0.01, step: 'any' }}
                            value={item.quantity}
                            onChange={(e) => handleQuoteItemChange(idx, 'quantity', e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            type="number"
                            inputProps={{ min: 0, step: 'any' }}
                            value={item.unit_price}
                            onChange={(e) => handleQuoteItemChange(idx, 'unit_price', e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            type="number"
                            inputProps={{ min: 0, step: 'any' }}
                            value={item.discount}
                            onChange={(e) => handleQuoteItemChange(idx, 'discount', e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            type="number"
                            inputProps={{ min: 0, step: 'any' }}
                            value={item.tax}
                            onChange={(e) => handleQuoteItemChange(idx, 'tax', e.target.value)}
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          ${lineTotal.toFixed(2)}
                        </TableCell>
                        <TableCell align="center">
                          <IconButton size="small" color="error" onClick={() => handleRemoveQuoteItem(idx)} disabled={quoteForm.items.length <= 1}>
                            <DeleteOutlineOutlinedIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Totals Summary */}
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Box sx={{ width: 280 }}>
                {(() => {
                  const totals = calculateQuoteFormTotal();
                  return (
                    <Stack spacing={1}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Subtotal:</Typography>
                        <Typography variant="body2" fontWeight={600}>${totals.subtotal.toFixed(2)}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Discount:</Typography>
                        <Typography variant="body2" fontWeight={600}>-${totals.discount.toFixed(2)}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Tax:</Typography>
                        <Typography variant="body2" fontWeight={600}>+${totals.tax.toFixed(2)}</Typography>
                      </Stack>
                      <Divider />
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="subtitle1" fontWeight={700}>Total:</Typography>
                        <Typography variant="subtitle1" fontWeight={700} color="primary.main">
                          ${totals.total.toFixed(2)}
                        </Typography>
                      </Stack>
                    </Stack>
                  );
                })()}
              </Box>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setOpenQuoteModal(false)} disabled={submitting}>Cancel</Button>
            <Button variant="contained" type="submit" disabled={submitting}>
              {submitting ? <CircularProgress size={22} /> : 'Save Quotation'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ============================================================ */}
      {/* CREATE PURCHASE ORDER DIALOG */}
      {/* ============================================================ */}
      <Dialog open={openOrderModal} onClose={() => setOpenOrderModal(false)} maxWidth="md" fullWidth>
        <form onSubmit={handleSubmitOrder}>
          <DialogTitle>Create Direct Purchase Order</DialogTitle>
          <DialogContent dividers sx={{ p: 3 }}>
            <Grid container spacing={2} sx={{ mb: 2.5 }}>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth size="small" required>
                  <InputLabel>Vendor</InputLabel>
                  <Select
                    value={orderForm.vendor}
                    label="Vendor"
                    onChange={(e) => setOrderForm((prev) => ({ ...prev, vendor: e.target.value }))}
                  >
                    {vendors.map((v) => (
                      <MenuItem key={v.id} value={v.id}>{v.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Destination Warehouse</InputLabel>
                  <Select
                    value={orderForm.warehouse}
                    label="Destination Warehouse"
                    onChange={(e) => setOrderForm((prev) => ({ ...prev, warehouse: e.target.value }))}
                  >
                    <MenuItem value=""><em>None / Unassigned</em></MenuItem>
                    {warehouses.map((w) => (
                      <MenuItem key={w.id} value={w.id}>{w.name} ({w.code})</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={2}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="Order Date"
                  InputLabelProps={{ shrink: true }}
                  value={orderForm.order_date}
                  onChange={(e) => setOrderForm((prev) => ({ ...prev, order_date: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={2}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="Expected Date"
                  InputLabelProps={{ shrink: true }}
                  value={orderForm.expected_date}
                  onChange={(e) => setOrderForm((prev) => ({ ...prev, expected_date: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Notes"
                  value={orderForm.notes}
                  onChange={(e) => setOrderForm((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography variant="subtitle1" fontWeight={700}>Line Items</Typography>
              <Button size="small" startIcon={<AddIcon />} onClick={handleAddOrderItem}>Add Item</Button>
            </Stack>

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell sx={{ minWidth: 160 }}>Product</TableCell>
                    <TableCell sx={{ width: 100 }}>Qty</TableCell>
                    <TableCell sx={{ width: 110 }}>Unit Price</TableCell>
                    <TableCell sx={{ width: 100 }}>Discount</TableCell>
                    <TableCell sx={{ width: 90 }}>Tax</TableCell>
                    <TableCell align="right" sx={{ width: 110 }}>Line Total</TableCell>
                    <TableCell align="center" sx={{ width: 50 }}></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {orderForm.items.map((item, idx) => {
                    const q = parseFloat(item.quantity) || 0;
                    const p = parseFloat(item.unit_price) || 0;
                    const d = parseFloat(item.discount) || 0;
                    const t = parseFloat(item.tax) || 0;
                    const lineTotal = Math.max(0, q * p - d + t);

                    return (
                      <TableRow key={idx}>
                        <TableCell>
                          <FormControl fullWidth size="small">
                            <Select
                              value={item.product}
                              onChange={(e) => handleOrderItemChange(idx, 'product', e.target.value)}
                            >
                              {products.map((pr) => (
                                <MenuItem key={pr.id} value={pr.id}>{pr.name} [{pr.sku}]</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            type="number"
                            inputProps={{ min: 0.01, step: 'any' }}
                            value={item.quantity}
                            onChange={(e) => handleOrderItemChange(idx, 'quantity', e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            type="number"
                            inputProps={{ min: 0, step: 'any' }}
                            value={item.unit_price}
                            onChange={(e) => handleOrderItemChange(idx, 'unit_price', e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            type="number"
                            inputProps={{ min: 0, step: 'any' }}
                            value={item.discount}
                            onChange={(e) => handleOrderItemChange(idx, 'discount', e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            type="number"
                            inputProps={{ min: 0, step: 'any' }}
                            value={item.tax}
                            onChange={(e) => handleOrderItemChange(idx, 'tax', e.target.value)}
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          ${lineTotal.toFixed(2)}
                        </TableCell>
                        <TableCell align="center">
                          <IconButton size="small" color="error" onClick={() => handleRemoveOrderItem(idx)} disabled={orderForm.items.length <= 1}>
                            <DeleteOutlineOutlinedIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Totals Summary */}
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Box sx={{ width: 280 }}>
                {(() => {
                  const totals = calculateOrderFormTotal();
                  return (
                    <Stack spacing={1}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Subtotal:</Typography>
                        <Typography variant="body2" fontWeight={600}>${totals.subtotal.toFixed(2)}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Discount:</Typography>
                        <Typography variant="body2" fontWeight={600}>-${totals.discount.toFixed(2)}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Tax:</Typography>
                        <Typography variant="body2" fontWeight={600}>+${totals.tax.toFixed(2)}</Typography>
                      </Stack>
                      <Divider />
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="subtitle1" fontWeight={700}>Total:</Typography>
                        <Typography variant="subtitle1" fontWeight={700} color="info.main">
                          ${totals.total.toFixed(2)}
                        </Typography>
                      </Stack>
                    </Stack>
                  );
                })()}
              </Box>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setOpenOrderModal(false)} disabled={submitting}>Cancel</Button>
            <Button variant="contained" type="submit" disabled={submitting}>
              {submitting ? <CircularProgress size={22} /> : 'Save Purchase Order'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ============================================================ */}
      {/* CONVERT TO ORDER DIALOG */}
      {/* ============================================================ */}
      <Dialog open={convertDialog.open} onClose={() => setConvertDialog({ open: false, quotation: null, warehouse: '' })} maxWidth="xs" fullWidth>
        <DialogTitle>Convert Quotation to Purchase Order</DialogTitle>
        <DialogContent dividers sx={{ p: 3 }}>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Convert quotation <strong>{convertDialog.quotation?.quotation_number}</strong> ({convertDialog.quotation?.vendor_name}) into a confirmed Purchase Order?
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel>Destination Warehouse</InputLabel>
            <Select
              value={convertDialog.warehouse}
              label="Destination Warehouse"
              onChange={(e) => setConvertDialog((prev) => ({ ...prev, warehouse: e.target.value }))}
            >
              <MenuItem value=""><em>Default / Unassigned</em></MenuItem>
              {warehouses.map((w) => (
                <MenuItem key={w.id} value={w.id}>{w.name} ({w.code})</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setConvertDialog({ open: false, quotation: null, warehouse: '' })} disabled={submitting}>Cancel</Button>
          <Button variant="contained" color="primary" onClick={handleConfirmConvert} disabled={submitting}>
            {submitting ? <CircularProgress size={20} /> : 'Confirm Conversion'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ============================================================ */}
      {/* DETAIL MODAL */}
      {/* ============================================================ */}
      <Dialog open={viewDetailModal.open} onClose={() => setViewDetailModal({ open: false, type: '', data: null })} maxWidth="md" fullWidth>
        <DialogTitle>
          {viewDetailModal.type === 'quote' ? `Purchase Quotation: ${viewDetailModal.data?.quotation_number}` : `Purchase Order: ${viewDetailModal.data?.order_number}`}
        </DialogTitle>
        <DialogContent dividers sx={{ p: 3 }}>
          {viewDetailModal.data && (
            <Box>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Vendor</Typography>
                  <Typography variant="body1" fontWeight={600}>{viewDetailModal.data.vendor_name}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Status</Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <Chip
                      label={viewDetailModal.data.status}
                      size="small"
                      color={viewDetailModal.type === 'quote' ? QUOTATION_STATUS_COLORS[viewDetailModal.data.status] : ORDER_STATUS_COLORS[viewDetailModal.data.status]}
                    />
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Date</Typography>
                  <Typography variant="body2">
                    {viewDetailModal.type === 'quote' ? viewDetailModal.data.quotation_date : viewDetailModal.data.order_date}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">
                    {viewDetailModal.type === 'quote' ? 'Valid Until' : 'Expected Date'}
                  </Typography>
                  <Typography variant="body2">
                    {(viewDetailModal.type === 'quote' ? viewDetailModal.data.valid_until : viewDetailModal.data.expected_date) || '—'}
                  </Typography>
                </Grid>
              </Grid>

              {viewDetailModal.data.notes && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  {viewDetailModal.data.notes}
                </Alert>
              )}

              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Items</Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                      <TableCell>Product</TableCell>
                      <TableCell align="right">Qty</TableCell>
                      <TableCell align="right">Unit Price</TableCell>
                      <TableCell align="right">Discount</TableCell>
                      <TableCell align="right">Tax</TableCell>
                      <TableCell align="right">Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(viewDetailModal.data.items || []).map((itm) => (
                      <TableRow key={itm.id}>
                        <TableCell sx={{ fontWeight: 600 }}>{itm.product_name} [{itm.product_sku}]</TableCell>
                        <TableCell align="right">{parseFloat(itm.quantity).toFixed(2)}</TableCell>
                        <TableCell align="right">${parseFloat(itm.unit_price).toFixed(2)}</TableCell>
                        <TableCell align="right">${parseFloat(itm.discount).toFixed(2)}</TableCell>
                        <TableCell align="right">${parseFloat(itm.tax).toFixed(2)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>${parseFloat(itm.line_total).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                <Box sx={{ width: 260 }}>
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Subtotal:</Typography>
                      <Typography variant="body2" fontWeight={600}>${parseFloat(viewDetailModal.data.subtotal).toFixed(2)}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Discount:</Typography>
                      <Typography variant="body2" fontWeight={600}>-${parseFloat(viewDetailModal.data.discount).toFixed(2)}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Tax:</Typography>
                      <Typography variant="body2" fontWeight={600}>+${parseFloat(viewDetailModal.data.tax).toFixed(2)}</Typography>
                    </Stack>
                    <Divider />
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="subtitle1" fontWeight={700}>Total:</Typography>
                      <Typography variant="subtitle1" fontWeight={700} color="primary.main">
                        ${parseFloat(viewDetailModal.data.total).toFixed(2)}
                      </Typography>
                    </Stack>
                  </Stack>
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setViewDetailModal({ open: false, type: '', data: null })}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* ============================================================ */}
      {/* VENDOR PURCHASE HISTORY MODAL */}
      {/* ============================================================ */}
      <Dialog open={vendorHistoryModal.open} onClose={() => setVendorHistoryModal((prev) => ({ ...prev, open: false }))} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Vendor Purchase History: {vendorHistoryModal.vendorName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Historical procurement audit trail, order fulfillment, and lifetime spend
              </Typography>
            </Box>
            <IconButton onClick={() => setVendorHistoryModal((prev) => ({ ...prev, open: false }))} size="small">
              <CancelOutlinedIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 3 }}>
          {vendorHistoryModal.loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : !vendorHistoryModal.data ? (
            <EmptyState title="No vendor records found" />
          ) : (
            <Box>
              {/* Lifetime Metrics Cards */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={2.4}>
                  <Card variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">Total Quotations</Typography>
                    <Typography variant="h6" fontWeight={700} color="primary.main">
                      {vendorHistoryModal.data.metrics?.total_quotations || 0}
                    </Typography>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                  <Card variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">Total Orders</Typography>
                    <Typography variant="h6" fontWeight={700} color="info.main">
                      {vendorHistoryModal.data.metrics?.total_orders || 0}
                    </Typography>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                  <Card variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">Completed Orders</Typography>
                    <Typography variant="h6" fontWeight={700} color="success.main">
                      {vendorHistoryModal.data.metrics?.completed_orders || 0}
                    </Typography>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                  <Card variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">Pending Orders</Typography>
                    <Typography variant="h6" fontWeight={700} color="warning.main">
                      {vendorHistoryModal.data.metrics?.pending_orders || 0}
                    </Typography>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                  <Card variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">Total Spend</Typography>
                    <Typography variant="h6" fontWeight={700} color="success.dark">
                      ${parseFloat(vendorHistoryModal.data.metrics?.total_purchased_amount || 0).toFixed(2)}
                    </Typography>
                  </Card>
                </Grid>
              </Grid>

              {/* Sub-tabs */}
              <Tabs
                value={vendorHistoryModal.tab}
                onChange={(e, val) => setVendorHistoryModal((prev) => ({ ...prev, tab: val }))}
                sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
              >
                <Tab label={`Purchase Orders (${vendorHistoryModal.data.orders?.length || 0})`} />
                <Tab label={`Quotations (${vendorHistoryModal.data.quotations?.length || 0})`} />
              </Tabs>

              {/* Orders Tab */}
              {vendorHistoryModal.tab === 0 && (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'action.hover' }}>
                        <TableCell>PO #</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell>Warehouse</TableCell>
                        <TableCell align="right">Total</TableCell>
                        <TableCell align="center">Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(vendorHistoryModal.data.orders || []).length === 0 ? (
                        <TableRow><TableCell colSpan={5} align="center">No orders found for this vendor</TableCell></TableRow>
                      ) : (
                        vendorHistoryModal.data.orders.map((o) => (
                          <TableRow key={o.id} hover>
                            <TableCell sx={{ fontWeight: 600 }}>{o.order_number}</TableCell>
                            <TableCell>{o.order_date}</TableCell>
                            <TableCell>{o.warehouse_name || '—'}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600 }}>${parseFloat(o.total).toFixed(2)}</TableCell>
                            <TableCell align="center">
                              <Chip label={o.status} size="small" color={ORDER_STATUS_COLORS[o.status] || 'default'} />
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {/* Quotations Tab */}
              {vendorHistoryModal.tab === 1 && (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'action.hover' }}>
                        <TableCell>Quote #</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell>Valid Until</TableCell>
                        <TableCell align="right">Total</TableCell>
                        <TableCell align="center">Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(vendorHistoryModal.data.quotations || []).length === 0 ? (
                        <TableRow><TableCell colSpan={5} align="center">No quotations found for this vendor</TableCell></TableRow>
                      ) : (
                        vendorHistoryModal.data.quotations.map((q) => (
                          <TableRow key={q.id} hover>
                            <TableCell sx={{ fontWeight: 600 }}>{q.quotation_number}</TableCell>
                            <TableCell>{q.quotation_date}</TableCell>
                            <TableCell>{q.valid_until || '—'}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600 }}>${parseFloat(q.total).toFixed(2)}</TableCell>
                            <TableCell align="center">
                              <Chip label={q.status} size="small" color={QUOTATION_STATUS_COLORS[q.status] || 'default'} />
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setVendorHistoryModal((prev) => ({ ...prev, open: false }))}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Global Snackbar Notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
