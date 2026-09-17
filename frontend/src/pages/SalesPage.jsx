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
import PointOfSaleOutlinedIcon from '@mui/icons-material/PointOfSaleOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import MonetizationOnOutlinedIcon from '@mui/icons-material/MonetizationOnOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import TransformOutlinedIcon from '@mui/icons-material/TransformOutlined';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import BookmarkBorderOutlinedIcon from '@mui/icons-material/BookmarkBorderOutlined';
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import ReceiptIcon from '@mui/icons-material/Receipt';
import PaymentIcon from '@mui/icons-material/Payment';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import AssignmentReturnOutlinedIcon from '@mui/icons-material/AssignmentReturnOutlined';

import PageHeader from '../components/common/PageHeader';
import EmptyState from '../components/common/EmptyState';
import LoadingState from '../components/common/LoadingState';
import StatCard from '../components/common/StatCard';
import salesService from '../services/salesService';
import crmService from '../services/crmService';
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
  RESERVED: 'secondary',
  PROCESSING: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'error',
};

const RESERVATION_STATUS_COLORS = {
  NONE: 'default',
  ACTIVE: 'secondary',
  RELEASED: 'default',
  FULFILLED: 'success',
  CANCELLED: 'error',
  PARTIAL: 'warning',
};

const INVOICE_STATUS_COLORS = {
  DRAFT: 'default',
  ISSUED: 'info',
  PARTIALLY_PAID: 'warning',
  PAID: 'success',
  OVERDUE: 'error',
  CANCELLED: 'default',
};

export default function SalesPage() {
  const { activeCompany } = useCompany();

  // Tab: 0=Dashboard, 1=Quotations, 2=Sales Orders, 3=Invoices, 4=Payments & Receipts
  const [currentTab, setCurrentTab] = useState(0);

  // Data states
  const [dashboard, setDashboard] = useState(null);
  const [financialSummary, setFinancialSummary] = useState(null);
  const [quotations, setQuotations] = useState([]);
  const [orders, setOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [quoteStatusFilter, setQuoteStatusFilter] = useState('ALL');
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('ALL');

  // Loading & Feedback
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Dialogs
  const [openQuoteModal, setOpenQuoteModal] = useState(false);
  const [openOrderModal, setOpenOrderModal] = useState(false);
  const [openInvoiceModal, setOpenInvoiceModal] = useState(false);
  const [viewDetailModal, setViewDetailModal] = useState({ open: false, type: '', data: null });
  const [convertDialog, setConvertDialog] = useState({ open: false, quotation: null });
  const [reserveDialog, setReserveDialog] = useState({ open: false, order: null, warehouse: '' });
  const [releaseDialog, setReleaseDialog] = useState({ open: false, order: null });
  const [fulfillDialog, setFulfillDialog] = useState({ open: false, order: null });
  const [invoiceOrderDialog, setInvoiceOrderDialog] = useState({ open: false, order: null, due_date: '', notes: '' });
  const [paymentDialog, setPaymentDialog] = useState({ open: false, invoice: null, amount: '', payment_method: 'BANK_TRANSFER', reference: '', notes: '' });
  const [receiptModal, setReceiptModal] = useState({ open: false, receipt: null });

  // Phase 4D: Reports & Analytics States
  const [reportType, setReportType] = useState('summary');
  const [reportData, setReportData] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [reportDateFrom, setReportDateFrom] = useState('');
  const [reportDateTo, setReportDateTo] = useState('');
  const [reportCustomer, setReportCustomer] = useState('');
  const [reportProduct, setReportProduct] = useState('');
  const [reportWarehouse, setReportWarehouse] = useState('');

  // Phase 4D: Customer Sales History Modal
  const [customerHistoryModal, setCustomerHistoryModal] = useState({
    open: false,
    customerId: null,
    customerName: '',
    loading: false,
    data: null,
    tab: 0,
  });

  // Phase 4D: Sales Return Modal
  const [returnModal, setReturnModal] = useState({
    open: false,
    order: null,
    reason: 'Customer return',
    items: [],
  });

  // Form State for Quotation
  const [quoteForm, setQuoteForm] = useState({
    customer: '',
    valid_until: '',
    notes: '',
    items: [
      { product: '', description: '', quantity: '1.00', unit_price: '0.00', discount: '0.00', tax: '0.00' },
    ],
  });

  // Form State for Order
  const [orderForm, setOrderForm] = useState({
    customer: '',
    warehouse: '',
    status: 'CONFIRMED',
    notes: '',
    items: [
      { product: '', description: '', quantity: '1.00', unit_price: '0.00', discount: '0.00', tax: '0.00' },
    ],
  });

  // Form State for Direct Invoice
  const [invoiceForm, setInvoiceForm] = useState({
    customer: '',
    due_date: '',
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

  // Fetch Lookups (Customers, Products, Warehouses)
  const fetchLookups = useCallback(async () => {
    if (!activeCompany?.id) return;
    try {
      const [custs, prods, whs] = await Promise.all([
        crmService.getCustomers(activeCompany.id),
        inventoryService.getProducts(activeCompany.id),
        inventoryService.getWarehouses(activeCompany.id),
      ]);
      setCustomers(Array.isArray(custs) ? custs : []);
      setProducts(Array.isArray(prods) ? prods : []);
      setWarehouses(Array.isArray(whs) ? whs : []);
    } catch (err) {
      console.error('Error fetching lookups:', err);
    }
  }, [activeCompany?.id]);

  // Fetch Main Data
  const fetchData = useCallback(async () => {
    if (!activeCompany?.id) return;
    setLoading(true);
    try {
      if (currentTab === 0) {
        const [dashData, finSummary] = await Promise.all([
          salesService.getDashboard(activeCompany.id),
          salesService.getFinancialSummary(activeCompany.id),
        ]);
        setDashboard(dashData);
        setFinancialSummary(finSummary);
      } else if (currentTab === 1) {
        const params = {};
        if (quoteStatusFilter !== 'ALL') params.status = quoteStatusFilter;
        if (searchQuery.trim()) params.search = searchQuery.trim();
        const data = await salesService.getQuotations(activeCompany.id, params);
        setQuotations(Array.isArray(data) ? data : []);
      } else if (currentTab === 2) {
        const params = {};
        if (orderStatusFilter !== 'ALL') params.status = orderStatusFilter;
        if (searchQuery.trim()) params.search = searchQuery.trim();
        const data = await salesService.getOrders(activeCompany.id, params);
        setOrders(Array.isArray(data) ? data : []);
      } else if (currentTab === 3) {
        const params = {};
        if (invoiceStatusFilter !== 'ALL') params.status = invoiceStatusFilter;
        if (searchQuery.trim()) params.search = searchQuery.trim();
        const data = await salesService.getInvoices(activeCompany.id, params);
        setInvoices(Array.isArray(data) ? data : []);
      } else if (currentTab === 4) {
        const params = {};
        if (searchQuery.trim()) params.search = searchQuery.trim();
        const [recData, invData] = await Promise.all([
          salesService.getReceipts(activeCompany.id, params),
          salesService.getInvoices(activeCompany.id),
        ]);
        setReceipts(Array.isArray(recData) ? recData : []);
        setInvoices(Array.isArray(invData) ? invData : []);
      } else if (currentTab === 5) {
        const reportParams = { report_type: reportType };
        if (reportDateFrom) reportParams.date_from = reportDateFrom;
        if (reportDateTo) reportParams.date_to = reportDateTo;
        if (reportCustomer) reportParams.customer = reportCustomer;
        if (reportProduct) reportParams.product = reportProduct;
        if (reportWarehouse) reportParams.warehouse = reportWarehouse;

        const [rep, anl] = await Promise.all([
          salesService.getReports(activeCompany.id, reportParams),
          salesService.getAnalytics(activeCompany.id),
        ]);
        setReportData(rep);
        setAnalyticsData(anl);
      }
    } catch (err) {
      console.error('Error fetching sales data:', err);
      showSnackbar('Failed to load sales data.', 'error');
    } finally {
      setLoading(false);
    }
  }, [
    activeCompany?.id,
    currentTab,
    quoteStatusFilter,
    orderStatusFilter,
    invoiceStatusFilter,
    searchQuery,
    reportType,
    reportDateFrom,
    reportDateTo,
    reportCustomer,
    reportProduct,
    reportWarehouse,
  ]);

  const handleOpenCustomerHistory = async (customerId, customerName) => {
    if (!customerId || !activeCompany?.id) return;
    setCustomerHistoryModal({
      open: true,
      customerId,
      customerName: customerName || 'Customer',
      loading: true,
      data: null,
      tab: 0,
    });
    try {
      const data = await salesService.getCustomerSalesHistory(activeCompany.id, customerId);
      setCustomerHistoryModal((prev) => ({
        ...prev,
        loading: false,
        data,
      }));
    } catch (err) {
      console.error('Error loading customer sales history:', err);
      showSnackbar('Failed to load customer sales history.', 'error');
      setCustomerHistoryModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleOpenReturnModal = (order) => {
    setReturnModal({
      open: true,
      order,
      reason: 'Customer return',
      items: (order.items || []).map((itm) => ({
        sales_order_item: itm.id,
        product: itm.product,
        product_name: itm.product_name,
        quantity: itm.quantity,
        max_quantity: itm.quantity,
        unit_price: itm.unit_price,
      })),
    });
  };

  const handleProcessReturn = async () => {
    if (!activeCompany?.id || !returnModal.order) return;
    setSubmitting(true);
    try {
      const payload = {
        reason: returnModal.reason,
        items: returnModal.items.map((i) => ({
          sales_order_item: i.sales_order_item,
          product: i.product,
          quantity: i.quantity,
        })),
      };
      await salesService.createOrderReturn(activeCompany.id, returnModal.order.id, payload);
      showSnackbar('Sales return processed successfully! Inventory restored.', 'success');
      setReturnModal({ open: false, order: null, reason: '', items: [] });
      fetchData();
    } catch (err) {
      console.error('Error processing sales return:', err);
      const msg = err.response?.data?.detail || 'Failed to process sales return.';
      showSnackbar(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    fetchLookups();
  }, [fetchLookups]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
    setSearchQuery('');
  };

  // Line calculations helper
  const calculateTotals = (items) => {
    let subtotal = 0;
    let discount = 0;
    let tax = 0;
    let total = 0;

    items.forEach((item) => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unit_price) || 0;
      const disc = parseFloat(item.discount) || 0;
      const tx = parseFloat(item.tax) || 0;

      const lineSub = qty * price;
      const lineTotal = Math.max(0, lineSub - disc + tx);

      subtotal += lineSub;
      discount += disc;
      tax += tx;
      total += lineTotal;
    });

    return {
      subtotal: subtotal.toFixed(2),
      discount: discount.toFixed(2),
      tax: tax.toFixed(2),
      total: total.toFixed(2),
    };
  };

  // Quotation Item handlers
  const handleQuoteItemChange = (index, field, value) => {
    const updated = [...quoteForm.items];
    updated[index][field] = value;

    if (field === 'product') {
      const selectedProd = products.find((p) => p.id === value);
      if (selectedProd) {
        updated[index].unit_price = selectedProd.selling_price || '0.00';
        updated[index].description = selectedProd.name;
      }
    }
    setQuoteForm({ ...quoteForm, items: updated });
  };

  const addQuoteItem = () => {
    setQuoteForm({
      ...quoteForm,
      items: [
        ...quoteForm.items,
        { product: '', description: '', quantity: '1.00', unit_price: '0.00', discount: '0.00', tax: '0.00' },
      ],
    });
  };

  const removeQuoteItem = (index) => {
    if (quoteForm.items.length <= 1) return;
    const updated = quoteForm.items.filter((_, i) => i !== index);
    setQuoteForm({ ...quoteForm, items: updated });
  };

  // Create Quotation
  const handleCreateQuotation = async () => {
    if (!quoteForm.customer) {
      showSnackbar('Please select a customer.', 'error');
      return;
    }
    if (quoteForm.items.some((i) => !i.product || parseFloat(i.quantity) <= 0)) {
      showSnackbar('Please ensure all items have a selected product and quantity > 0.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await salesService.createQuotation(activeCompany.id, quoteForm);
      showSnackbar('Quotation created successfully!');
      setOpenQuoteModal(false);
      setQuoteForm({
        customer: '',
        valid_until: '',
        notes: '',
        items: [{ product: '', description: '', quantity: '1.00', unit_price: '0.00', discount: '0.00', tax: '0.00' }],
      });
      fetchData();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data ? JSON.stringify(err.response.data) : 'Failed to create quotation';
      showSnackbar(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Convert Quotation
  const handleConvertQuotation = async () => {
    if (!convertDialog.quotation) return;
    setSubmitting(true);
    try {
      const newOrder = await salesService.convertQuotation(activeCompany.id, convertDialog.quotation.id);
      showSnackbar(`Quotation successfully converted to Order ${newOrder.order_number}!`);
      setConvertDialog({ open: false, quotation: null });
      fetchData();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.detail || 'Failed to convert quotation.';
      showSnackbar(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Quotation
  const handleDeleteQuotation = async (id) => {
    if (!window.confirm('Are you sure you want to delete this quotation?')) return;
    try {
      await salesService.deleteQuotation(activeCompany.id, id);
      showSnackbar('Quotation deleted.');
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to delete quotation.';
      showSnackbar(msg, 'error');
    }
  };

  // Order Item handlers
  const handleOrderItemChange = (index, field, value) => {
    const updated = [...orderForm.items];
    updated[index][field] = value;

    if (field === 'product') {
      const selectedProd = products.find((p) => p.id === value);
      if (selectedProd) {
        updated[index].unit_price = selectedProd.selling_price || '0.00';
        updated[index].description = selectedProd.name;
      }
    }
    setOrderForm({ ...orderForm, items: updated });
  };

  const addOrderItem = () => {
    setOrderForm({
      ...orderForm,
      items: [
        ...orderForm.items,
        { product: '', description: '', quantity: '1.00', unit_price: '0.00', discount: '0.00', tax: '0.00' },
      ],
    });
  };

  const removeOrderItem = (index) => {
    if (orderForm.items.length <= 1) return;
    const updated = orderForm.items.filter((_, i) => i !== index);
    setOrderForm({ ...orderForm, items: updated });
  };

  // Create Direct Order
  const handleCreateOrder = async () => {
    if (!orderForm.customer) {
      showSnackbar('Please select a customer.', 'error');
      return;
    }
    if (orderForm.items.some((i) => !i.product || parseFloat(i.quantity) <= 0)) {
      showSnackbar('Please ensure all items have a selected product and quantity > 0.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await salesService.createOrder(activeCompany.id, orderForm);
      showSnackbar('Sales Order created successfully!');
      setOpenOrderModal(false);
      setOrderForm({
        customer: '',
        warehouse: '',
        status: 'CONFIRMED',
        notes: '',
        items: [{ product: '', description: '', quantity: '1.00', unit_price: '0.00', discount: '0.00', tax: '0.00' }],
      });
      fetchData();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data ? JSON.stringify(err.response.data) : 'Failed to create sales order';
      showSnackbar(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Reserve Stock Action
  const handleOpenReserve = (order) => {
    setReserveDialog({
      open: true,
      order,
      warehouse: order.warehouse || (warehouses[0]?.id || ''),
    });
  };

  const handleConfirmReserve = async () => {
    if (!reserveDialog.order || !reserveDialog.warehouse) {
      showSnackbar('Please select a fulfillment warehouse.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await salesService.reserveOrder(activeCompany.id, reserveDialog.order.id, {
        warehouse: reserveDialog.warehouse,
      });
      showSnackbar(`Stock reserved successfully for Order ${reserveDialog.order.order_number}!`);
      setReserveDialog({ open: false, order: null, warehouse: '' });
      fetchData();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.detail || err.response?.data?.warehouse?.[0] || 'Failed to reserve stock.';
      showSnackbar(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Release Reservation Action
  const handleOpenRelease = (order) => {
    setReleaseDialog({ open: true, order });
  };

  const handleConfirmRelease = async () => {
    if (!releaseDialog.order) return;
    setSubmitting(true);
    try {
      await salesService.releaseReservation(activeCompany.id, releaseDialog.order.id);
      showSnackbar(`Stock reservation released for Order ${releaseDialog.order.order_number}!`);
      setReleaseDialog({ open: false, order: null });
      fetchData();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.detail || 'Failed to release reservation.';
      showSnackbar(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Fulfill Order Action
  const handleOpenFulfill = (order) => {
    setFulfillDialog({ open: true, order });
  };

  const handleConfirmFulfill = async () => {
    if (!fulfillDialog.order) return;
    setSubmitting(true);
    try {
      await salesService.fulfillOrder(activeCompany.id, fulfillDialog.order.id);
      showSnackbar(`Order ${fulfillDialog.order.order_number} fulfilled & completed! STOCK_OUT recorded.`);
      setFulfillDialog({ open: false, order: null });
      fetchData();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.detail || 'Failed to fulfill order.';
      showSnackbar(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Quick update order status
  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      await salesService.updateOrder(activeCompany.id, orderId, { status: newStatus });
      showSnackbar(`Order status updated to ${newStatus}`);
      fetchData();
    } catch (err) {
      showSnackbar('Failed to update status.', 'error');
    }
  };

  // Cancel Order
  const handleCancelOrder = async (order) => {
    if (!window.confirm(`Are you sure you want to cancel Order ${order.order_number}? Any active reservations will be automatically released.`)) {
      return;
    }
    try {
      await salesService.updateOrder(activeCompany.id, order.id, { status: 'CANCELLED' });
      showSnackbar(`Order ${order.order_number} cancelled and reservations released.`);
      fetchData();
    } catch (err) {
      showSnackbar('Failed to cancel order.', 'error');
    }
  };

  // Delete Order
  const handleDeleteOrder = async (id) => {
    if (!window.confirm('Are you sure you want to delete this sales order?')) return;
    try {
      await salesService.deleteOrder(activeCompany.id, id);
      showSnackbar('Sales order deleted.');
      fetchData();
    } catch (err) {
      showSnackbar('Failed to delete sales order.', 'error');
    }
  };

  // Invoice Item handlers
  const handleInvoiceItemChange = (index, field, value) => {
    const updated = [...invoiceForm.items];
    updated[index][field] = value;

    if (field === 'product') {
      const selectedProd = products.find((p) => p.id === value);
      if (selectedProd) {
        updated[index].unit_price = selectedProd.selling_price || '0.00';
        updated[index].description = selectedProd.name;
      }
    }
    setInvoiceForm({ ...invoiceForm, items: updated });
  };

  const addInvoiceItem = () => {
    setInvoiceForm({
      ...invoiceForm,
      items: [
        ...invoiceForm.items,
        { product: '', description: '', quantity: '1.00', unit_price: '0.00', discount: '0.00', tax: '0.00' },
      ],
    });
  };

  const removeInvoiceItem = (index) => {
    if (invoiceForm.items.length <= 1) return;
    const updated = invoiceForm.items.filter((_, i) => i !== index);
    setInvoiceForm({ ...invoiceForm, items: updated });
  };

  // Create Direct Invoice
  const handleCreateInvoice = async () => {
    if (!invoiceForm.customer) {
      showSnackbar('Please select a customer.', 'error');
      return;
    }
    if (invoiceForm.items.some((i) => !i.product || parseFloat(i.quantity) <= 0)) {
      showSnackbar('Please ensure all items have a selected product and quantity > 0.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const newInv = await salesService.createInvoice(activeCompany.id, invoiceForm);
      showSnackbar(`Invoice ${newInv.invoice_number} created successfully!`);
      setOpenInvoiceModal(false);
      setInvoiceForm({
        customer: '',
        due_date: '',
        notes: '',
        items: [{ product: '', description: '', quantity: '1.00', unit_price: '0.00', discount: '0.00', tax: '0.00' }],
      });
      fetchData();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data ? JSON.stringify(err.response.data) : 'Failed to create invoice';
      showSnackbar(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Generate Invoice from Order
  const handleOpenInvoiceOrder = (order) => {
    const today = new Date();
    today.setDate(today.getDate() + 30);
    const defaultDueDate = today.toISOString().split('T')[0];
    setInvoiceOrderDialog({
      open: true,
      order,
      due_date: defaultDueDate,
      notes: `Generated from Sales Order ${order.order_number}`,
    });
  };

  const handleConfirmInvoiceOrder = async () => {
    if (!invoiceOrderDialog.order) return;
    setSubmitting(true);
    try {
      const newInv = await salesService.createInvoiceFromOrder(
        activeCompany.id,
        invoiceOrderDialog.order.id,
        {
          due_date: invoiceOrderDialog.due_date || undefined,
          notes: invoiceOrderDialog.notes || undefined,
        }
      );
      showSnackbar(`Invoice ${newInv.invoice_number} generated from Order ${invoiceOrderDialog.order.order_number}!`);
      setInvoiceOrderDialog({ open: false, order: null, due_date: '', notes: '' });
      fetchData();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.detail || 'Failed to generate invoice from order.';
      showSnackbar(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Payment handlers
  const handleOpenPaymentDialog = (invoice) => {
    setPaymentDialog({
      open: true,
      invoice,
      amount: invoice.balance_due || invoice.total,
      payment_method: 'BANK_TRANSFER',
      reference: '',
      notes: '',
    });
  };

  const handleConfirmPayment = async () => {
    if (!paymentDialog.invoice) return;
    const payAmt = parseFloat(paymentDialog.amount);
    if (!payAmt || payAmt <= 0) {
      showSnackbar('Payment amount must be greater than zero.', 'error');
      return;
    }
    const bal = parseFloat(paymentDialog.invoice.balance_due);
    if (payAmt > bal) {
      showSnackbar(`Payment amount ($${payAmt.toFixed(2)}) cannot exceed balance due ($${bal.toFixed(2)}).`, 'error');
      return;
    }

    setSubmitting(true);
    try {
      const paymentRes = await salesService.createPayment(
        activeCompany.id,
        paymentDialog.invoice.id,
        {
          amount: paymentDialog.amount,
          payment_method: paymentDialog.payment_method,
          reference: paymentDialog.reference,
          notes: paymentDialog.notes,
        }
      );
      showSnackbar(`Payment of $${payAmt.toFixed(2)} recorded! Receipt ${paymentRes.receipt?.receipt_number || ''} generated.`);
      setPaymentDialog({ open: false, invoice: null, amount: '', payment_method: 'BANK_TRANSFER', reference: '', notes: '' });
      fetchData();
      if (paymentRes.receipt) {
        setReceiptModal({ open: true, receipt: paymentRes.receipt });
      }
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.detail || err.response?.data?.amount?.[0] || 'Failed to record payment.';
      showSnackbar(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Cancel Invoice
  const handleCancelInvoice = async (invoice) => {
    if (!window.confirm(`Are you sure you want to cancel Invoice ${invoice.invoice_number}?`)) return;
    try {
      await salesService.updateInvoice(activeCompany.id, invoice.id, { status: 'CANCELLED' });
      showSnackbar(`Invoice ${invoice.invoice_number} has been cancelled.`);
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to cancel invoice.';
      showSnackbar(msg, 'error');
    }
  };

  if (!activeCompany) {
    return (
      <Box p={3}>
        <EmptyState
          title="No Company Selected"
          description="Please select or create a company to manage sales quotations and orders."
        />
      </Box>
    );
  }

  const quoteTotals = calculateTotals(quoteForm.items);
  const orderTotals = calculateTotals(orderForm.items);
  const invoiceTotals = calculateTotals(invoiceForm.items);

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Page Header */}
      <PageHeader
        title="Sales & Stock Fulfillment"
        subtitle={`Manage Quotations, Orders, Reservations & Delivery for ${activeCompany.name}`}
        breadcrumbs={[
          { label: 'Dashboard', to: '/dashboard' },
          { label: 'Sales' },
        ]}
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
                onClick={() => setOpenQuoteModal(true)}
              >
                New Quotation
              </Button>
            )}
            {currentTab === 2 && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setOpenOrderModal(true)}
              >
                New Sales Order
              </Button>
            )}
            {currentTab === 3 && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setOpenInvoiceModal(true)}
              >
                New Invoice
              </Button>
            )}
          </Stack>
        }
      />

      {/* Navigation Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={currentTab}
          onChange={handleTabChange}
          textColor="primary"
          indicatorColor="primary"
        >
          <Tab icon={<PointOfSaleOutlinedIcon />} iconPosition="start" label="Sales Dashboard" />
          <Tab icon={<ReceiptLongOutlinedIcon />} iconPosition="start" label="Quotations" />
          <Tab icon={<ShoppingBagOutlinedIcon />} iconPosition="start" label="Sales Orders & Fulfillment" />
          <Tab icon={<DescriptionOutlinedIcon />} iconPosition="start" label="Invoices" />
          <Tab icon={<AccountBalanceWalletOutlinedIcon />} iconPosition="start" label="Payments & Receipts" />
          <Tab icon={<AssessmentOutlinedIcon />} iconPosition="start" label="Reports & Analytics" />
        </Tabs>
      </Box>

      {/* ============================================================ */}
      {/* TAB 0: SALES DASHBOARD */}
      {/* ============================================================ */}
      {currentTab === 0 && (
        <Box>
          {loading && !dashboard ? (
            <LoadingState message="Loading sales dashboard metrics..." />
          ) : dashboard ? (
            <Grid container spacing={3}>
              {/* Top KPI Cards */}
              <Grid item xs={12} sm={6} md={3}>
                <StatCard
                  title="Total Quotations"
                  value={dashboard.summary.total_quotations}
                  subtitle={`Valued at $${parseFloat(dashboard.summary.quotations_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                  icon={ReceiptLongOutlinedIcon}
                  color="#1976d2"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard
                  title="Total Sales Value"
                  value={`$${parseFloat(dashboard.summary.total_sales_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                  subtitle={`${dashboard.summary.total_orders} total orders recorded`}
                  icon={MonetizationOnOutlinedIcon}
                  color="#2e7d32"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard
                  title="Conversion Rate"
                  value={`${dashboard.summary.conversion_rate_percentage}%`}
                  subtitle={`${dashboard.summary.converted_quotations} of ${dashboard.summary.total_quotations} quotes converted`}
                  icon={TrendingUpOutlinedIcon}
                  color="#ed6c02"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard
                  title="Active Orders"
                  value={dashboard.summary.confirmed_orders + (dashboard.summary.reserved_orders || 0) + dashboard.summary.processing_orders}
                  subtitle={`${dashboard.summary.reserved_orders || 0} reserved, ${dashboard.summary.completed_orders} completed`}
                  icon={ShoppingBagOutlinedIcon}
                  color="#9c27b0"
                />
              </Grid>

              {/* Financial Invoicing & Collections KPI Cards */}
              {financialSummary && (
                <>
                  <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                      title="Total Invoiced"
                      value={`$${parseFloat(financialSummary.total_invoiced_amount || financialSummary.total_invoiced || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                      subtitle={`${financialSummary.total_invoices_count || financialSummary.invoices_count || 0} total invoices`}
                      icon={DescriptionOutlinedIcon}
                      color="#0288d1"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                      title="Total Collected"
                      value={`$${parseFloat(financialSummary.total_paid_amount || financialSummary.total_collected || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                      subtitle={`${financialSummary.paid_invoices_count || 0} invoices settled`}
                      icon={AccountBalanceWalletOutlinedIcon}
                      color="#2e7d32"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                      title="Outstanding Balance"
                      value={`$${parseFloat(financialSummary.total_outstanding_amount || financialSummary.total_outstanding || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                      subtitle={`${(financialSummary.issued_invoices_count || 0) + (financialSummary.partially_paid_invoices_count || 0)} awaiting payment`}
                      icon={CreditCardOutlinedIcon}
                      color="#ed6c02"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                      title="Overdue Invoices"
                      value={`${financialSummary.overdue_invoices_count || 0}`}
                      subtitle={`${financialSummary.overdue_invoices_count || 0} past due date`}
                      icon={ErrorOutlineOutlinedIcon}
                      color="#d32f2f"
                    />
                  </Grid>
                </>
              )}

              {/* Monthly Performance & Trends (Phase 4D) */}
              {dashboard.comparisons && (
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
                        Current Month vs. Previous Month Performance
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6} md={3}>
                          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
                            <Typography variant="caption" color="text.secondary">Sales Revenue</Typography>
                            <Typography variant="h6" fontWeight={700} color="primary.main">
                              ${parseFloat(dashboard.comparisons.current_month_sales || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Prev Month: ${parseFloat(dashboard.comparisons.previous_month_sales || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </Typography>
                          </Paper>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
                            <Typography variant="caption" color="text.secondary">Orders Placed</Typography>
                            <Typography variant="h6" fontWeight={700} color="info.main">
                              {dashboard.comparisons.current_month_orders_count || 0}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Prev Month: {dashboard.comparisons.previous_month_orders_count || 0} orders
                            </Typography>
                          </Paper>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
                            <Typography variant="caption" color="text.secondary">Invoiced Amount</Typography>
                            <Typography variant="h6" fontWeight={700} color="secondary.main">
                              ${parseFloat(dashboard.comparisons.current_month_invoiced || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Prev Month: ${parseFloat(dashboard.comparisons.previous_month_invoiced || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </Typography>
                          </Paper>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
                            <Typography variant="caption" color="text.secondary">Payments Collected</Typography>
                            <Typography variant="h6" fontWeight={700} color="success.main">
                              ${parseFloat(dashboard.comparisons.current_month_collected || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Prev Month: ${parseFloat(dashboard.comparisons.previous_month_collected || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </Typography>
                          </Paper>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              )}

              {/* Status Breakdown Bar */}
              <Grid item xs={12}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                      Sales & Inventory Pipeline Status
                    </Typography>
                    <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                      <Chip
                        label={`Pending Quotes: ${dashboard.summary.pending_quotations}`}
                        color="info"
                        variant="outlined"
                      />
                      <Chip
                        label={`Converted Quotes: ${dashboard.summary.converted_quotations}`}
                        color="success"
                        variant="outlined"
                      />
                      <Chip
                        label={`Confirmed Orders: ${dashboard.summary.confirmed_orders}`}
                        color="primary"
                        variant="outlined"
                      />
                      <Chip
                        label={`Reserved Orders: ${dashboard.summary.reserved_orders || 0}`}
                        color="secondary"
                        variant="outlined"
                      />
                      <Chip
                        label={`Processing Orders: ${dashboard.summary.processing_orders}`}
                        color="warning"
                        variant="outlined"
                      />
                      <Chip
                        label={`Completed Orders: ${dashboard.summary.completed_orders}`}
                        color="success"
                      />
                      <Chip
                        label={`Cancelled Orders: ${dashboard.summary.cancelled_orders}`}
                        color="error"
                        variant="outlined"
                      />
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              {/* Recent Quotations Table */}
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                      <Typography variant="h6" fontWeight={700}>
                        Recent Quotations
                      </Typography>
                      <Button size="small" onClick={() => setCurrentTab(1)} endIcon={<ArrowForwardOutlinedIcon />}>
                        View All
                      </Button>
                    </Stack>
                    {dashboard.recent_quotations?.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        No quotations recorded yet.
                      </Typography>
                    ) : (
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Quote #</TableCell>
                              <TableCell>Customer</TableCell>
                              <TableCell>Total</TableCell>
                              <TableCell>Status</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {dashboard.recent_quotations.map((q) => (
                              <TableRow key={q.id}>
                                <TableCell sx={{ fontWeight: 600 }}>{q.quotation_number}</TableCell>
                                <TableCell>{q.customer_name}</TableCell>
                                <TableCell>${parseFloat(q.total).toFixed(2)}</TableCell>
                                <TableCell>
                                  <Chip
                                    label={q.status}
                                    size="small"
                                    color={QUOTATION_STATUS_COLORS[q.status] || 'default'}
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Recent Orders Table */}
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                      <Typography variant="h6" fontWeight={700}>
                        Recent Sales Orders
                      </Typography>
                      <Button size="small" onClick={() => setCurrentTab(2)} endIcon={<ArrowForwardOutlinedIcon />}>
                        View All
                      </Button>
                    </Stack>
                    {dashboard.recent_orders?.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        No sales orders recorded yet.
                      </Typography>
                    ) : (
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Order #</TableCell>
                              <TableCell>Customer</TableCell>
                              <TableCell>Warehouse</TableCell>
                              <TableCell>Total</TableCell>
                              <TableCell>Status</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {dashboard.recent_orders.map((o) => (
                              <TableRow key={o.id}>
                                <TableCell sx={{ fontWeight: 600 }}>{o.order_number}</TableCell>
                                <TableCell>{o.customer_name}</TableCell>
                                <TableCell>{o.warehouse_name || '—'}</TableCell>
                                <TableCell>${parseFloat(o.total).toFixed(2)}</TableCell>
                                <TableCell>
                                  <Chip
                                    label={o.status}
                                    size="small"
                                    color={ORDER_STATUS_COLORS[o.status] || 'default'}
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Top Customers */}
              {dashboard.top_customers?.length > 0 && (
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" fontWeight={700} gutterBottom>
                        Top Customers by Sales Volume
                      </Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Customer</TableCell>
                              <TableCell align="center">Orders Completed</TableCell>
                              <TableCell align="right">Total Spent</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {dashboard.top_customers.map((c) => (
                              <TableRow key={c.customer__id}>
                                <TableCell sx={{ fontWeight: 600 }}>{c.customer__name}</TableCell>
                                <TableCell align="center">{c.order_count}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>
                                  ${parseFloat(c.total_spent || 0).toFixed(2)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </CardContent>
                  </Card>
                </Grid>
              )}
            </Grid>
          ) : (
            <EmptyState title="No Sales Metrics" description="No sales data available for this company yet." />
          )}
        </Box>
      )}

      {/* ============================================================ */}
      {/* TAB 1: SALES QUOTATIONS */}
      {/* ============================================================ */}
      {currentTab === 1 && (
        <Box>
          {/* Filters Bar */}
          <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
              <TextField
                placeholder="Search quote number, customer, notes..."
                size="small"
                fullWidth
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
              <FormControl size="small" sx={{ minWidth: 180 }}>
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
            </Stack>
          </Paper>

          {/* Quotations Table */}
          {loading ? (
            <LoadingState message="Loading quotations..." />
          ) : quotations.length === 0 ? (
            <EmptyState
              title="No Quotations Found"
              description="Create a quotation to estimate pricing and line items for your customers."
              action={
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenQuoteModal(true)}>
                  Create First Quotation
                </Button>
              }
            />
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Quote #</TableCell>
                    <TableCell>Customer</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Valid Until</TableCell>
                    <TableCell align="center">Items</TableCell>
                    <TableCell align="right">Total Amount</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {quotations.map((quote) => (
                    <TableRow key={quote.id} hover>
                      <TableCell sx={{ fontWeight: 700 }}>
                        <Chip label={quote.quotation_number} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Tooltip title="View Customer Sales History">
                          <Typography
                            variant="body2"
                            fontWeight={600}
                            sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline', color: 'primary.main' } }}
                            onClick={() => handleOpenCustomerHistory(quote.customer, quote.customer_name)}
                          >
                            {quote.customer_name}
                          </Typography>
                        </Tooltip>
                        {quote.customer_email && (
                          <Typography variant="caption" color="text.secondary">
                            {quote.customer_email}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{quote.quotation_date}</TableCell>
                      <TableCell>{quote.valid_until || '—'}</TableCell>
                      <TableCell align="center">{quote.items_count}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        ${parseFloat(quote.total).toFixed(2)}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={quote.status}
                          size="small"
                          color={QUOTATION_STATUS_COLORS[quote.status] || 'default'}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Tooltip title="View Line Items">
                            <IconButton
                              size="small"
                              onClick={() => setViewDetailModal({ open: true, type: 'quote', data: quote })}
                            >
                              <VisibilityOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {quote.status !== 'CONVERTED' && (
                            <Tooltip title="Convert to Sales Order">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => setConvertDialog({ open: true, quotation: quote })}
                              >
                                <TransformOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {quote.status !== 'CONVERTED' && (
                            <Tooltip title="Delete Quotation">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteQuotation(quote.id)}
                              >
                                <DeleteOutlineOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
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

      {/* ============================================================ */}
      {/* TAB 2: SALES ORDERS & FULFILLMENT */}
      {/* ============================================================ */}
      {currentTab === 2 && (
        <Box>
          {/* Filters Bar */}
          <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
              <TextField
                placeholder="Search order number, customer, notes..."
                size="small"
                fullWidth
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
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={orderStatusFilter}
                  label="Status"
                  onChange={(e) => setOrderStatusFilter(e.target.value)}
                >
                  <MenuItem value="ALL">All Statuses</MenuItem>
                  <MenuItem value="DRAFT">Draft</MenuItem>
                  <MenuItem value="CONFIRMED">Confirmed</MenuItem>
                  <MenuItem value="RESERVED">Reserved</MenuItem>
                  <MenuItem value="PROCESSING">Processing</MenuItem>
                  <MenuItem value="COMPLETED">Completed</MenuItem>
                  <MenuItem value="CANCELLED">Cancelled</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </Paper>

          {/* Orders Table */}
          {loading ? (
            <LoadingState message="Loading sales orders..." />
          ) : orders.length === 0 ? (
            <EmptyState
              title="No Sales Orders Found"
              description="Convert an accepted quotation or create a direct sales order."
              action={
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenOrderModal(true)}>
                  Create Direct Order
                </Button>
              }
            />
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Order #</TableCell>
                    <TableCell>Customer</TableCell>
                    <TableCell>Warehouse</TableCell>
                    <TableCell>Order Date</TableCell>
                    <TableCell align="center">Reservation</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id} hover>
                      <TableCell sx={{ fontWeight: 700 }}>
                        <Chip label={order.order_number} size="small" color="primary" variant="outlined" />
                        {order.quotation_number && (
                          <Typography variant="caption" display="block" color="text.secondary">
                            Ref: {order.quotation_number}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Tooltip title="View Customer Sales History">
                          <Typography
                            variant="body2"
                            fontWeight={600}
                            sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline', color: 'primary.main' } }}
                            onClick={() => handleOpenCustomerHistory(order.customer, order.customer_name)}
                          >
                            {order.customer_name}
                          </Typography>
                        </Tooltip>
                        {order.customer_email && (
                          <Typography variant="caption" color="text.secondary">
                            {order.customer_email}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {order.warehouse_name ? (
                          <Chip
                            icon={<WarehouseOutlinedIcon />}
                            label={order.warehouse_name}
                            size="small"
                            variant="outlined"
                          />
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            Not assigned
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{order.order_date}</TableCell>
                      <TableCell align="center">
                        <Chip
                          label={order.reservation_status}
                          size="small"
                          color={RESERVATION_STATUS_COLORS[order.reservation_status] || 'default'}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        ${parseFloat(order.total).toFixed(2)}
                      </TableCell>
                      <TableCell align="center">
                        <Select
                          size="small"
                          value={order.status}
                          onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                          sx={{
                            fontSize: '0.75rem',
                            height: 28,
                            fontWeight: 600,
                            borderRadius: 16,
                            '& .MuiSelect-select': { py: 0.5, px: 1.5 },
                          }}
                        >
                          <MenuItem value="DRAFT">DRAFT</MenuItem>
                          <MenuItem value="CONFIRMED">CONFIRMED</MenuItem>
                          <MenuItem value="RESERVED">RESERVED</MenuItem>
                          <MenuItem value="PROCESSING">PROCESSING</MenuItem>
                          <MenuItem value="COMPLETED">COMPLETED</MenuItem>
                          <MenuItem value="CANCELLED">CANCELLED</MenuItem>
                        </Select>
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          {/* Reserve Stock button */}
                          {(order.status === 'CONFIRMED' || order.status === 'DRAFT') && (
                            <Tooltip title="Reserve Inventory Stock">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleOpenReserve(order)}
                              >
                                <BookmarkBorderOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}

                          {/* Release Reservation button */}
                          {order.status === 'RESERVED' && (
                            <Tooltip title="Release Stock Reservation">
                              <IconButton
                                size="small"
                                color="warning"
                                onClick={() => handleOpenRelease(order)}
                              >
                                <LockOpenOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}

                          {/* Fulfill Order button */}
                          {order.status === 'RESERVED' && (
                            <Tooltip title="Fulfill & Deduct Stock (STOCK_OUT)">
                              <IconButton
                                size="small"
                                color="success"
                                onClick={() => handleOpenFulfill(order)}
                              >
                                <LocalShippingOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}

                          {/* Generate Invoice button */}
                          {order.status !== 'CANCELLED' && (
                            <Tooltip title="Generate Invoice from Order">
                              <IconButton
                                size="small"
                                color="info"
                                onClick={() => handleOpenInvoiceOrder(order)}
                              >
                                <DescriptionOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}

                          {/* View details */}
                          <Tooltip title="View Order & Inventory Details">
                            <IconButton
                              size="small"
                              onClick={() => setViewDetailModal({ open: true, type: 'order', data: order })}
                            >
                              <VisibilityOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          {/* Cancel Order */}
                          {order.status !== 'CANCELLED' && order.status !== 'COMPLETED' && (
                            <Tooltip title="Cancel Order (Releases reservations)">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleCancelOrder(order)}
                              >
                                <CancelOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}

                          {/* Process Sales Return (Phase 4D) */}
                          {order.status === 'COMPLETED' && (
                            <Tooltip title="Process Sales Return (Restores Inventory)">
                              <IconButton
                                size="small"
                                color="secondary"
                                onClick={() => handleOpenReturnModal(order)}
                              >
                                <AssignmentReturnOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}

                          {/* Delete */}
                          <Tooltip title="Delete Order">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteOrder(order.id)}
                            >
                              <DeleteOutlineOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
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

      {/* ============================================================ */}
      {/* TAB 3: INVOICES */}
      {/* ============================================================ */}
      {currentTab === 3 && (
        <Box>
          {/* Filters Bar */}
          <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
              <TextField
                placeholder="Search invoice number, customer, order number, notes..."
                size="small"
                fullWidth
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
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={invoiceStatusFilter}
                  label="Status"
                  onChange={(e) => setInvoiceStatusFilter(e.target.value)}
                >
                  <MenuItem value="ALL">All Statuses</MenuItem>
                  <MenuItem value="DRAFT">Draft</MenuItem>
                  <MenuItem value="ISSUED">Issued</MenuItem>
                  <MenuItem value="PARTIALLY_PAID">Partially Paid</MenuItem>
                  <MenuItem value="PAID">Paid</MenuItem>
                  <MenuItem value="OVERDUE">Overdue</MenuItem>
                  <MenuItem value="CANCELLED">Cancelled</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </Paper>

          {loading && invoices.length === 0 ? (
            <LoadingState message="Loading invoices..." />
          ) : invoices.length === 0 ? (
            <EmptyState
              title="No Invoices Found"
              description={
                searchQuery || invoiceStatusFilter !== 'ALL'
                  ? 'No invoices match your search filters.'
                  : 'Create your first invoice directly or generate one from a confirmed sales order.'
              }
              actionLabel="New Invoice"
              onAction={() => setOpenInvoiceModal(true)}
            />
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="medium">
                <TableHead>
                  <TableRow>
                    <TableCell>Invoice #</TableCell>
                    <TableCell>Customer</TableCell>
                    <TableCell>Sales Order</TableCell>
                    <TableCell>Issue Date</TableCell>
                    <TableCell>Due Date</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell align="right">Amount Paid</TableCell>
                    <TableCell align="right">Balance Due</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invoices.map((inv) => {
                    const isOverdue = inv.is_overdue;
                    const effStatus = inv.effective_status || inv.status;
                    const balDue = parseFloat(inv.balance_due || 0);

                    return (
                      <TableRow key={inv.id} hover>
                        <TableCell sx={{ fontWeight: 700, color: 'primary.main' }}>
                          {inv.invoice_number}
                        </TableCell>
                        <TableCell>
                          <Tooltip title="View Customer Sales History">
                            <Typography
                              variant="body2"
                              fontWeight={600}
                              sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline', color: 'primary.main' } }}
                              onClick={() => handleOpenCustomerHistory(inv.customer, inv.customer_name)}
                            >
                              {inv.customer_name}
                            </Typography>
                          </Tooltip>
                          <Typography variant="caption" color="text.secondary">
                            {inv.customer_email}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {inv.order_number ? (
                            <Chip label={inv.order_number} size="small" variant="outlined" />
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              Direct
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>{inv.invoice_date}</TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{
                              color: isOverdue ? 'error.main' : 'inherit',
                              fontWeight: isOverdue ? 700 : 400,
                            }}
                          >
                            {inv.due_date || '—'}
                          </Typography>
                          {isOverdue && (
                            <Chip label="OVERDUE" size="small" color="error" sx={{ height: 18, fontSize: '0.65rem' }} />
                          )}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          ${parseFloat(inv.total).toFixed(2)}
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'success.main', fontWeight: 600 }}>
                          ${parseFloat(inv.amount_paid).toFixed(2)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: balDue > 0 ? 'warning.dark' : 'text.secondary' }}>
                          ${balDue.toFixed(2)}
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={effStatus}
                            size="small"
                            color={INVOICE_STATUS_COLORS[effStatus] || 'default'}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            {/* Record Payment Button */}
                            {effStatus !== 'PAID' && effStatus !== 'CANCELLED' && balDue > 0 && (
                              <Tooltip title="Record Payment">
                                <IconButton
                                  size="small"
                                  color="success"
                                  onClick={() => handleOpenPaymentDialog(inv)}
                                >
                                  <PaymentIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}

                            {/* View Details */}
                            <Tooltip title="View Invoice & Payments">
                              <IconButton
                                size="small"
                                onClick={() => setViewDetailModal({ open: true, type: 'invoice', data: inv })}
                              >
                                <VisibilityOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>

                            {/* Cancel Invoice */}
                            {effStatus !== 'PAID' && effStatus !== 'CANCELLED' && (
                              <Tooltip title="Cancel Invoice">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleCancelInvoice(inv)}
                                >
                                  <CancelOutlinedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* ============================================================ */}
      {/* TAB 4: PAYMENTS & RECEIPTS */}
      {/* ============================================================ */}
      {currentTab === 4 && (
        <Box>
          {/* Filters Bar */}
          <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
              <TextField
                placeholder="Search receipt number, payment number, customer, reference..."
                size="small"
                fullWidth
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
            </Stack>
          </Paper>

          {loading && receipts.length === 0 ? (
            <LoadingState message="Loading payment receipts..." />
          ) : receipts.length === 0 ? (
            <EmptyState
              title="No Payment Receipts Found"
              description="When payments are recorded against invoices, atomic payment receipts are automatically generated and listed here."
            />
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="medium">
                <TableHead>
                  <TableRow>
                    <TableCell>Receipt #</TableCell>
                    <TableCell>Payment #</TableCell>
                    <TableCell>Invoice #</TableCell>
                    <TableCell>Customer</TableCell>
                    <TableCell>Payment Method</TableCell>
                    <TableCell>Reference</TableCell>
                    <TableCell align="right">Amount Received</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {receipts.map((rec) => (
                    <TableRow key={rec.id} hover>
                      <TableCell sx={{ fontWeight: 700, color: 'success.main' }}>
                        {rec.receipt_number}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>
                        {rec.payment_number}
                      </TableCell>
                      <TableCell>
                        <Chip label={rec.invoice_number} size="small" variant="outlined" color="primary" />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>
                        {rec.customer_name}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={rec.payment_method?.replace('_', ' ')}
                          size="small"
                          color="info"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{rec.reference || '—'}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: 'success.dark', fontSize: '1rem' }}>
                        ${parseFloat(rec.amount_paid).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {new Date(rec.receipt_date || rec.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="View & Print Official Receipt">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => setReceiptModal({ open: true, receipt: rec })}
                          >
                            <PrintOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
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
      {/* TAB 5: REPORTS & ANALYTICS (Phase 4D) */}
      {/* ============================================================ */}
      {currentTab === 5 && (
        <Box>
          {/* Report Type Selector & Filter Bar */}
          <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                <Button
                  size="small"
                  variant={reportType === 'summary' ? 'contained' : 'outlined'}
                  onClick={() => setReportType('summary')}
                  startIcon={<AssessmentOutlinedIcon />}
                >
                  Executive Summary
                </Button>
                <Button
                  size="small"
                  variant={reportType === 'customer' ? 'contained' : 'outlined'}
                  onClick={() => setReportType('customer')}
                >
                  Customer Performance
                </Button>
                <Button
                  size="small"
                  variant={reportType === 'product' ? 'contained' : 'outlined'}
                  onClick={() => setReportType('product')}
                >
                  Product Sales
                </Button>
                <Button
                  size="small"
                  variant={reportType === 'invoice' ? 'contained' : 'outlined'}
                  onClick={() => setReportType('invoice')}
                >
                  Invoice Aging
                </Button>
                <Button
                  size="small"
                  variant={reportType === 'payment' ? 'contained' : 'outlined'}
                  onClick={() => setReportType('payment')}
                >
                  Payment Ledger
                </Button>
              </Stack>
              <Button
                variant="outlined"
                size="small"
                startIcon={<RefreshIcon />}
                onClick={fetchData}
              >
                Refresh Report
              </Button>
            </Stack>
            <Divider sx={{ my: 1.5 }} />
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={3}>
                <TextField
                  label="From Date"
                  type="date"
                  size="small"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={reportDateFrom}
                  onChange={(e) => setReportDateFrom(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  label="To Date"
                  type="date"
                  size="small"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={reportDateTo}
                  onChange={(e) => setReportDateTo(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Customer</InputLabel>
                  <Select
                    value={reportCustomer}
                    label="Customer"
                    onChange={(e) => setReportCustomer(e.target.value)}
                  >
                    <MenuItem value="">All Customers</MenuItem>
                    {customers.map((c) => (
                      <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={fetchData}
                >
                  Filter Report
                </Button>
              </Grid>
            </Grid>
          </Paper>

          {loading ? (
            <LoadingState message="Generating sales report..." />
          ) : !reportData ? (
            <EmptyState title="No Report Data" description="Select a report type and date filter above." />
          ) : (
            <Box>
              {/* Render Report by Type */}
              {reportType === 'summary' && reportData.data && (
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                      title="Total Orders"
                      value={reportData.data.total_orders}
                      subtitle={`Avg Order: $${parseFloat(reportData.data.average_order_value || 0).toFixed(2)}`}
                      icon={ShoppingBagOutlinedIcon}
                      color="#1976d2"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                      title="Total Sales Value"
                      value={`$${parseFloat(reportData.data.total_sales_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                      subtitle={`${reportData.data.active_customers_count || 0} active customers`}
                      icon={MonetizationOnOutlinedIcon}
                      color="#2e7d32"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                      title="Total Collected"
                      value={`$${parseFloat(reportData.data.total_collected || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                      subtitle={`${reportData.data.collection_rate_percentage}% collection rate`}
                      icon={AccountBalanceWalletOutlinedIcon}
                      color="#0288d1"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                      title="Outstanding Balance"
                      value={`$${parseFloat(reportData.data.total_outstanding || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                      subtitle={`Returns: $${parseFloat(reportData.data.total_returns_amount || 0).toFixed(2)}`}
                      icon={CreditCardOutlinedIcon}
                      color="#ed6c02"
                    />
                  </Grid>

                  {/* Monthly Trend Table */}
                  {analyticsData?.monthly_trends && (
                    <Grid item xs={12} md={8}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
                            12-Month Sales & Collections Trend
                          </Typography>
                          <TableContainer>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Month</TableCell>
                                  <TableCell align="right">Orders</TableCell>
                                  <TableCell align="right">Sales ($)</TableCell>
                                  <TableCell align="right">Invoiced ($)</TableCell>
                                  <TableCell align="right">Collected ($)</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {analyticsData.monthly_trends.slice(-6).map((m) => (
                                  <TableRow key={m.month}>
                                    <TableCell sx={{ fontWeight: 600 }}>{m.month}</TableCell>
                                    <TableCell align="right">{m.orders_count}</TableCell>
                                    <TableCell align="right">${parseFloat(m.sales_total).toFixed(2)}</TableCell>
                                    <TableCell align="right">${parseFloat(m.invoiced_total).toFixed(2)}</TableCell>
                                    <TableCell align="right" sx={{ color: 'success.main', fontWeight: 600 }}>${parseFloat(m.collected_total).toFixed(2)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </CardContent>
                      </Card>
                    </Grid>
                  )}

                  {/* Order Status Distribution */}
                  {analyticsData?.order_status_distribution && (
                    <Grid item xs={12} md={4}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
                            Order Status Breakdown
                          </Typography>
                          <Stack spacing={1.5}>
                            {analyticsData.order_status_distribution.map((item) => (
                              <Stack key={item.status} direction="row" justifyContent="space-between" alignItems="center">
                                <Chip size="small" label={item.label} color={ORDER_STATUS_COLORS[item.status] || 'default'} />
                                <Typography variant="body2" fontWeight={600}>
                                  {item.count} orders (${parseFloat(item.total_amount).toFixed(2)})
                                </Typography>
                              </Stack>
                            ))}
                          </Stack>
                        </CardContent>
                      </Card>
                    </Grid>
                  )}
                </Grid>
              )}

              {/* Customer Performance Report */}
              {reportType === 'customer' && (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Customer</TableCell>
                        <TableCell>Email</TableCell>
                        <TableCell align="right">Orders</TableCell>
                        <TableCell align="right">Total Sales ($)</TableCell>
                        <TableCell align="right">Invoiced ($)</TableCell>
                        <TableCell align="right">Paid ($)</TableCell>
                        <TableCell align="right">Balance Due ($)</TableCell>
                        <TableCell align="center">History</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(reportData.rows || []).map((row) => (
                        <TableRow key={row.customer_id} hover>
                          <TableCell sx={{ fontWeight: 600 }}>{row.customer_name}</TableCell>
                          <TableCell>{row.customer_email || '—'}</TableCell>
                          <TableCell align="right">{row.orders_count}</TableCell>
                          <TableCell align="right">${parseFloat(row.total_sales).toFixed(2)}</TableCell>
                          <TableCell align="right">${parseFloat(row.invoiced_total).toFixed(2)}</TableCell>
                          <TableCell align="right" sx={{ color: 'success.main', fontWeight: 600 }}>${parseFloat(row.paid_total).toFixed(2)}</TableCell>
                          <TableCell align="right" sx={{ color: parseFloat(row.balance_due) > 0 ? 'error.main' : 'text.primary', fontWeight: 600 }}>${parseFloat(row.balance_due).toFixed(2)}</TableCell>
                          <TableCell align="center">
                            <Tooltip title="View Complete Sales History">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleOpenCustomerHistory(row.customer_id, row.customer_name)}
                              >
                                <HistoryOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {/* Product Sales Report */}
              {reportType === 'product' && (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Product Name</TableCell>
                        <TableCell>SKU</TableCell>
                        <TableCell align="right">Units Sold</TableCell>
                        <TableCell align="right">Total Sales ($)</TableCell>
                        <TableCell align="right">Avg Unit Price ($)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(reportData.rows || []).map((row) => (
                        <TableRow key={row.product_id} hover>
                          <TableCell sx={{ fontWeight: 600 }}>{row.product_name}</TableCell>
                          <TableCell>{row.product_sku}</TableCell>
                          <TableCell align="right">{parseFloat(row.units_sold).toFixed(2)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, color: 'primary.main' }}>${parseFloat(row.total_sales).toFixed(2)}</TableCell>
                          <TableCell align="right">${parseFloat(row.average_unit_price).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {/* Invoice Aging Report */}
              {reportType === 'invoice' && (
                <Box>
                  {reportData.summary && (
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                      <Grid item xs={12} sm={6} md={2.4}>
                        <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                          <Typography variant="caption" color="text.secondary">Current</Typography>
                          <Typography variant="h6" fontWeight={700} color="success.main">
                            ${parseFloat(reportData.summary.current_amount || 0).toFixed(2)}
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={12} sm={6} md={2.4}>
                        <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                          <Typography variant="caption" color="text.secondary">1-30 Days Overdue</Typography>
                          <Typography variant="h6" fontWeight={700} color="warning.main">
                            ${parseFloat(reportData.summary.days_1_30_amount || 0).toFixed(2)}
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={12} sm={6} md={2.4}>
                        <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                          <Typography variant="caption" color="text.secondary">31-60 Days Overdue</Typography>
                          <Typography variant="h6" fontWeight={700} color="error.light">
                            ${parseFloat(reportData.summary.days_31_60_amount || 0).toFixed(2)}
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={12} sm={6} md={2.4}>
                        <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                          <Typography variant="caption" color="text.secondary">60+ Days Overdue</Typography>
                          <Typography variant="h6" fontWeight={700} color="error.main">
                            ${parseFloat(reportData.summary.days_60_plus_amount || 0).toFixed(2)}
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={12} sm={6} md={2.4}>
                        <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default' }}>
                          <Typography variant="caption" color="text.secondary">Total Outstanding</Typography>
                          <Typography variant="h6" fontWeight={700}>
                            ${parseFloat(reportData.summary.total_outstanding || 0).toFixed(2)}
                          </Typography>
                        </Paper>
                      </Grid>
                    </Grid>
                  )}
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Invoice #</TableCell>
                          <TableCell>Customer</TableCell>
                          <TableCell>Invoice Date</TableCell>
                          <TableCell>Due Date</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Aging Bucket</TableCell>
                          <TableCell align="right">Days Overdue</TableCell>
                          <TableCell align="right">Total ($)</TableCell>
                          <TableCell align="right">Balance Due ($)</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(reportData.rows || []).map((row) => (
                          <TableRow key={row.id} hover>
                            <TableCell sx={{ fontWeight: 600 }}>{row.invoice_number}</TableCell>
                            <TableCell>{row.customer_name}</TableCell>
                            <TableCell>{row.invoice_date}</TableCell>
                            <TableCell>{row.due_date}</TableCell>
                            <TableCell>
                              <Chip size="small" label={row.status} color={INVOICE_STATUS_COLORS[row.status] || 'default'} />
                            </TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                label={row.aging_bucket}
                                color={row.aging_bucket === 'CURRENT' ? 'success' : row.aging_bucket === '1-30_DAYS' ? 'warning' : 'error'}
                              />
                            </TableCell>
                            <TableCell align="right">{row.days_overdue}</TableCell>
                            <TableCell align="right">${parseFloat(row.total).toFixed(2)}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, color: parseFloat(row.balance_due) > 0 ? 'error.main' : 'inherit' }}>
                              ${parseFloat(row.balance_due).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {/* Payment Ledger Report */}
              {reportType === 'payment' && (
                <Box>
                  <Paper variant="outlined" sx={{ p: 2, mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle1" fontWeight={700}>
                      Total Collections: ${parseFloat(reportData.total_collected || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      {Object.entries(reportData.method_totals || {}).map(([method, amt]) => (
                        <Chip key={method} size="small" label={`${method}: $${parseFloat(amt).toFixed(2)}`} variant="outlined" />
                      ))}
                    </Stack>
                  </Paper>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Payment #</TableCell>
                          <TableCell>Date</TableCell>
                          <TableCell>Customer</TableCell>
                          <TableCell>Invoice #</TableCell>
                          <TableCell>Method</TableCell>
                          <TableCell align="right">Amount ($)</TableCell>
                          <TableCell>Reference</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(reportData.rows || []).map((row) => (
                          <TableRow key={row.id} hover>
                            <TableCell sx={{ fontWeight: 600 }}>{row.payment_number}</TableCell>
                            <TableCell>{row.payment_date}</TableCell>
                            <TableCell>{row.customer_name}</TableCell>
                            <TableCell>{row.invoice_number}</TableCell>
                            <TableCell>
                              <Chip size="small" label={row.payment_method} variant="outlined" />
                            </TableCell>
                            <TableCell align="right" sx={{ color: 'success.main', fontWeight: 700 }}>
                              ${parseFloat(row.amount).toFixed(2)}
                            </TableCell>
                            <TableCell>{row.reference || '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </Box>
          )}
        </Box>
      )}

      {/* ============================================================ */}
      {/* MODAL: CREATE QUOTATION */}
      {/* ============================================================ */}
      <Dialog
        open={openQuoteModal}
        onClose={() => setOpenQuoteModal(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>New Sales Quotation</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required size="small">
                <InputLabel>Customer</InputLabel>
                <Select
                  value={quoteForm.customer}
                  label="Customer"
                  onChange={(e) => setQuoteForm({ ...quoteForm, customer: e.target.value })}
                >
                  {customers.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name} {c.email ? `(${c.email})` : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Valid Until"
                type="date"
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
                value={quoteForm.valid_until}
                onChange={(e) => setQuoteForm({ ...quoteForm, valid_until: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Notes / Terms"
                fullWidth
                multiline
                rows={2}
                size="small"
                value={quoteForm.notes}
                onChange={(e) => setQuoteForm({ ...quoteForm, notes: e.target.value })}
              />
            </Grid>

            {/* Line Items */}
            <Grid item xs={12}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1, mt: 1 }}>
                <Typography variant="subtitle2" fontWeight={700}>
                  Line Items
                </Typography>
                <Button size="small" startIcon={<AddIcon />} onClick={addQuoteItem}>
                  Add Item
                </Button>
              </Stack>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ minWidth: 180 }}>Product</TableCell>
                      <TableCell sx={{ width: 100 }}>Quantity</TableCell>
                      <TableCell sx={{ width: 110 }}>Unit Price ($)</TableCell>
                      <TableCell sx={{ width: 90 }}>Discount ($)</TableCell>
                      <TableCell sx={{ width: 90 }}>Tax ($)</TableCell>
                      <TableCell sx={{ width: 100 }} align="right">Line Total</TableCell>
                      <TableCell sx={{ width: 50 }}></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {quoteForm.items.map((item, index) => {
                      const lineTot = Math.max(
                        0,
                        (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0) -
                          (parseFloat(item.discount) || 0) +
                          (parseFloat(item.tax) || 0)
                      ).toFixed(2);

                      return (
                        <TableRow key={index}>
                          <TableCell>
                            <FormControl fullWidth size="small">
                              <Select
                                value={item.product}
                                onChange={(e) => handleQuoteItemChange(index, 'product', e.target.value)}
                              >
                                {products.map((p) => (
                                  <MenuItem key={p.id} value={p.id}>
                                    {p.name} ({p.sku}) - ${parseFloat(p.selling_price).toFixed(2)}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              type="number"
                              value={item.quantity}
                              onChange={(e) => handleQuoteItemChange(index, 'quantity', e.target.value)}
                              inputProps={{ min: 0.01, step: 1 }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              type="number"
                              value={item.unit_price}
                              onChange={(e) => handleQuoteItemChange(index, 'unit_price', e.target.value)}
                              inputProps={{ min: 0, step: 0.01 }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              type="number"
                              value={item.discount}
                              onChange={(e) => handleQuoteItemChange(index, 'discount', e.target.value)}
                              inputProps={{ min: 0, step: 0.01 }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              type="number"
                              value={item.tax}
                              onChange={(e) => handleQuoteItemChange(index, 'tax', e.target.value)}
                              inputProps={{ min: 0, step: 0.01 }}
                            />
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>
                            ${lineTot}
                          </TableCell>
                          <TableCell>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => removeQuoteItem(index)}
                              disabled={quoteForm.items.length <= 1}
                            >
                              <DeleteOutlineOutlinedIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Real-time Summary Box */}
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                <Paper variant="outlined" sx={{ p: 2, minWidth: 260 }}>
                  <Stack spacing={0.5}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">Subtotal:</Typography>
                      <Typography variant="body2">${quoteTotals.subtotal}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">Total Discount:</Typography>
                      <Typography variant="body2" color="error.main">-${quoteTotals.discount}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">Estimated Tax:</Typography>
                      <Typography variant="body2">+${quoteTotals.tax}</Typography>
                    </Stack>
                    <Divider sx={{ my: 0.5 }} />
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="subtitle2" fontWeight={700}>Total Amount:</Typography>
                      <Typography variant="subtitle1" fontWeight={700} color="primary.main">
                        ${quoteTotals.total}
                      </Typography>
                    </Stack>
                  </Stack>
                </Paper>
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setOpenQuoteModal(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleCreateQuotation} disabled={submitting}>
            {submitting ? <CircularProgress size={22} /> : 'Save Quotation'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ============================================================ */}
      {/* MODAL: CREATE DIRECT SALES ORDER */}
      {/* ============================================================ */}
      <Dialog
        open={openOrderModal}
        onClose={() => setOpenOrderModal(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>New Direct Sales Order</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth required size="small">
                <InputLabel>Customer</InputLabel>
                <Select
                  value={orderForm.customer}
                  label="Customer"
                  onChange={(e) => setOrderForm({ ...orderForm, customer: e.target.value })}
                >
                  {customers.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name} {c.email ? `(${c.email})` : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Fulfillment Warehouse</InputLabel>
                <Select
                  value={orderForm.warehouse}
                  label="Fulfillment Warehouse"
                  onChange={(e) => setOrderForm({ ...orderForm, warehouse: e.target.value })}
                >
                  <MenuItem value="">
                    <em>Select Warehouse (Optional)</em>
                  </MenuItem>
                  {warehouses.map((w) => (
                    <MenuItem key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Initial Status</InputLabel>
                <Select
                  value={orderForm.status}
                  label="Initial Status"
                  onChange={(e) => setOrderForm({ ...orderForm, status: e.target.value })}
                >
                  <MenuItem value="DRAFT">Draft</MenuItem>
                  <MenuItem value="CONFIRMED">Confirmed</MenuItem>
                  <MenuItem value="PROCESSING">Processing</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Order Notes / Delivery Terms"
                fullWidth
                multiline
                rows={2}
                size="small"
                value={orderForm.notes}
                onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
              />
            </Grid>

            {/* Line Items */}
            <Grid item xs={12}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1, mt: 1 }}>
                <Typography variant="subtitle2" fontWeight={700}>
                  Order Items
                </Typography>
                <Button size="small" startIcon={<AddIcon />} onClick={addOrderItem}>
                  Add Item
                </Button>
              </Stack>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ minWidth: 180 }}>Product</TableCell>
                      <TableCell sx={{ width: 100 }}>Quantity</TableCell>
                      <TableCell sx={{ width: 110 }}>Unit Price ($)</TableCell>
                      <TableCell sx={{ width: 90 }}>Discount ($)</TableCell>
                      <TableCell sx={{ width: 90 }}>Tax ($)</TableCell>
                      <TableCell sx={{ width: 100 }} align="right">Line Total</TableCell>
                      <TableCell sx={{ width: 50 }}></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {orderForm.items.map((item, index) => {
                      const lineTot = Math.max(
                        0,
                        (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0) -
                          (parseFloat(item.discount) || 0) +
                          (parseFloat(item.tax) || 0)
                      ).toFixed(2);

                      return (
                        <TableRow key={index}>
                          <TableCell>
                            <FormControl fullWidth size="small">
                              <Select
                                value={item.product}
                                onChange={(e) => handleOrderItemChange(index, 'product', e.target.value)}
                              >
                                {products.map((p) => (
                                  <MenuItem key={p.id} value={p.id}>
                                    {p.name} ({p.sku}) - ${parseFloat(p.selling_price).toFixed(2)}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              type="number"
                              value={item.quantity}
                              onChange={(e) => handleOrderItemChange(index, 'quantity', e.target.value)}
                              inputProps={{ min: 0.01, step: 1 }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              type="number"
                              value={item.unit_price}
                              onChange={(e) => handleOrderItemChange(index, 'unit_price', e.target.value)}
                              inputProps={{ min: 0, step: 0.01 }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              type="number"
                              value={item.discount}
                              onChange={(e) => handleOrderItemChange(index, 'discount', e.target.value)}
                              inputProps={{ min: 0, step: 0.01 }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              type="number"
                              value={item.tax}
                              onChange={(e) => handleOrderItemChange(index, 'tax', e.target.value)}
                              inputProps={{ min: 0, step: 0.01 }}
                            />
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>
                            ${lineTot}
                          </TableCell>
                          <TableCell>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => removeOrderItem(index)}
                              disabled={orderForm.items.length <= 1}
                            >
                              <DeleteOutlineOutlinedIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Real-time Summary Box */}
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                <Paper variant="outlined" sx={{ p: 2, minWidth: 260 }}>
                  <Stack spacing={0.5}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">Subtotal:</Typography>
                      <Typography variant="body2">${orderTotals.subtotal}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">Discount:</Typography>
                      <Typography variant="body2" color="error.main">-${orderTotals.discount}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">Tax:</Typography>
                      <Typography variant="body2">+${orderTotals.tax}</Typography>
                    </Stack>
                    <Divider sx={{ my: 0.5 }} />
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="subtitle2" fontWeight={700}>Total Amount:</Typography>
                      <Typography variant="subtitle1" fontWeight={700} color="primary.main">
                        ${orderTotals.total}
                      </Typography>
                    </Stack>
                  </Stack>
                </Paper>
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setOpenOrderModal(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleCreateOrder} disabled={submitting}>
            {submitting ? <CircularProgress size={22} /> : 'Save Sales Order'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ============================================================ */}
      {/* MODAL: VIEW DETAILS (QUOTATION OR ORDER) */}
      {/* ============================================================ */}
      <Dialog
        open={viewDetailModal.open}
        onClose={() => setViewDetailModal({ open: false, type: '', data: null })}
        maxWidth="md"
        fullWidth
      >
        {viewDetailModal.data && (
          <>
            <DialogTitle sx={{ fontWeight: 700 }}>
              {viewDetailModal.type === 'quote'
                ? `Quotation: ${viewDetailModal.data.quotation_number}`
                : viewDetailModal.type === 'order'
                ? `Sales Order: ${viewDetailModal.data.order_number}`
                : `Invoice: ${viewDetailModal.data.invoice_number}`}
            </DialogTitle>
            <DialogContent dividers>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={3}>
                  <Typography variant="caption" color="text.secondary">Customer</Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {viewDetailModal.data.customer_name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {viewDetailModal.data.customer_email}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Typography variant="caption" color="text.secondary">
                    {viewDetailModal.type === 'quote'
                      ? 'Quotation Date'
                      : viewDetailModal.type === 'order'
                      ? 'Order Date'
                      : 'Invoice Date'}
                  </Typography>
                  <Typography variant="body1">
                    {viewDetailModal.type === 'quote'
                      ? viewDetailModal.data.quotation_date
                      : viewDetailModal.type === 'order'
                      ? viewDetailModal.data.order_date
                      : viewDetailModal.data.invoice_date}
                  </Typography>
                  {viewDetailModal.type === 'invoice' && viewDetailModal.data.due_date && (
                    <Typography
                      variant="caption"
                      color={viewDetailModal.data.is_overdue ? 'error.main' : 'text.secondary'}
                      display="block"
                    >
                      Due: {viewDetailModal.data.due_date} {viewDetailModal.data.is_overdue ? '(OVERDUE)' : ''}
                    </Typography>
                  )}
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Typography variant="caption" color="text.secondary">Status</Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <Chip
                      label={
                        viewDetailModal.type === 'invoice'
                          ? (viewDetailModal.data.effective_status || viewDetailModal.data.status)
                          : viewDetailModal.data.status
                      }
                      size="small"
                      color={
                        (viewDetailModal.type === 'quote'
                          ? QUOTATION_STATUS_COLORS[viewDetailModal.data.status]
                          : viewDetailModal.type === 'order'
                          ? ORDER_STATUS_COLORS[viewDetailModal.data.status]
                          : INVOICE_STATUS_COLORS[viewDetailModal.data.effective_status || viewDetailModal.data.status]) || 'default'
                      }
                    />
                  </Box>
                </Grid>
                {viewDetailModal.type === 'order' && (
                  <Grid item xs={12} sm={3}>
                    <Typography variant="caption" color="text.secondary">Fulfillment Warehouse</Typography>
                    <Typography variant="body1" fontWeight={600}>
                      {viewDetailModal.data.warehouse_name || 'Unassigned'}
                    </Typography>
                    <Chip
                      label={`Reservation: ${viewDetailModal.data.reservation_status}`}
                      size="small"
                      color={RESERVATION_STATUS_COLORS[viewDetailModal.data.reservation_status] || 'default'}
                      sx={{ mt: 0.5 }}
                    />
                  </Grid>
                )}
                {viewDetailModal.type === 'invoice' && viewDetailModal.data.order_number && (
                  <Grid item xs={12} sm={3}>
                    <Typography variant="caption" color="text.secondary">Sales Order</Typography>
                    <Typography variant="body1" fontWeight={600}>
                      {viewDetailModal.data.order_number}
                    </Typography>
                  </Grid>
                )}
                {viewDetailModal.data.notes && (
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">Notes</Typography>
                    <Typography variant="body2">{viewDetailModal.data.notes}</Typography>
                  </Grid>
                )}
              </Grid>

              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Itemized Lines
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Product</TableCell>
                      <TableCell align="center">Quantity</TableCell>
                      {viewDetailModal.type === 'order' && (
                        <>
                          <TableCell align="center">Reserved</TableCell>
                          <TableCell align="center">Available in Wh</TableCell>
                        </>
                      )}
                      <TableCell align="right">Unit Price</TableCell>
                      <TableCell align="right">Discount</TableCell>
                      <TableCell align="right">Tax</TableCell>
                      <TableCell align="right">Line Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {viewDetailModal.data.items?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {item.product_name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            SKU: {item.product_sku} {item.description ? `• ${item.description}` : ''}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">{item.quantity}</TableCell>
                        {viewDetailModal.type === 'order' && (
                          <>
                            <TableCell align="center" sx={{ fontWeight: 600, color: 'secondary.main' }}>
                              {item.reserved_quantity || '0.00'}
                            </TableCell>
                            <TableCell align="center">
                              {item.available_stock || '—'}
                            </TableCell>
                          </>
                        )}
                        <TableCell align="right">${parseFloat(item.unit_price).toFixed(2)}</TableCell>
                        <TableCell align="right">${parseFloat(item.discount).toFixed(2)}</TableCell>
                        <TableCell align="right">${parseFloat(item.tax).toFixed(2)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          ${parseFloat(item.line_total).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Reservations History sub-table */}
              {viewDetailModal.data.reservations?.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                    Stock Reservation Audit Records
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Product</TableCell>
                          <TableCell>Warehouse</TableCell>
                          <TableCell align="center">Quantity</TableCell>
                          <TableCell align="center">Status</TableCell>
                          <TableCell align="right">Updated</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {viewDetailModal.data.reservations.map((res) => (
                          <TableRow key={res.id}>
                            <TableCell>{res.product_name} ({res.product_sku})</TableCell>
                            <TableCell>{res.warehouse_name} ({res.warehouse_code})</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 600 }}>{res.quantity}</TableCell>
                            <TableCell align="center">
                              <Chip
                                label={res.status}
                                size="small"
                                color={RESERVATION_STATUS_COLORS[res.status] || 'default'}
                              />
                            </TableCell>
                            <TableCell align="right">
                              {new Date(res.updated_at).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {/* Payments History sub-table for Invoices */}
              {viewDetailModal.type === 'invoice' && viewDetailModal.data.payments?.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                    Recorded Payments
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Payment #</TableCell>
                          <TableCell>Method</TableCell>
                          <TableCell>Reference</TableCell>
                          <TableCell align="right">Amount</TableCell>
                          <TableCell>Date</TableCell>
                          <TableCell align="right">Receipt</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {viewDetailModal.data.payments.map((pmt) => (
                          <TableRow key={pmt.id}>
                            <TableCell sx={{ fontWeight: 600 }}>{pmt.payment_number}</TableCell>
                            <TableCell>
                              <Chip label={pmt.payment_method?.replace('_', ' ')} size="small" variant="outlined" />
                            </TableCell>
                            <TableCell>{pmt.reference || '—'}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>
                              ${parseFloat(pmt.amount).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              {new Date(pmt.payment_date || pmt.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell align="right">
                              {pmt.receipt && (
                                <Tooltip title="View Official Receipt">
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={() => {
                                      setViewDetailModal({ open: false, type: '', data: null });
                                      setReceiptModal({ open: true, receipt: pmt.receipt });
                                    }}
                                  >
                                    <PrintOutlinedIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                <Paper variant="outlined" sx={{ p: 2, minWidth: 260 }}>
                  <Stack spacing={0.5}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">Subtotal:</Typography>
                      <Typography variant="body2">${parseFloat(viewDetailModal.data.subtotal).toFixed(2)}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">Discount:</Typography>
                      <Typography variant="body2" color="error.main">-${parseFloat(viewDetailModal.data.discount).toFixed(2)}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">Tax:</Typography>
                      <Typography variant="body2">+${parseFloat(viewDetailModal.data.tax).toFixed(2)}</Typography>
                    </Stack>
                    <Divider sx={{ my: 0.5 }} />
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="subtitle2" fontWeight={700}>Total Amount:</Typography>
                      <Typography variant="subtitle1" fontWeight={700} color="primary.main">
                        ${parseFloat(viewDetailModal.data.total).toFixed(2)}
                      </Typography>
                    </Stack>
                    {viewDetailModal.type === 'invoice' && (
                      <>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="caption" color="text.secondary">Amount Paid:</Typography>
                          <Typography variant="body2" color="success.main" fontWeight={600}>
                            ${parseFloat(viewDetailModal.data.amount_paid || 0).toFixed(2)}
                          </Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="subtitle2" fontWeight={700}>Balance Due:</Typography>
                          <Typography
                            variant="subtitle1"
                            fontWeight={700}
                            color={parseFloat(viewDetailModal.data.balance_due) > 0 ? 'warning.dark' : 'text.secondary'}
                          >
                            ${parseFloat(viewDetailModal.data.balance_due || 0).toFixed(2)}
                          </Typography>
                        </Stack>
                      </>
                    )}
                  </Stack>
                </Paper>
              </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button onClick={() => setViewDetailModal({ open: false, type: '', data: null })}>
                Close
              </Button>
              {viewDetailModal.type === 'invoice' &&
                viewDetailModal.data.effective_status !== 'PAID' &&
                viewDetailModal.data.effective_status !== 'CANCELLED' &&
                parseFloat(viewDetailModal.data.balance_due) > 0 && (
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<PaymentIcon />}
                    onClick={() => {
                      const inv = viewDetailModal.data;
                      setViewDetailModal({ open: false, type: '', data: null });
                      handleOpenPaymentDialog(inv);
                    }}
                  >
                    Record Payment
                  </Button>
                )}
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* ============================================================ */}
      {/* DIALOG: CONVERT QUOTATION CONFIRMATION */}
      {/* ============================================================ */}
      <Dialog
        open={convertDialog.open}
        onClose={() => setConvertDialog({ open: false, quotation: null })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Convert Quotation to Order</DialogTitle>
        <DialogContent>
          <Typography variant="body2" gutterBottom>
            Are you sure you want to convert Quotation{' '}
            <strong>{convertDialog.quotation?.quotation_number}</strong> ({convertDialog.quotation?.customer_name}) into a confirmed Sales Order?
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
            This will create a new Sales Order with status <strong>CONFIRMED</strong>, copy all line items, and mark this quotation as <strong>CONVERTED</strong>.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setConvertDialog({ open: false, quotation: null })} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleConvertQuotation}
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={18} /> : <TransformOutlinedIcon />}
          >
            Confirm Conversion
          </Button>
        </DialogActions>
      </Dialog>

      {/* ============================================================ */}
      {/* DIALOG: RESERVE INVENTORY STOCK */}
      {/* ============================================================ */}
      <Dialog
        open={reserveDialog.open}
        onClose={() => setReserveDialog({ open: false, order: null, warehouse: '' })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Reserve Inventory Stock</DialogTitle>
        <DialogContent>
          <Typography variant="body2" gutterBottom>
            Select the fulfillment warehouse to allocate and reserve stock for Order{' '}
            <strong>{reserveDialog.order?.order_number}</strong> ({reserveDialog.order?.customer_name}).
          </Typography>
          <Box sx={{ mt: 2 }}>
            <FormControl fullWidth size="small" required>
              <InputLabel>Fulfillment Warehouse</InputLabel>
              <Select
                value={reserveDialog.warehouse}
                label="Fulfillment Warehouse"
                onChange={(e) => setReserveDialog({ ...reserveDialog, warehouse: e.target.value })}
              >
                {warehouses.map((w) => (
                  <MenuItem key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <Alert severity="info" sx={{ mt: 2, fontSize: '0.8rem' }}>
            Reservation increments <strong>reserved_quantity</strong> and blocks over-allocation. Physical stock will not decrease until fulfillment.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setReserveDialog({ open: false, order: null, warehouse: '' })} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={handleConfirmReserve}
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={18} /> : <BookmarkBorderOutlinedIcon />}
          >
            Confirm Reservation
          </Button>
        </DialogActions>
      </Dialog>

      {/* ============================================================ */}
      {/* DIALOG: RELEASE RESERVATION */}
      {/* ============================================================ */}
      <Dialog
        open={releaseDialog.open}
        onClose={() => setReleaseDialog({ open: false, order: null })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Release Stock Reservation</DialogTitle>
        <DialogContent>
          <Typography variant="body2" gutterBottom>
            Are you sure you want to release the reserved stock for Order{' '}
            <strong>{releaseDialog.order?.order_number}</strong>?
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
            This will release the reserved quantities back into available inventory at the warehouse, and revert the order status to <strong>CONFIRMED</strong>.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setReleaseDialog({ open: false, order: null })} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleConfirmRelease}
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={18} /> : <LockOpenOutlinedIcon />}
          >
            Release Stock
          </Button>
        </DialogActions>
      </Dialog>

      {/* ============================================================ */}
      {/* DIALOG: FULFILL ORDER (STOCK_OUT) */}
      {/* ============================================================ */}
      <Dialog
        open={fulfillDialog.open}
        onClose={() => setFulfillDialog({ open: false, order: null })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Fulfill & Complete Order</DialogTitle>
        <DialogContent>
          <Typography variant="body2" gutterBottom>
            Fulfill Order <strong>{fulfillDialog.order?.order_number}</strong> ({fulfillDialog.order?.customer_name})?
          </Typography>
          <Alert severity="success" sx={{ mt: 2, fontSize: '0.8rem' }}>
            This will physically deduct stock from warehouse <strong>{fulfillDialog.order?.warehouse_name || 'assigned'}</strong>, clear the reservation, record an immutable <strong>STOCK_OUT</strong> transaction, and mark the order as <strong>COMPLETED</strong>.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setFulfillDialog({ open: false, order: null })} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleConfirmFulfill}
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={18} /> : <LocalShippingOutlinedIcon />}
          >
            Confirm Fulfillment
          </Button>
        </DialogActions>
      </Dialog>

      {/* ============================================================ */}
      {/* MODAL: CREATE DIRECT INVOICE */}
      {/* ============================================================ */}
      <Dialog
        open={openInvoiceModal}
        onClose={() => setOpenInvoiceModal(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>New Direct Sales Invoice</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required size="small">
                <InputLabel>Customer</InputLabel>
                <Select
                  value={invoiceForm.customer}
                  label="Customer"
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, customer: e.target.value })}
                >
                  {customers.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name} {c.email ? `(${c.email})` : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Due Date"
                type="date"
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
                value={invoiceForm.due_date}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, due_date: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Notes / Terms"
                fullWidth
                multiline
                rows={2}
                size="small"
                value={invoiceForm.notes}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
              />
            </Grid>

            {/* Line Items */}
            <Grid item xs={12}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1, mt: 1 }}>
                <Typography variant="subtitle2" fontWeight={700}>
                  Line Items
                </Typography>
                <Button size="small" startIcon={<AddIcon />} onClick={addInvoiceItem}>
                  Add Item
                </Button>
              </Stack>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ minWidth: 180 }}>Product</TableCell>
                      <TableCell sx={{ width: 100 }}>Quantity</TableCell>
                      <TableCell sx={{ width: 110 }}>Unit Price ($)</TableCell>
                      <TableCell sx={{ width: 90 }}>Discount ($)</TableCell>
                      <TableCell sx={{ width: 90 }}>Tax ($)</TableCell>
                      <TableCell sx={{ width: 100 }} align="right">Line Total</TableCell>
                      <TableCell sx={{ width: 50 }}></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {invoiceForm.items.map((item, index) => {
                      const lineTot = Math.max(
                        0,
                        (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0) -
                          (parseFloat(item.discount) || 0) +
                          (parseFloat(item.tax) || 0)
                      ).toFixed(2);

                      return (
                        <TableRow key={index}>
                          <TableCell>
                            <FormControl fullWidth size="small">
                              <Select
                                value={item.product}
                                onChange={(e) => handleInvoiceItemChange(index, 'product', e.target.value)}
                              >
                                {products.map((p) => (
                                  <MenuItem key={p.id} value={p.id}>
                                    {p.name} ({p.sku}) - ${parseFloat(p.selling_price).toFixed(2)}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              type="number"
                              value={item.quantity}
                              onChange={(e) => handleInvoiceItemChange(index, 'quantity', e.target.value)}
                              inputProps={{ min: 0.01, step: 1 }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              type="number"
                              value={item.unit_price}
                              onChange={(e) => handleInvoiceItemChange(index, 'unit_price', e.target.value)}
                              inputProps={{ min: 0, step: 0.01 }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              type="number"
                              value={item.discount}
                              onChange={(e) => handleInvoiceItemChange(index, 'discount', e.target.value)}
                              inputProps={{ min: 0, step: 0.01 }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              type="number"
                              value={item.tax}
                              onChange={(e) => handleInvoiceItemChange(index, 'tax', e.target.value)}
                              inputProps={{ min: 0, step: 0.01 }}
                            />
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>
                            ${lineTot}
                          </TableCell>
                          <TableCell>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => removeInvoiceItem(index)}
                              disabled={invoiceForm.items.length <= 1}
                            >
                              <DeleteOutlineOutlinedIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Real-time Summary Box */}
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                <Paper variant="outlined" sx={{ p: 2, minWidth: 260 }}>
                  <Stack spacing={0.5}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">Subtotal:</Typography>
                      <Typography variant="body2">${invoiceTotals.subtotal}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">Total Discount:</Typography>
                      <Typography variant="body2" color="error.main">-${invoiceTotals.discount}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">Estimated Tax:</Typography>
                      <Typography variant="body2">+${invoiceTotals.tax}</Typography>
                    </Stack>
                    <Divider sx={{ my: 0.5 }} />
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="subtitle2" fontWeight={700}>Total Amount:</Typography>
                      <Typography variant="subtitle1" fontWeight={700} color="primary.main">
                        ${invoiceTotals.total}
                      </Typography>
                    </Stack>
                  </Stack>
                </Paper>
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setOpenInvoiceModal(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleCreateInvoice} disabled={submitting}>
            {submitting ? <CircularProgress size={22} /> : 'Save & Issue Invoice'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ============================================================ */}
      {/* DIALOG: GENERATE INVOICE FROM SALES ORDER */}
      {/* ============================================================ */}
      <Dialog
        open={invoiceOrderDialog.open}
        onClose={() => setInvoiceOrderDialog({ open: false, order: null, due_date: '', notes: '' })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Generate Invoice from Order</DialogTitle>
        <DialogContent>
          <Typography variant="body2" gutterBottom>
            Generate an official sales invoice for Order{' '}
            <strong>{invoiceOrderDialog.order?.order_number}</strong> ({invoiceOrderDialog.order?.customer_name})?
          </Typography>
          <Box sx={{ mt: 2 }}>
            <Paper variant="outlined" sx={{ p: 1.5, mb: 2, bgcolor: 'background.default' }}>
              <Stack spacing={0.5}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">Order Total:</Typography>
                  <Typography variant="body2" fontWeight={700}>
                    ${parseFloat(invoiceOrderDialog.order?.total || 0).toFixed(2)}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">Items Count:</Typography>
                  <Typography variant="body2">{invoiceOrderDialog.order?.items_count || 0}</Typography>
                </Stack>
              </Stack>
            </Paper>
            <TextField
              label="Invoice Due Date"
              type="date"
              fullWidth
              size="small"
              sx={{ mb: 2 }}
              InputLabelProps={{ shrink: true }}
              value={invoiceOrderDialog.due_date}
              onChange={(e) => setInvoiceOrderDialog({ ...invoiceOrderDialog, due_date: e.target.value })}
            />
            <TextField
              label="Invoice Notes / Terms"
              fullWidth
              multiline
              rows={2}
              size="small"
              value={invoiceOrderDialog.notes}
              onChange={(e) => setInvoiceOrderDialog({ ...invoiceOrderDialog, notes: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            onClick={() => setInvoiceOrderDialog({ open: false, order: null, due_date: '', notes: '' })}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleConfirmInvoiceOrder}
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={18} /> : <DescriptionOutlinedIcon />}
          >
            Generate Invoice
          </Button>
        </DialogActions>
      </Dialog>

      {/* ============================================================ */}
      {/* DIALOG: RECORD INVOICE PAYMENT */}
      {/* ============================================================ */}
      <Dialog
        open={paymentDialog.open}
        onClose={() => setPaymentDialog({ open: false, invoice: null, amount: '', payment_method: 'BANK_TRANSFER', reference: '', notes: '' })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Record Payment</DialogTitle>
        <DialogContent>
          <Typography variant="body2" gutterBottom>
            Record payment against Invoice <strong>{paymentDialog.invoice?.invoice_number}</strong> ({paymentDialog.invoice?.customer_name}).
          </Typography>
          <Paper variant="outlined" sx={{ p: 1.5, my: 2, bgcolor: 'background.default' }}>
            <Stack spacing={0.5}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="caption" color="text.secondary">Total Invoiced:</Typography>
                <Typography variant="body2">${parseFloat(paymentDialog.invoice?.total || 0).toFixed(2)}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="caption" color="text.secondary">Already Paid:</Typography>
                <Typography variant="body2" color="success.main">${parseFloat(paymentDialog.invoice?.amount_paid || 0).toFixed(2)}</Typography>
              </Stack>
              <Divider sx={{ my: 0.5 }} />
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="subtitle2" fontWeight={700}>Remaining Balance Due:</Typography>
                <Typography variant="subtitle2" fontWeight={700} color="warning.dark">
                  ${parseFloat(paymentDialog.invoice?.balance_due || 0).toFixed(2)}
                </Typography>
              </Stack>
            </Stack>
          </Paper>

          <Stack spacing={2}>
            <TextField
              label="Payment Amount ($)"
              type="number"
              fullWidth
              size="small"
              required
              inputProps={{ min: 0.01, step: 0.01, max: paymentDialog.invoice?.balance_due }}
              value={paymentDialog.amount}
              onChange={(e) => setPaymentDialog({ ...paymentDialog, amount: e.target.value })}
            />
            <FormControl fullWidth size="small" required>
              <InputLabel>Payment Method</InputLabel>
              <Select
                value={paymentDialog.payment_method}
                label="Payment Method"
                onChange={(e) => setPaymentDialog({ ...paymentDialog, payment_method: e.target.value })}
              >
                <MenuItem value="BANK_TRANSFER">Bank Transfer / Wire</MenuItem>
                <MenuItem value="CASH">Cash</MenuItem>
                <MenuItem value="CARD">Credit / Debit Card</MenuItem>
                <MenuItem value="UPI">UPI / Digital Payment</MenuItem>
                <MenuItem value="CHEQUE">Cheque</MenuItem>
                <MenuItem value="OTHER">Other</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Reference / Transaction #"
              fullWidth
              size="small"
              placeholder="e.g. Wire Ref, Cheque #, TXN ID"
              value={paymentDialog.reference}
              onChange={(e) => setPaymentDialog({ ...paymentDialog, reference: e.target.value })}
            />
            <TextField
              label="Payment Notes"
              fullWidth
              multiline
              rows={2}
              size="small"
              value={paymentDialog.notes}
              onChange={(e) => setPaymentDialog({ ...paymentDialog, notes: e.target.value })}
            />
          </Stack>
          <Alert severity="info" sx={{ mt: 2, fontSize: '0.8rem' }}>
            Upon recording this payment, an atomic, immutable receipt will be automatically generated and linked.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            onClick={() => setPaymentDialog({ open: false, invoice: null, amount: '', payment_method: 'BANK_TRANSFER', reference: '', notes: '' })}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleConfirmPayment}
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={18} /> : <PaymentIcon />}
          >
            Record & Generate Receipt
          </Button>
        </DialogActions>
      </Dialog>

      {/* ============================================================ */}
      {/* MODAL: OFFICIAL PAYMENT RECEIPT VOUCHER */}
      {/* ============================================================ */}
      <Dialog
        open={receiptModal.open}
        onClose={() => setReceiptModal({ open: false, receipt: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Payment Receipt Voucher</span>
          {receiptModal.receipt && (
            <Chip
              label="OFFICIAL RECEIPT"
              color="success"
              size="small"
              icon={<CheckCircleOutlineOutlinedIcon />}
            />
          )}
        </DialogTitle>
        <DialogContent dividers>
          {receiptModal.receipt && (
            <Box sx={{ p: 1 }}>
              {/* Receipt Header */}
              <Box sx={{ textAlign: 'center', pb: 2, borderBottom: '1px dashed #ccc', mb: 2 }}>
                <Typography variant="h5" fontWeight={800} color="primary.main">
                  {activeCompany.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Official Payment Receipt • System Generated
                </Typography>
              </Box>

              {/* Receipt Reference Numbers */}
              <Grid container spacing={1.5} sx={{ mb: 2 }}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Receipt Number</Typography>
                  <Typography variant="body1" fontWeight={700} color="success.main">
                    {receiptModal.receipt.receipt_number}
                  </Typography>
                </Grid>
                <Grid item xs={6} sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary">Date</Typography>
                  <Typography variant="body1">
                    {new Date(receiptModal.receipt.receipt_date || receiptModal.receipt.created_at).toLocaleDateString()}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Payment Number</Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {receiptModal.receipt.payment_number}
                  </Typography>
                </Grid>
                <Grid item xs={6} sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary">Against Invoice</Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {receiptModal.receipt.invoice_number}
                  </Typography>
                </Grid>
              </Grid>

              <Divider sx={{ my: 1.5 }} />

              {/* Payer Details */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary">Received From</Typography>
                <Typography variant="subtitle1" fontWeight={700}>
                  {receiptModal.receipt.customer_name}
                </Typography>
                <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    Method: <strong>{receiptModal.receipt.payment_method?.replace('_', ' ')}</strong>
                  </Typography>
                  {receiptModal.receipt.reference && (
                    <Typography variant="caption" color="text.secondary">
                      Ref: <strong>{receiptModal.receipt.reference}</strong>
                    </Typography>
                  )}
                </Stack>
              </Box>

              {/* Prominent Amount Box */}
              <Paper
                variant="outlined"
                sx={{
                  p: 2.5,
                  textAlign: 'center',
                  bgcolor: 'success.lighter',
                  borderColor: 'success.main',
                  borderRadius: 2,
                  mb: 2,
                }}
              >
                <Typography variant="caption" color="text.secondary" textTransform="uppercase" fontWeight={600}>
                  Amount Received
                </Typography>
                <Typography variant="h3" fontWeight={800} color="success.dark">
                  ${parseFloat(receiptModal.receipt.amount_paid).toFixed(2)}
                </Typography>
              </Paper>

              {/* Footer Note */}
              <Box sx={{ textAlign: 'center', pt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Thank you for your business. This document serves as an official confirmation of payment received.
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setReceiptModal({ open: false, receipt: null })}>
            Close
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<PrintOutlinedIcon />}
            onClick={() => window.print()}
          >
            Print Receipt
          </Button>
        </DialogActions>
      </Dialog>

      {/* ============================================================ */}
      {/* PHASE 4D: CUSTOMER SALES HISTORY MODAL */}
      {/* ============================================================ */}
      <Dialog
        open={customerHistoryModal.open}
        onClose={() => setCustomerHistoryModal((prev) => ({ ...prev, open: false }))}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Customer Sales History: {customerHistoryModal.customerName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Comprehensive multi-entity sales audit trail, conversion metrics, and financial records
              </Typography>
            </Box>
            <IconButton onClick={() => setCustomerHistoryModal((prev) => ({ ...prev, open: false }))} size="small">
              <CancelOutlinedIcon />
            </IconButton>
          </Stack>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 3 }}>
          {customerHistoryModal.loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : !customerHistoryModal.data ? (
            <EmptyState title="No customer data available" />
          ) : (
            <Box>
              {/* Customer Profile & Lifetime Metrics */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={2.4}>
                  <Card variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">Total Quoted</Typography>
                    <Typography variant="h6" fontWeight={700} color="primary.main">
                      ${parseFloat(customerHistoryModal.data.metrics?.total_quoted || 0).toFixed(2)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {customerHistoryModal.data.metrics?.quotations_count || 0} quotes
                    </Typography>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                  <Card variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">Total Ordered</Typography>
                    <Typography variant="h6" fontWeight={700} color="info.main">
                      ${parseFloat(customerHistoryModal.data.metrics?.total_ordered || 0).toFixed(2)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {customerHistoryModal.data.metrics?.orders_count || 0} orders
                    </Typography>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                  <Card variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">Total Invoiced</Typography>
                    <Typography variant="h6" fontWeight={700} color="secondary.main">
                      ${parseFloat(customerHistoryModal.data.metrics?.total_invoiced || 0).toFixed(2)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {customerHistoryModal.data.metrics?.invoices_count || 0} invoices
                    </Typography>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                  <Card variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">Total Paid</Typography>
                    <Typography variant="h6" fontWeight={700} color="success.main">
                      ${parseFloat(customerHistoryModal.data.metrics?.total_paid || 0).toFixed(2)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {customerHistoryModal.data.metrics?.payments_count || 0} payments
                    </Typography>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                  <Card
                    variant="outlined"
                    sx={{
                      p: 2,
                      textAlign: 'center',
                      borderColor: parseFloat(customerHistoryModal.data.metrics?.outstanding_balance || 0) > 0 ? 'error.main' : 'divider',
                      bgcolor: parseFloat(customerHistoryModal.data.metrics?.outstanding_balance || 0) > 0 ? 'error.lighter' : 'background.paper',
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">Outstanding Balance</Typography>
                    <Typography
                      variant="h6"
                      fontWeight={700}
                      color={parseFloat(customerHistoryModal.data.metrics?.outstanding_balance || 0) > 0 ? 'error.main' : 'text.primary'}
                    >
                      ${parseFloat(customerHistoryModal.data.metrics?.outstanding_balance || 0).toFixed(2)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Conversion: {parseFloat(customerHistoryModal.data.metrics?.conversion_rate || 0).toFixed(1)}%
                    </Typography>
                  </Card>
                </Grid>
              </Grid>

              {/* Subtabs */}
              <Tabs
                value={customerHistoryModal.tab}
                onChange={(e, val) => setCustomerHistoryModal((prev) => ({ ...prev, tab: val }))}
                sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
              >
                <Tab label={`Quotations (${customerHistoryModal.data.quotations?.length || 0})`} />
                <Tab label={`Orders (${customerHistoryModal.data.orders?.length || 0})`} />
                <Tab label={`Invoices (${customerHistoryModal.data.invoices?.length || 0})`} />
                <Tab label={`Payments (${customerHistoryModal.data.payments?.length || 0})`} />
                <Tab label={`Receipts (${customerHistoryModal.data.receipts?.length || 0})`} />
              </Tabs>

              {/* Tab 0: Quotations */}
              {customerHistoryModal.tab === 0 && (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'action.hover' }}>
                        <TableCell>Quotation #</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell>Valid Until</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell align="center">Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(customerHistoryModal.data.quotations || []).length === 0 ? (
                        <TableRow><TableCell colSpan={5} align="center">No quotations found</TableCell></TableRow>
                      ) : (
                        customerHistoryModal.data.quotations.map((q) => (
                          <TableRow key={q.id} hover>
                            <TableCell sx={{ fontWeight: 600 }}>{q.quotation_number}</TableCell>
                            <TableCell>{q.quotation_date}</TableCell>
                            <TableCell>{q.valid_until || '—'}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600 }}>${parseFloat(q.total_amount).toFixed(2)}</TableCell>
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

              {/* Tab 1: Orders */}
              {customerHistoryModal.tab === 1 && (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'action.hover' }}>
                        <TableCell>Order #</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell>Warehouse</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell align="center">Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(customerHistoryModal.data.orders || []).length === 0 ? (
                        <TableRow><TableCell colSpan={5} align="center">No orders found</TableCell></TableRow>
                      ) : (
                        customerHistoryModal.data.orders.map((o) => (
                          <TableRow key={o.id} hover>
                            <TableCell sx={{ fontWeight: 600 }}>{o.order_number}</TableCell>
                            <TableCell>{o.order_date}</TableCell>
                            <TableCell>{o.warehouse_name || '—'}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600 }}>${parseFloat(o.total_amount).toFixed(2)}</TableCell>
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

              {/* Tab 2: Invoices */}
              {customerHistoryModal.tab === 2 && (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'action.hover' }}>
                        <TableCell>Invoice #</TableCell>
                        <TableCell>Issue Date</TableCell>
                        <TableCell>Due Date</TableCell>
                        <TableCell align="right">Total</TableCell>
                        <TableCell align="right">Paid</TableCell>
                        <TableCell align="right">Balance Due</TableCell>
                        <TableCell align="center">Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(customerHistoryModal.data.invoices || []).length === 0 ? (
                        <TableRow><TableCell colSpan={7} align="center">No invoices found</TableCell></TableRow>
                      ) : (
                        customerHistoryModal.data.invoices.map((inv) => (
                          <TableRow key={inv.id} hover>
                            <TableCell sx={{ fontWeight: 600 }}>{inv.invoice_number}</TableCell>
                            <TableCell>{inv.issue_date}</TableCell>
                            <TableCell>{inv.due_date}</TableCell>
                            <TableCell align="right">${parseFloat(inv.total_amount).toFixed(2)}</TableCell>
                            <TableCell align="right" sx={{ color: 'success.main', fontWeight: 600 }}>${parseFloat(inv.paid_amount).toFixed(2)}</TableCell>
                            <TableCell align="right" sx={{ color: parseFloat(inv.balance_due) > 0 ? 'error.main' : 'text.primary', fontWeight: 600 }}>
                              ${parseFloat(inv.balance_due).toFixed(2)}
                            </TableCell>
                            <TableCell align="center">
                              <Chip label={inv.status} size="small" color={INVOICE_STATUS_COLORS[inv.status] || 'default'} />
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {/* Tab 3: Payments */}
              {customerHistoryModal.tab === 3 && (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'action.hover' }}>
                        <TableCell>Payment #</TableCell>
                        <TableCell>Invoice #</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell>Method</TableCell>
                        <TableCell>Reference</TableCell>
                        <TableCell align="right">Amount Paid</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(customerHistoryModal.data.payments || []).length === 0 ? (
                        <TableRow><TableCell colSpan={6} align="center">No payments found</TableCell></TableRow>
                      ) : (
                        customerHistoryModal.data.payments.map((p) => (
                          <TableRow key={p.id} hover>
                            <TableCell sx={{ fontWeight: 600 }}>{p.payment_number}</TableCell>
                            <TableCell>{p.invoice_number}</TableCell>
                            <TableCell>{p.payment_date}</TableCell>
                            <TableCell><Chip label={p.payment_method?.replace('_', ' ')} size="small" variant="outlined" /></TableCell>
                            <TableCell>{p.reference || '—'}</TableCell>
                            <TableCell align="right" sx={{ color: 'success.main', fontWeight: 700 }}>
                              ${parseFloat(p.amount_paid).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {/* Tab 4: Receipts */}
              {customerHistoryModal.tab === 4 && (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'action.hover' }}>
                        <TableCell>Receipt #</TableCell>
                        <TableCell>Payment #</TableCell>
                        <TableCell>Invoice #</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell align="right">Amount Paid</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(customerHistoryModal.data.receipts || []).length === 0 ? (
                        <TableRow><TableCell colSpan={5} align="center">No receipts found</TableCell></TableRow>
                      ) : (
                        customerHistoryModal.data.receipts.map((r) => (
                          <TableRow key={r.id} hover>
                            <TableCell sx={{ fontWeight: 600, color: 'success.main' }}>{r.receipt_number}</TableCell>
                            <TableCell>{r.payment_number}</TableCell>
                            <TableCell>{r.invoice_number}</TableCell>
                            <TableCell>{new Date(r.receipt_date || r.created_at).toLocaleDateString()}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>
                              ${parseFloat(r.amount_paid).toFixed(2)}
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
          <Button onClick={() => setCustomerHistoryModal((prev) => ({ ...prev, open: false }))}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* ============================================================ */}
      {/* PHASE 4D: SALES RETURN MODAL */}
      {/* ============================================================ */}
      <Dialog
        open={returnModal.open}
        onClose={() => !submitting && setReturnModal({ open: false, order: null, reason: '', items: [] })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" fontWeight={700}>
            Process Sales Return - Order {returnModal.order?.order_number}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Return fulfilled items back into warehouse inventory ({returnModal.order?.warehouse_name || 'Warehouse'})
          </Typography>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 3 }}>
          <Alert severity="info" sx={{ mb: 2.5 }}>
            Processing this return creates a formal <strong>SalesReturn</strong> audit record, immediately increments physical stock in warehouse <strong>{returnModal.order?.warehouse_name || 'default'}</strong>, and writes an immutable <strong>STOCK_IN</strong> transaction.
          </Alert>

          <TextField
            fullWidth
            label="Return Reason / Customer Feedback"
            value={returnModal.reason}
            onChange={(e) => setReturnModal((prev) => ({ ...prev, reason: e.target.value }))}
            sx={{ mb: 2.5 }}
            placeholder="e.g., Defective product, customer cancelled order, wrong item delivered"
          />

          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
            Select Quantities to Return
          </Typography>

          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell>Product</TableCell>
                  <TableCell align="right">Delivered Qty</TableCell>
                  <TableCell align="right">Unit Price</TableCell>
                  <TableCell align="right" sx={{ width: 140 }}>Return Qty</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {returnModal.items.map((item, idx) => (
                  <TableRow key={item.sales_order_item || idx}>
                    <TableCell sx={{ fontWeight: 600 }}>{item.product_name}</TableCell>
                    <TableCell align="right">{parseFloat(item.max_quantity).toFixed(2)}</TableCell>
                    <TableCell align="right">${parseFloat(item.unit_price || 0).toFixed(2)}</TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small"
                        type="number"
                        inputProps={{ min: 0, max: item.max_quantity, step: '1' }}
                        value={item.quantity}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(parseFloat(item.max_quantity), parseFloat(e.target.value) || 0));
                          const newItems = [...returnModal.items];
                          newItems[idx] = { ...item, quantity: val };
                          setReturnModal((prev) => ({ ...prev, items: newItems }));
                        }}
                        sx={{ width: 100 }}
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
            onClick={() => setReturnModal({ open: false, order: null, reason: '', items: [] })}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="warning"
            startIcon={submitting ? <CircularProgress size={18} /> : <AssignmentReturnOutlinedIcon />}
            onClick={handleProcessReturn}
            disabled={submitting || returnModal.items.every((i) => parseFloat(i.quantity || 0) <= 0)}
          >
            {submitting ? 'Processing Return...' : 'Confirm Return & Restore Stock'}
          </Button>
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
