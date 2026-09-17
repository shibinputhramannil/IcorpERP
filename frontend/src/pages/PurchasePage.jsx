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
  LinearProgress,
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
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';

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

const RECEIPT_STATUS_COLORS = {
  DRAFT: 'default',
  RECEIVED: 'success',
  CANCELLED: 'error',
};

export default function PurchasePage() {
  const { activeCompany } = useCompany();

  // Tab state: 0=Dashboard, 1=Quotations, 2=Purchase Orders, 3=Goods Receipts (GRN), 4=Vendors & History
  const [currentTab, setCurrentTab] = useState(0);

  // Data states
  const [dashboard, setDashboard] = useState(null);
  const [quotations, setQuotations] = useState([]);
  const [orders, setOrders] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [quoteStatusFilter, setQuoteStatusFilter] = useState('ALL');
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');
  const [receiptWarehouseFilter, setReceiptWarehouseFilter] = useState('ALL');

  // Loading & Feedback states
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Dialog states
  const [openQuoteModal, setOpenQuoteModal] = useState(false);
  const [openOrderModal, setOpenOrderModal] = useState(false);
  const [convertDialog, setConvertDialog] = useState({ open: false, quotation: null, warehouse: '' });
  const [viewDetailModal, setViewDetailModal] = useState({ open: false, type: '', data: null });
  const [receiveModal, setReceiveModal] = useState({
    open: false,
    order: null,
    warehouse: '',
    receiptDate: '',
    notes: '',
    items: [],
  });
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
        const [dashData, vList, pList, wList, rList] = await Promise.all([
          purchaseService.getDashboard(activeCompany.id),
          inventoryService.getVendors(activeCompany.id),
          inventoryService.getProducts(activeCompany.id),
          inventoryService.getWarehouses(activeCompany.id),
          purchaseService.getReceipts(activeCompany.id),
        ]);
        setDashboard(dashData);
        setVendors(vList || []);
        setProducts(pList || []);
        setWarehouses(wList || []);
        setReceipts(rList || []);
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
        const params = {};
        if (receiptWarehouseFilter !== 'ALL') params.warehouse = receiptWarehouseFilter;
        if (searchQuery) params.search = searchQuery;
        const [rData, wList] = await Promise.all([
          purchaseService.getReceipts(activeCompany.id, params),
          inventoryService.getWarehouses(activeCompany.id),
        ]);
        setReceipts(rData || []);
        setWarehouses(wList || []);
      } else if (currentTab === 4) {
        const vList = await inventoryService.getVendors(activeCompany.id);
        setVendors(vList || []);
      }
    } catch (err) {
      console.error('Error fetching purchase data:', err);
      showSnackbar('Failed to load purchase records.', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeCompany?.id, currentTab, quoteStatusFilter, orderStatusFilter, receiptWarehouseFilter, searchQuery]);

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
        {
          product: products.length > 0 ? products[0].id : '',
          description: '',
          quantity: '1.00',
          unit_price: products.length > 0 ? String(products[0].cost_price || '0.00') : '0.00',
          discount: '0.00',
          tax: '0.00',
        },
      ],
    });
    setOpenQuoteModal(true);
  };

  const handleAddQuoteItem = () => {
    setQuoteForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          product: products.length > 0 ? products[0].id : '',
          description: '',
          quantity: '1.00',
          unit_price: products.length > 0 ? String(products[0].cost_price || '0.00') : '0.00',
          discount: '0.00',
          tax: '0.00',
        },
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
        if (prod && prod.cost_price) {
          updated[index].unit_price = String(prod.cost_price);
        }
      }
      return { ...prev, items: updated };
    });
  };

  const calculateQuoteFormTotal = () => {
    let subtotal = 0;
    let discount = 0;
    let tax = 0;
    quoteForm.items.forEach((itm) => {
      const q = parseFloat(itm.quantity) || 0;
      const p = parseFloat(itm.unit_price) || 0;
      const d = parseFloat(itm.discount) || 0;
      const t = parseFloat(itm.tax) || 0;
      subtotal += q * p;
      discount += d;
      tax += t;
    });
    const total = Math.max(0, subtotal - discount + tax);
    return { subtotal, discount, tax, total };
  };

  const handleSubmitQuote = async (e) => {
    e.preventDefault();
    if (!activeCompany?.id) return;
    if (!quoteForm.vendor) {
      showSnackbar('Please select a vendor.', 'warning');
      return;
    }
    if (quoteForm.items.some((itm) => !itm.product || parseFloat(itm.quantity) <= 0)) {
      showSnackbar('Please select valid products and positive quantities for all items.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        vendor: quoteForm.vendor,
        quotation_date: quoteForm.quotation_date,
        valid_until: quoteForm.valid_until || null,
        notes: quoteForm.notes,
        items: quoteForm.items.map((itm) => ({
          product: itm.product,
          description: itm.description,
          quantity: itm.quantity,
          unit_price: itm.unit_price,
          discount: itm.discount,
          tax: itm.tax,
        })),
      };
      await purchaseService.createQuotation(activeCompany.id, payload);
      showSnackbar('Purchase quotation created successfully!', 'success');
      setOpenQuoteModal(false);
      fetchData();
    } catch (err) {
      console.error('Error creating quotation:', err);
      const detail = err.response?.data?.detail || Object.values(err.response?.data || {})[0] || 'Failed to create quotation.';
      showSnackbar(Array.isArray(detail) ? detail[0] : String(detail), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteQuote = async (quote) => {
    if (!window.confirm(`Delete quotation ${quote.quotation_number}?`)) return;
    try {
      await purchaseService.deleteQuotation(activeCompany.id, quote.id);
      showSnackbar(`Quotation ${quote.quotation_number} deleted.`, 'success');
      fetchData();
    } catch (err) {
      showSnackbar('Failed to delete quotation.', 'error');
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
    if (!activeCompany?.id || !convertDialog.quotation) return;
    setSubmitting(true);
    try {
      const payload = {};
      if (convertDialog.warehouse) payload.warehouse = convertDialog.warehouse;
      const newOrder = await purchaseService.convertToOrder(activeCompany.id, convertDialog.quotation.id, payload);
      showSnackbar(`Successfully converted to Purchase Order ${newOrder.order_number}!`, 'success');
      setConvertDialog({ open: false, quotation: null, warehouse: '' });
      setCurrentTab(2);
      fetchData();
    } catch (err) {
      console.error('Error converting quotation:', err);
      const detail = err.response?.data?.detail || 'Failed to convert quotation to order.';
      showSnackbar(detail, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================
  // PURCHASE ORDER HANDLERS
  // ============================================================
  const handleOpenOrderModal = () => {
    setOrderForm({
      vendor: vendors.length > 0 ? vendors[0].id : '',
      warehouse: warehouses.length > 0 ? warehouses[0].id : '',
      order_date: new Date().toISOString().split('T')[0],
      expected_date: '',
      notes: '',
      items: [
        {
          product: products.length > 0 ? products[0].id : '',
          description: '',
          quantity: '1.00',
          unit_price: products.length > 0 ? String(products[0].cost_price || '0.00') : '0.00',
          discount: '0.00',
          tax: '0.00',
        },
      ],
    });
    setOpenOrderModal(true);
  };

  const handleAddOrderItem = () => {
    setOrderForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          product: products.length > 0 ? products[0].id : '',
          description: '',
          quantity: '1.00',
          unit_price: products.length > 0 ? String(products[0].cost_price || '0.00') : '0.00',
          discount: '0.00',
          tax: '0.00',
        },
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
        if (prod && prod.cost_price) {
          updated[index].unit_price = String(prod.cost_price);
        }
      }
      return { ...prev, items: updated };
    });
  };

  const calculateOrderFormTotal = () => {
    let subtotal = 0;
    let discount = 0;
    let tax = 0;
    orderForm.items.forEach((itm) => {
      const q = parseFloat(itm.quantity) || 0;
      const p = parseFloat(itm.unit_price) || 0;
      const d = parseFloat(itm.discount) || 0;
      const t = parseFloat(itm.tax) || 0;
      subtotal += q * p;
      discount += d;
      tax += t;
    });
    const total = Math.max(0, subtotal - discount + tax);
    return { subtotal, discount, tax, total };
  };

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    if (!activeCompany?.id) return;
    if (!orderForm.vendor) {
      showSnackbar('Please select a vendor.', 'warning');
      return;
    }
    if (orderForm.items.some((itm) => !itm.product || parseFloat(itm.quantity) <= 0)) {
      showSnackbar('Please select valid products and positive quantities for all items.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        vendor: orderForm.vendor,
        warehouse: orderForm.warehouse || null,
        order_date: orderForm.order_date,
        expected_date: orderForm.expected_date || null,
        notes: orderForm.notes,
        items: orderForm.items.map((itm) => ({
          product: itm.product,
          description: itm.description,
          quantity: itm.quantity,
          unit_price: itm.unit_price,
          discount: itm.discount,
          tax: itm.tax,
        })),
      };
      await purchaseService.createOrder(activeCompany.id, payload);
      showSnackbar('Purchase order created successfully!', 'success');
      setOpenOrderModal(false);
      fetchData();
    } catch (err) {
      console.error('Error creating order:', err);
      const detail = err.response?.data?.detail || Object.values(err.response?.data || {})[0] || 'Failed to create order.';
      showSnackbar(Array.isArray(detail) ? detail[0] : String(detail), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteOrder = async (order) => {
    if (!window.confirm(`Delete purchase order ${order.order_number}?`)) return;
    try {
      await purchaseService.deleteOrder(activeCompany.id, order.id);
      showSnackbar(`Order ${order.order_number} deleted.`, 'success');
      fetchData();
    } catch (err) {
      const detail = err.response?.data?.detail || 'Failed to delete order.';
      showSnackbar(detail, 'error');
    }
  };

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      await purchaseService.updateOrder(activeCompany.id, orderId, { status: newStatus });
      showSnackbar(`Order status updated to ${newStatus}.`, 'success');
      fetchData();
    } catch (err) {
      showSnackbar('Failed to update status.', 'error');
    }
  };

  // ============================================================
  // GOODS RECEIVING HANDLERS (Phase 5B)
  // ============================================================
  const handleOpenReceiveModal = (order) => {
    const items = (order.items || []).map((itm) => {
      const remaining = parseFloat(itm.remaining_quantity !== undefined ? itm.remaining_quantity : itm.quantity);
      return {
        purchase_order_item: itm.id,
        product_name: itm.product_name,
        product_sku: itm.product_sku,
        ordered_quantity: parseFloat(itm.quantity),
        previously_received_quantity: parseFloat(itm.received_quantity || 0),
        remaining_quantity: remaining,
        received_quantity: remaining > 0 ? remaining : 0,
        notes: '',
      };
    });

    setReceiveModal({
      open: true,
      order: order,
      warehouse: order.warehouse || (warehouses.length > 0 ? warehouses[0].id : ''),
      receiptDate: new Date().toISOString().split('T')[0],
      notes: '',
      items: items,
    });
  };

  const handleReceiveItemQtyChange = (index, value) => {
    setReceiveModal((prev) => {
      const updated = [...prev.items];
      const valNum = parseFloat(value);
      updated[index] = {
        ...updated[index],
        received_quantity: isNaN(valNum) ? '' : valNum,
      };
      return { ...prev, items: updated };
    });
  };

  const handleReceiveItemNotesChange = (index, value) => {
    setReceiveModal((prev) => {
      const updated = [...prev.items];
      updated[index] = { ...updated[index], notes: value };
      return { ...prev, items: updated };
    });
  };

  const handleReceiveAllRemaining = () => {
    setReceiveModal((prev) => ({
      ...prev,
      items: prev.items.map((itm) => ({
        ...itm,
        received_quantity: itm.remaining_quantity,
      })),
    }));
  };

  const handleClearReceiveQuantities = () => {
    setReceiveModal((prev) => ({
      ...prev,
      items: prev.items.map((itm) => ({
        ...itm,
        received_quantity: 0,
      })),
    }));
  };

  const handleSubmitReceive = async (e) => {
    e.preventDefault();
    if (!activeCompany?.id || !receiveModal.order) return;
    if (!receiveModal.warehouse) {
      showSnackbar('Please select a destination warehouse.', 'warning');
      return;
    }

    const itemsToSubmit = receiveModal.items
      .filter((itm) => parseFloat(itm.received_quantity) > 0)
      .map((itm) => ({
        purchase_order_item: itm.purchase_order_item,
        received_quantity: parseFloat(itm.received_quantity),
        notes: itm.notes,
      }));

    if (itemsToSubmit.length === 0) {
      showSnackbar('Please specify a received quantity greater than 0 for at least one item.', 'warning');
      return;
    }

    // Client validation for over-receiving
    for (const itm of receiveModal.items) {
      const qty = parseFloat(itm.received_quantity || 0);
      if (qty > itm.remaining_quantity) {
        showSnackbar(
          `Cannot receive ${qty} units for ${itm.product_name}. Only ${itm.remaining_quantity} units remain.`,
          'error'
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        warehouse: receiveModal.warehouse,
        receipt_date: receiveModal.receiptDate,
        notes: receiveModal.notes,
        items: itemsToSubmit,
      };
      const res = await purchaseService.receiveOrder(activeCompany.id, receiveModal.order.id, payload);
      showSnackbar(`Goods Receipt Note ${res.receipt_number} created! Stock updated in inventory.`, 'success');
      setReceiveModal({ open: false, order: null, warehouse: '', receiptDate: '', notes: '', items: [] });
      fetchData();
    } catch (err) {
      console.error('Error receiving goods:', err);
      const detail = err.response?.data?.detail || 'Failed to receive goods.';
      showSnackbar(detail, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================
  // VENDOR HISTORY MODAL HANDLERS
  // ============================================================
  const handleOpenVendorHistory = async (vendorId, vendorName) => {
    if (!activeCompany?.id || !vendorId) return;
    setVendorHistoryModal({
      open: true,
      vendorId,
      vendorName: vendorName || 'Vendor Profile',
      loading: true,
      data: null,
      tab: 0,
    });
    try {
      const data = await purchaseService.getVendorHistory(activeCompany.id, vendorId);
      setVendorHistoryModal((prev) => ({ ...prev, data, loading: false }));
    } catch (err) {
      console.error('Error fetching vendor history:', err);
      showSnackbar('Failed to load vendor history.', 'error');
      setVendorHistoryModal((prev) => ({ ...prev, loading: false }));
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <PageHeader
        title="Purchase Management"
        subtitle="Manage supplier quotations, procurement orders, goods receiving (GRN), and vendor relationships."
        action={
          <Stack direction="row" spacing={1.5}>
            <Tooltip title="Refresh Data">
              <IconButton onClick={fetchData} color="primary">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
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
        <Tab icon={<LocalShippingOutlinedIcon />} iconPosition="start" label="Goods Receipts (GRN)" />
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
              {/* Metric Cards Row 1: Quotations & Orders */}
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
                    title="Total Procurement Value"
                    value={`$${parseFloat(dashboard.metrics?.total_purchase_value || 0).toFixed(2)}`}
                    subtitle={`Pending: $${parseFloat(dashboard.metrics?.pending_purchase_value || 0).toFixed(2)}`}
                    icon={MonetizationOnOutlinedIcon}
                    color="success"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <StatCard
                    title="Active Vendors"
                    value={dashboard.metrics?.active_vendors || 0}
                    subtitle="Registered suppliers in Inventory"
                    icon={StoreOutlinedIcon}
                    color="secondary"
                  />
                </Grid>
              </Grid>

              {/* Metric Cards Row 2: Goods Receiving & Stock IN (Phase 5B) */}
              <Grid container spacing={2.5}>
                <Grid item xs={12} sm={6} md={3}>
                  <StatCard
                    title="Goods Receipts (GRN)"
                    value={dashboard.metrics?.total_goods_receipts || 0}
                    subtitle="Total receiving notes posted"
                    icon={LocalShippingOutlinedIcon}
                    color="primary"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <StatCard
                    title="Total Units Received"
                    value={parseFloat(dashboard.metrics?.total_units_received || 0).toFixed(0)}
                    subtitle="Stock incremented into warehouses"
                    icon={Inventory2OutlinedIcon}
                    color="success"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <StatCard
                    title="Pending Receiving"
                    value={dashboard.metrics?.pending_receiving_orders || 0}
                    subtitle={`${dashboard.metrics?.partially_received_orders || 0} orders partially received`}
                    icon={PendingActionsOutlinedIcon}
                    color="warning"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <StatCard
                    title="Completed Fulfillment"
                    value={dashboard.metrics?.completed_receiving_orders || 0}
                    subtitle="Orders 100% received into stock"
                    icon={CheckCircleOutlineOutlinedIcon}
                    color="info"
                  />
                </Grid>
              </Grid>

              {/* Recent Tables Grid */}
              <Grid container spacing={3}>
                {/* Recent Orders */}
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent sx={{ pb: 1 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                        <Typography variant="h6" fontWeight={700}>
                          Recent Purchase Orders
                        </Typography>
                        <Button size="small" onClick={() => setCurrentTab(2)}>
                          View All
                        </Button>
                      </Stack>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: 'action.hover' }}>
                              <TableCell>Order #</TableCell>
                              <TableCell>Vendor</TableCell>
                              <TableCell align="right">Total</TableCell>
                              <TableCell align="center">Fulfillment</TableCell>
                              <TableCell align="center">Status</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(dashboard.recent_orders || []).length === 0 ? (
                              <TableRow><TableCell colSpan={5} align="center">No recent orders</TableCell></TableRow>
                            ) : (
                              dashboard.recent_orders.map((o) => (
                                <TableRow key={o.id} hover>
                                  <TableCell sx={{ fontWeight: 600 }}>{o.order_number}</TableCell>
                                  <TableCell>{o.vendor_name}</TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                                    ${parseFloat(o.total).toFixed(2)}
                                  </TableCell>
                                  <TableCell align="center" sx={{ width: 130 }}>
                                    <Stack spacing={0.5}>
                                      <Typography variant="caption" color="text.secondary">
                                        {parseFloat(o.receiving_percentage || 0).toFixed(0)}%
                                      </Typography>
                                      <LinearProgress
                                        variant="determinate"
                                        value={parseFloat(o.receiving_percentage || 0)}
                                        color={parseFloat(o.receiving_percentage || 0) >= 100 ? 'success' : 'primary'}
                                        sx={{ height: 6, borderRadius: 3 }}
                                      />
                                    </Stack>
                                  </TableCell>
                                  <TableCell align="center">
                                    <Chip label={o.status} size="small" color={ORDER_STATUS_COLORS[o.status] || 'default'} />
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

                {/* Recent Goods Receipts */}
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent sx={{ pb: 1 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                        <Typography variant="h6" fontWeight={700}>
                          Recent Goods Receipts (GRN)
                        </Typography>
                        <Button size="small" onClick={() => setCurrentTab(3)}>
                          View All
                        </Button>
                      </Stack>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: 'action.hover' }}>
                              <TableCell>GRN #</TableCell>
                              <TableCell>PO #</TableCell>
                              <TableCell>Warehouse</TableCell>
                              <TableCell align="right">Units</TableCell>
                              <TableCell align="center">Date</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(dashboard.recent_receipts || []).length === 0 ? (
                              <TableRow><TableCell colSpan={5} align="center">No recent goods receipts</TableCell></TableRow>
                            ) : (
                              dashboard.recent_receipts.map((r) => (
                                <TableRow key={r.id} hover>
                                  <TableCell sx={{ fontWeight: 600 }}>
                                    <Chip label={r.receipt_number} size="small" variant="outlined" color="primary" />
                                  </TableCell>
                                  <TableCell>{r.purchase_order_number}</TableCell>
                                  <TableCell>{r.warehouse_name}</TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 600, color: 'success.main' }}>
                                    {parseFloat(r.total_quantity).toFixed(0)}
                                  </TableCell>
                                  <TableCell align="center">{r.receipt_date}</TableCell>
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
                  placeholder="Search quote #, vendor, or notes..."
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
              description="Create a purchase quotation to request pricing from vendors."
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
                    <TableCell align="right">Total</TableCell>
                    <TableCell align="center">Fulfillment Progress</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {orders.map((o) => {
                    const pct = parseFloat(o.receiving_percentage || 0);
                    const canReceive = ['CONFIRMED', 'PROCESSING', 'PARTIALLY_RECEIVED'].includes(o.status);
                    return (
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
                        <TableCell align="right" sx={{ fontWeight: 700, color: 'info.main' }}>
                          ${parseFloat(o.total).toFixed(2)}
                        </TableCell>
                        <TableCell align="center" sx={{ minWidth: 160 }}>
                          <Stack spacing={0.5}>
                            <Stack direction="row" justifyContent="space-between">
                              <Typography variant="caption" color="text.secondary">
                                {parseFloat(o.total_received_quantity || 0).toFixed(0)} / {parseFloat(o.total_ordered_quantity || 0).toFixed(0)} units
                              </Typography>
                              <Typography variant="caption" fontWeight={700} color={pct >= 100 ? 'success.main' : 'primary.main'}>
                                {pct.toFixed(0)}%
                              </Typography>
                            </Stack>
                            <LinearProgress
                              variant="determinate"
                              value={pct}
                              color={pct >= 100 ? 'success' : 'primary'}
                              sx={{ height: 6, borderRadius: 3 }}
                            />
                          </Stack>
                        </TableCell>
                        <TableCell align="center">
                          <Chip label={o.status} size="small" color={ORDER_STATUS_COLORS[o.status] || 'default'} />
                        </TableCell>
                        <TableCell align="right">
                          {/* Receive Goods Button */}
                          {canReceive && (
                            <Tooltip title="Receive Goods (Stock IN)">
                              <IconButton
                                size="small"
                                color="success"
                                onClick={() => handleOpenReceiveModal(o)}
                              >
                                <LocalShippingOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}

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
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Stack>
      )}

      {/* ============================================================ */}
      {/* TAB 3: GOODS RECEIPTS (GRN) (Phase 5B) */}
      {/* ============================================================ */}
      {currentTab === 3 && (
        <Stack spacing={2.5}>
          {/* Filters Bar */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search GRN #, order #, vendor, notes..."
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
                  <InputLabel>Warehouse</InputLabel>
                  <Select
                    value={receiptWarehouseFilter}
                    label="Warehouse"
                    onChange={(e) => setReceiptWarehouseFilter(e.target.value)}
                  >
                    <MenuItem value="ALL">All Warehouses</MenuItem>
                    {warehouses.map((w) => (
                      <MenuItem key={w.id} value={w.id}>{w.name} ({w.code})</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Paper>

          {/* Receipts Table */}
          {loading ? (
            <LoadingState message="Loading goods receipts..." />
          ) : receipts.length === 0 ? (
            <EmptyState
              title="No Goods Receipts Found"
              description="Receive goods against confirmed purchase orders to generate Goods Received Notes (GRN) and update stock."
              action={
                <Button variant="contained" startIcon={<ReceiptLongOutlinedIcon />} onClick={() => setCurrentTab(2)}>
                  Go to Purchase Orders
                </Button>
              }
            />
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell>Receipt # (GRN)</TableCell>
                    <TableCell>Purchase Order</TableCell>
                    <TableCell>Vendor</TableCell>
                    <TableCell>Warehouse</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell align="center">Items</TableCell>
                    <TableCell align="right">Qty Received</TableCell>
                    <TableCell>Received By</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {receipts.map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell sx={{ fontWeight: 700 }}>
                        <Chip label={r.receipt_number} size="small" variant="outlined" color="primary" />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>
                        {r.purchase_order_number}
                      </TableCell>
                      <TableCell>
                        <Tooltip title="View Vendor History">
                          <Typography
                            variant="body2"
                            fontWeight={600}
                            sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline', color: 'primary.main' } }}
                            onClick={() => handleOpenVendorHistory(r.vendor_id, r.vendor_name)}
                          >
                            {r.vendor_name}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Chip icon={<WarehouseOutlinedIcon />} label={r.warehouse_name} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>{r.receipt_date}</TableCell>
                      <TableCell align="center">{r.items_count}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>
                        {parseFloat(r.total_quantity).toFixed(2)}
                      </TableCell>
                      <TableCell>{r.received_by_name || 'System Admin'}</TableCell>
                      <TableCell align="center">
                        <Chip label={r.status} size="small" color={RECEIPT_STATUS_COLORS[r.status] || 'default'} />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="View GRN Details">
                          <IconButton size="small" onClick={() => setViewDetailModal({ open: true, type: 'receipt', data: r })}>
                            <VisibilityOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
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
      {/* TAB 4: VENDORS & PURCHASE HISTORY */}
      {/* ============================================================ */}
      {currentTab === 4 && (
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
                  label="Quotation Date"
                  type="date"
                  value={quoteForm.quotation_date}
                  onChange={(e) => setQuoteForm((prev) => ({ ...prev, quotation_date: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="Valid Until"
                  type="date"
                  value={quoteForm.valid_until}
                  onChange={(e) => setQuoteForm((prev) => ({ ...prev, valid_until: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Quotation Notes / Terms"
                  multiline
                  rows={2}
                  value={quoteForm.notes}
                  onChange={(e) => setQuoteForm((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </Grid>
            </Grid>

            {/* Line Items */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography variant="subtitle2" fontWeight={700}>Line Items</Typography>
              <Button size="small" startIcon={<AddIcon />} onClick={handleAddQuoteItem}>
                Add Item
              </Button>
            </Stack>

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell sx={{ minWidth: 220 }}>Product</TableCell>
                    <TableCell sx={{ width: 110 }}>Qty</TableCell>
                    <TableCell sx={{ width: 130 }}>Unit Price ($)</TableCell>
                    <TableCell sx={{ width: 110 }}>Discount ($)</TableCell>
                    <TableCell sx={{ width: 110 }}>Tax ($)</TableCell>
                    <TableCell align="right" sx={{ width: 120 }}>Total</TableCell>
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
                          <FormControl fullWidth size="small" required>
                            <Select
                              value={item.product}
                              onChange={(e) => handleQuoteItemChange(idx, 'product', e.target.value)}
                            >
                              {products.map((prod) => (
                                <MenuItem key={prod.id} value={prod.id}>
                                  {prod.name} [{prod.sku}]
                                </MenuItem>
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
                            required
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            type="number"
                            inputProps={{ min: 0, step: 'any' }}
                            value={item.unit_price}
                            onChange={(e) => handleQuoteItemChange(idx, 'unit_price', e.target.value)}
                            required
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
          <DialogTitle>Create Purchase Order</DialogTitle>
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
                    <MenuItem value=""><em>Unassigned / Direct Receiving</em></MenuItem>
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
                  label="Order Date"
                  type="date"
                  value={orderForm.order_date}
                  onChange={(e) => setOrderForm((prev) => ({ ...prev, order_date: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={2}>
                <TextField
                  fullWidth
                  size="small"
                  label="Expected Date"
                  type="date"
                  value={orderForm.expected_date}
                  onChange={(e) => setOrderForm((prev) => ({ ...prev, expected_date: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Purchase Order Notes / Instructions"
                  multiline
                  rows={2}
                  value={orderForm.notes}
                  onChange={(e) => setOrderForm((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </Grid>
            </Grid>

            {/* Line Items */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography variant="subtitle2" fontWeight={700}>Order Items</Typography>
              <Button size="small" startIcon={<AddIcon />} onClick={handleAddOrderItem}>
                Add Item
              </Button>
            </Stack>

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell sx={{ minWidth: 220 }}>Product</TableCell>
                    <TableCell sx={{ width: 110 }}>Qty</TableCell>
                    <TableCell sx={{ width: 130 }}>Unit Price ($)</TableCell>
                    <TableCell sx={{ width: 110 }}>Discount ($)</TableCell>
                    <TableCell sx={{ width: 110 }}>Tax ($)</TableCell>
                    <TableCell align="right" sx={{ width: 120 }}>Total</TableCell>
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
                          <FormControl fullWidth size="small" required>
                            <Select
                              value={item.product}
                              onChange={(e) => handleOrderItemChange(idx, 'product', e.target.value)}
                            >
                              {products.map((prod) => (
                                <MenuItem key={prod.id} value={prod.id}>
                                  {prod.name} [{prod.sku}]
                                </MenuItem>
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
                            required
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            type="number"
                            inputProps={{ min: 0, step: 'any' }}
                            value={item.unit_price}
                            onChange={(e) => handleOrderItemChange(idx, 'unit_price', e.target.value)}
                            required
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
      {/* RECEIVE GOODS DIALOG (Phase 5B) */}
      {/* ============================================================ */}
      <Dialog
        open={receiveModal.open}
        onClose={() => setReceiveModal({ open: false, order: null, warehouse: '', receiptDate: '', notes: '', items: [] })}
        maxWidth="md"
        fullWidth
      >
        <form onSubmit={handleSubmitReceive}>
          <DialogTitle sx={{ pb: 1 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="h6" fontWeight={700}>
                  Receive Goods — {receiveModal.order?.order_number}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Post incoming shipment into warehouse stock and generate Goods Received Note (GRN)
                </Typography>
              </Box>
              <Chip label={receiveModal.order?.status} size="small" color={ORDER_STATUS_COLORS[receiveModal.order?.status] || 'default'} />
            </Stack>
          </DialogTitle>
          <DialogContent dividers sx={{ p: 3 }}>
            {/* Header info */}
            <Grid container spacing={2} sx={{ mb: 2.5 }}>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary">Vendor</Typography>
                <Typography variant="body1" fontWeight={600}>{receiveModal.order?.vendor_name}</Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth size="small" required>
                  <InputLabel>Receiving Warehouse</InputLabel>
                  <Select
                    value={receiveModal.warehouse}
                    label="Receiving Warehouse"
                    onChange={(e) => setReceiveModal((prev) => ({ ...prev, warehouse: e.target.value }))}
                  >
                    {warehouses.map((w) => (
                      <MenuItem key={w.id} value={w.id}>{w.name} ({w.code})</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Receipt Date"
                  type="date"
                  value={receiveModal.receiptDate}
                  onChange={(e) => setReceiveModal((prev) => ({ ...prev, receiptDate: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Goods Receipt Notes / Delivery Reference"
                  multiline
                  rows={2}
                  placeholder="e.g. Delivery Challan #, Pallet Count, Carrier Name..."
                  value={receiveModal.notes}
                  onChange={(e) => setReceiveModal((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </Grid>
            </Grid>

            {/* Actions for prefilling */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography variant="subtitle2" fontWeight={700}>
                Items to Receive
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button size="small" variant="outlined" onClick={handleReceiveAllRemaining}>
                  Receive All Remaining
                </Button>
                <Button size="small" variant="text" color="inherit" onClick={handleClearReceiveQuantities}>
                  Clear
                </Button>
              </Stack>
            </Stack>

            {/* Line items table */}
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell>Product</TableCell>
                    <TableCell align="right" sx={{ width: 100 }}>Ordered</TableCell>
                    <TableCell align="right" sx={{ width: 100 }}>Prev Recv</TableCell>
                    <TableCell align="right" sx={{ width: 110 }}>Remaining</TableCell>
                    <TableCell sx={{ width: 140 }}>Receive Now</TableCell>
                    <TableCell sx={{ width: 180 }}>Line Notes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {receiveModal.items.map((itm, idx) => (
                    <TableRow key={itm.purchase_order_item} hover>
                      <TableCell sx={{ fontWeight: 600 }}>
                        {itm.product_name}
                        <Typography variant="caption" display="block" color="text.secondary">
                          SKU: {itm.product_sku}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{itm.ordered_quantity.toFixed(2)}</TableCell>
                      <TableCell align="right">{itm.previously_received_quantity.toFixed(2)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: itm.remaining_quantity > 0 ? 'warning.main' : 'success.main' }}>
                        {itm.remaining_quantity.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          type="number"
                          inputProps={{
                            min: 0,
                            max: itm.remaining_quantity,
                            step: 'any',
                          }}
                          value={itm.received_quantity}
                          onChange={(e) => handleReceiveItemQtyChange(idx, e.target.value)}
                          disabled={itm.remaining_quantity <= 0}
                          error={parseFloat(itm.received_quantity || 0) > itm.remaining_quantity}
                          helperText={
                            parseFloat(itm.received_quantity || 0) > itm.remaining_quantity
                              ? `Max ${itm.remaining_quantity}`
                              : ''
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          placeholder="Condition / Batch..."
                          value={itm.notes}
                          onChange={(e) => handleReceiveItemNotesChange(idx, e.target.value)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button
              onClick={() => setReceiveModal({ open: false, order: null, warehouse: '', receiptDate: '', notes: '', items: [] })}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="success"
              type="submit"
              startIcon={<LocalShippingOutlinedIcon />}
              disabled={submitting}
            >
              {submitting ? <CircularProgress size={22} color="inherit" /> : 'Confirm & Post Stock IN'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ============================================================ */}
      {/* DETAIL MODAL (Quotes, Orders, and GRN Receipts) */}
      {/* ============================================================ */}
      <Dialog open={viewDetailModal.open} onClose={() => setViewDetailModal({ open: false, type: '', data: null })} maxWidth="md" fullWidth>
        <DialogTitle>
          {viewDetailModal.type === 'quote' && `Purchase Quotation: ${viewDetailModal.data?.quotation_number}`}
          {viewDetailModal.type === 'order' && `Purchase Order: ${viewDetailModal.data?.order_number}`}
          {viewDetailModal.type === 'receipt' && `Goods Receipt Note: ${viewDetailModal.data?.receipt_number}`}
        </DialogTitle>
        <DialogContent dividers sx={{ p: 3 }}>
          {viewDetailModal.data && viewDetailModal.type === 'receipt' ? (
            /* GRN RECEIPT DETAIL */
            <Box>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Receipt Number</Typography>
                  <Typography variant="body1" fontWeight={700} color="primary.main">{viewDetailModal.data.receipt_number}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Purchase Order</Typography>
                  <Typography variant="body1" fontWeight={600}>{viewDetailModal.data.purchase_order_number}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Vendor</Typography>
                  <Typography variant="body1" fontWeight={600}>{viewDetailModal.data.vendor_name}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Warehouse</Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <Chip icon={<WarehouseOutlinedIcon />} label={viewDetailModal.data.warehouse_name} size="small" variant="outlined" />
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Receipt Date</Typography>
                  <Typography variant="body2">{viewDetailModal.data.receipt_date}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Received By</Typography>
                  <Typography variant="body2">{viewDetailModal.data.received_by_name || 'System Admin'}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Status</Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <Chip label={viewDetailModal.data.status} size="small" color={RECEIPT_STATUS_COLORS[viewDetailModal.data.status] || 'default'} />
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Total Quantity Received</Typography>
                  <Typography variant="body1" fontWeight={700} color="success.main">
                    {parseFloat(viewDetailModal.data.total_quantity).toFixed(2)} units
                  </Typography>
                </Grid>
              </Grid>

              {viewDetailModal.data.notes && (
                <Alert severity="info" sx={{ mb: 2.5 }}>
                  {viewDetailModal.data.notes}
                </Alert>
              )}

              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Received Items</Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                      <TableCell>Product</TableCell>
                      <TableCell align="right">Ordered Qty</TableCell>
                      <TableCell align="right">Previously Received</TableCell>
                      <TableCell align="right">Quantity Received</TableCell>
                      <TableCell>Notes</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(viewDetailModal.data.items || []).map((itm) => (
                      <TableRow key={itm.id} hover>
                        <TableCell sx={{ fontWeight: 600 }}>{itm.product_name} [{itm.product_sku}]</TableCell>
                        <TableCell align="right">{parseFloat(itm.ordered_quantity).toFixed(2)}</TableCell>
                        <TableCell align="right">{parseFloat(itm.previously_received_quantity).toFixed(2)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>
                          +{parseFloat(itm.received_quantity).toFixed(2)}
                        </TableCell>
                        <TableCell>{itm.notes || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          ) : viewDetailModal.data ? (
            /* QUOTATION OR PURCHASE ORDER DETAIL */
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

              {/* Order Receiving Progress Bar */}
              {viewDetailModal.type === 'order' && (
                <Card variant="outlined" sx={{ p: 2, mb: 2.5, bgcolor: 'background.default' }}>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={8}>
                      <Typography variant="caption" color="text.secondary">Goods Receiving Progress</Typography>
                      <LinearProgress
                        variant="determinate"
                        value={parseFloat(viewDetailModal.data.receiving_percentage || 0)}
                        color={parseFloat(viewDetailModal.data.receiving_percentage || 0) >= 100 ? 'success' : 'primary'}
                        sx={{ height: 8, borderRadius: 4, my: 1 }}
                      />
                      <Typography variant="caption" fontWeight={600}>
                        Received {parseFloat(viewDetailModal.data.total_received_quantity || 0).toFixed(0)} of {parseFloat(viewDetailModal.data.total_ordered_quantity || 0).toFixed(0)} units ({parseFloat(viewDetailModal.data.receiving_percentage || 0).toFixed(0)}%)
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={4} sx={{ textAlign: { sm: 'right' } }}>
                      {['CONFIRMED', 'PROCESSING', 'PARTIALLY_RECEIVED'].includes(viewDetailModal.data.status) && (
                        <Button
                          variant="contained"
                          color="success"
                          size="small"
                          startIcon={<LocalShippingOutlinedIcon />}
                          onClick={() => {
                            const order = viewDetailModal.data;
                            setViewDetailModal({ open: false, type: '', data: null });
                            handleOpenReceiveModal(order);
                          }}
                        >
                          Receive Goods
                        </Button>
                      )}
                    </Grid>
                  </Grid>
                </Card>
              )}

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
                      <TableCell align="right">Qty Ordered</TableCell>
                      {viewDetailModal.type === 'order' && <TableCell align="right">Qty Received</TableCell>}
                      {viewDetailModal.type === 'order' && <TableCell align="right">Remaining</TableCell>}
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
                        {viewDetailModal.type === 'order' && (
                          <TableCell align="right" sx={{ fontWeight: 600, color: 'success.main' }}>
                            {parseFloat(itm.received_quantity || 0).toFixed(2)}
                          </TableCell>
                        )}
                        {viewDetailModal.type === 'order' && (
                          <TableCell align="right" sx={{ fontWeight: 600, color: parseFloat(itm.remaining_quantity || 0) > 0 ? 'warning.main' : 'text.secondary' }}>
                            {parseFloat(itm.remaining_quantity !== undefined ? itm.remaining_quantity : itm.quantity).toFixed(2)}
                          </TableCell>
                        )}
                        <TableCell align="right">${parseFloat(itm.unit_price).toFixed(2)}</TableCell>
                        <TableCell align="right">${parseFloat(itm.discount).toFixed(2)}</TableCell>
                        <TableCell align="right">${parseFloat(itm.tax).toFixed(2)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>${parseFloat(itm.line_total).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Related GRN Receipts Section for Orders */}
              {viewDetailModal.type === 'order' && (viewDetailModal.data.receipts || []).length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                    Linked Goods Received Notes (GRN)
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: 'action.hover' }}>
                          <TableCell>Receipt #</TableCell>
                          <TableCell>Date</TableCell>
                          <TableCell>Warehouse</TableCell>
                          <TableCell align="right">Qty Received</TableCell>
                          <TableCell align="center">Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {viewDetailModal.data.receipts.map((rcpt) => (
                          <TableRow key={rcpt.id} hover>
                            <TableCell sx={{ fontWeight: 600 }}>
                              <Chip label={rcpt.receipt_number} size="small" variant="outlined" color="primary" />
                            </TableCell>
                            <TableCell>{rcpt.receipt_date}</TableCell>
                            <TableCell>{rcpt.warehouse_name}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600, color: 'success.main' }}>
                              +{parseFloat(rcpt.total_quantity).toFixed(2)}
                            </TableCell>
                            <TableCell align="center">
                              <Chip label={rcpt.status} size="small" color={RECEIPT_STATUS_COLORS[rcpt.status] || 'default'} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {/* Totals Summary */}
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
          ) : null}
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
