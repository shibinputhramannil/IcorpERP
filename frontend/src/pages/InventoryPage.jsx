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

// Icons
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import SearchIcon from '@mui/icons-material/Search';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import MonetizationOnOutlinedIcon from '@mui/icons-material/MonetizationOnOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';

import PageHeader from '../components/common/PageHeader';
import EmptyState from '../components/common/EmptyState';
import LoadingState from '../components/common/LoadingState';
import StatCard from '../components/common/StatCard';
import inventoryService from '../services/inventoryService';
import { useCompany } from '../context/CompanyContext';

const TX_TYPE_COLORS = {
  STOCK_IN: 'success',
  STOCK_OUT: 'error',
  ADJUSTMENT: 'info',
  TRANSFER: 'secondary',
};

export default function InventoryPage() {
  const { activeCompany } = useCompany();

  // Tab: 0=Dashboard, 1=Products, 2=Stock Levels, 3=Transactions, 4=Warehouses, 5=Categories, 6=Vendors
  const [currentTab, setCurrentTab] = useState(0);

  // Data states
  const [dashboard, setDashboard] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [stockList, setStockList] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [vendors, setVendors] = useState([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState('ALL');
  const [selectedTxTypeFilter, setSelectedTxTypeFilter] = useState('ALL');

  // Loading & Feedback
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Dialog States
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [isEditingProduct, setIsEditingProduct] = useState(false);
  const [productFormData, setProductFormData] = useState({
    id: null,
    name: '',
    sku: '',
    category: '',
    unit: 'pcs',
    cost_price: '',
    selling_price: '',
    tax: '0.00',
    reorder_level: 10,
    description: '',
  });

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [categoryFormData, setCategoryFormData] = useState({ id: null, name: '', description: '' });

  const [warehouseDialogOpen, setWarehouseDialogOpen] = useState(false);
  const [isEditingWarehouse, setIsEditingWarehouse] = useState(false);
  const [warehouseFormData, setWarehouseFormData] = useState({ id: null, name: '', code: '', address: '' });

  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [isEditingVendor, setIsEditingVendor] = useState(false);
  const [vendorFormData, setVendorFormData] = useState({ id: null, name: '', email: '', phone: '', address: '', tax_id: '' });

  const [movementDialogOpen, setMovementDialogOpen] = useState(false);
  const [movementFormData, setMovementFormData] = useState({
    product: '',
    warehouse: '',
    destination_warehouse: '',
    transaction_type: 'STOCK_IN',
    quantity: '',
    reference: '',
    notes: '',
  });

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState(null); // { type, id, label }

  const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
  const [activeItem, setActiveItem] = useState(null);

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  // Load Data for active tab
  const fetchData = useCallback(async () => {
    if (!activeCompany?.id) return;
    try {
      setLoading(true);
      setError(null);

      if (currentTab === 0) {
        const data = await inventoryService.getDashboard(activeCompany.id);
        setDashboard(data);
      } else if (currentTab === 1) {
        const params = { all: 'true' };
        if (selectedCategoryFilter !== 'ALL') params.category = selectedCategoryFilter;
        if (searchQuery.trim()) params.search = searchQuery.trim();
        const [prods, cats] = await Promise.all([
          inventoryService.getProducts(activeCompany.id, params),
          inventoryService.getCategories(activeCompany.id, { all: 'true' }),
        ]);
        setProducts(prods);
        setCategories(cats);
      } else if (currentTab === 2) {
        const params = {};
        if (selectedWarehouseFilter !== 'ALL') params.warehouse = selectedWarehouseFilter;
        if (searchQuery.trim()) params.search = searchQuery.trim();
        const [stocks, whs] = await Promise.all([
          inventoryService.getStock(activeCompany.id, params),
          inventoryService.getWarehouses(activeCompany.id, { all: 'true' }),
        ]);
        setStockList(stocks);
        setWarehouses(whs);
      } else if (currentTab === 3) {
        const params = {};
        if (selectedTxTypeFilter !== 'ALL') params.type = selectedTxTypeFilter;
        if (selectedWarehouseFilter !== 'ALL') params.warehouse = selectedWarehouseFilter;
        const [txs, prods, whs] = await Promise.all([
          inventoryService.getTransactions(activeCompany.id, params),
          inventoryService.getProducts(activeCompany.id, { all: 'true' }),
          inventoryService.getWarehouses(activeCompany.id, { all: 'true' }),
        ]);
        setTransactions(txs);
        setProducts(prods);
        setWarehouses(whs);
      } else if (currentTab === 4) {
        const params = { all: 'true' };
        if (searchQuery.trim()) params.search = searchQuery.trim();
        const data = await inventoryService.getWarehouses(activeCompany.id, params);
        setWarehouses(data);
      } else if (currentTab === 5) {
        const params = { all: 'true' };
        const data = await inventoryService.getCategories(activeCompany.id, params);
        setCategories(data);
      } else if (currentTab === 6) {
        const params = { all: 'true' };
        if (searchQuery.trim()) params.search = searchQuery.trim();
        const data = await inventoryService.getVendors(activeCompany.id, params);
        setVendors(data);
      }
    } catch (err) {
      console.error('Failed to load inventory data:', err);
      setError('Unable to load inventory data for this company.');
    } finally {
      setLoading(false);
    }
  }, [activeCompany, currentTab, selectedCategoryFilter, selectedWarehouseFilter, selectedTxTypeFilter, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleTabChange = (e, val) => {
    setCurrentTab(val);
    setSearchQuery('');
  };

  const handleOpenMenu = (e, item) => {
    setActionMenuAnchor(e.currentTarget);
    setActiveItem(item);
  };

  const handleCloseMenu = () => {
    setActionMenuAnchor(null);
  };

  // ============================================================
  // PRODUCT HANDLERS
  // ============================================================
  const handleOpenCreateProduct = async () => {
    try {
      const cats = await inventoryService.getCategories(activeCompany.id, { all: 'true' });
      setCategories(cats);
    } catch (e) {
      console.error(e);
    }
    setIsEditingProduct(false);
    setProductFormData({
      id: null,
      name: '',
      sku: '',
      category: '',
      unit: 'pcs',
      cost_price: '',
      selling_price: '',
      tax: '0.00',
      reorder_level: 10,
      description: '',
    });
    setProductDialogOpen(true);
  };

  const handleOpenEditProduct = (prod) => {
    handleCloseMenu();
    setIsEditingProduct(true);
    setProductFormData({
      id: prod.id,
      name: prod.name || '',
      sku: prod.sku || '',
      category: prod.category || '',
      unit: prod.unit || 'pcs',
      cost_price: prod.cost_price || '',
      selling_price: prod.selling_price || '',
      tax: prod.tax || '0.00',
      reorder_level: prod.reorder_level || 10,
      description: prod.description || '',
    });
    setProductDialogOpen(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!productFormData.name.trim()) return showSnackbar('Product name is required', 'error');
    if (!productFormData.sku.trim()) return showSnackbar('SKU is required', 'error');

    try {
      setSubmitting(true);
      const payload = {
        ...productFormData,
        category: productFormData.category || null,
        cost_price: productFormData.cost_price ? parseFloat(productFormData.cost_price) : 0,
        selling_price: productFormData.selling_price ? parseFloat(productFormData.selling_price) : 0,
        tax: productFormData.tax ? parseFloat(productFormData.tax) : 0,
        reorder_level: parseInt(productFormData.reorder_level, 10) || 10,
      };

      if (isEditingProduct) {
        await inventoryService.updateProduct(activeCompany.id, productFormData.id, payload);
        showSnackbar('Product updated successfully');
      } else {
        await inventoryService.createProduct(activeCompany.id, payload);
        showSnackbar('Product created successfully');
      }
      setProductDialogOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.sku?.[0] || 'Failed to save product';
      showSnackbar(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================
  // STOCK MOVEMENT HANDLERS
  // ============================================================
  const handleOpenMovementModal = async (preselectedProduct = null, preselectedWarehouse = null, type = 'STOCK_IN') => {
    try {
      const [prods, whs] = await Promise.all([
        inventoryService.getProducts(activeCompany.id, { all: 'true' }),
        inventoryService.getWarehouses(activeCompany.id, { all: 'true' }),
      ]);
      setProducts(prods);
      setWarehouses(whs);

      setMovementFormData({
        product: preselectedProduct ? preselectedProduct.id : prods.length > 0 ? prods[0].id : '',
        warehouse: preselectedWarehouse ? preselectedWarehouse.id : whs.length > 0 ? whs[0].id : '',
        destination_warehouse: '',
        transaction_type: type,
        quantity: '',
        reference: '',
        notes: '',
      });
      setMovementDialogOpen(true);
    } catch (e) {
      console.error(e);
      showSnackbar('Failed to load products or warehouses', 'error');
    }
  };

  const handleExecuteMovement = async (e) => {
    e.preventDefault();
    if (!movementFormData.product) return showSnackbar('Product is required', 'error');
    if (!movementFormData.warehouse) return showSnackbar('Warehouse is required', 'error');
    if (!movementFormData.quantity || parseFloat(movementFormData.quantity) <= 0) {
      return showSnackbar('Quantity must be greater than zero', 'error');
    }
    if (movementFormData.transaction_type === 'TRANSFER' && !movementFormData.destination_warehouse) {
      return showSnackbar('Destination warehouse is required for transfer', 'error');
    }

    try {
      setSubmitting(true);
      const payload = {
        ...movementFormData,
        quantity: parseFloat(movementFormData.quantity),
        destination_warehouse: movementFormData.transaction_type === 'TRANSFER' ? movementFormData.destination_warehouse : null,
      };
      await inventoryService.createTransaction(activeCompany.id, payload);
      showSnackbar(`Stock movement recorded successfully (${movementFormData.transaction_type})`);
      setMovementDialogOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.quantity?.[0] || err.response?.data?.detail || 'Stock movement failed';
      showSnackbar(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================
  // WAREHOUSE HANDLERS
  // ============================================================
  const handleOpenCreateWarehouse = () => {
    setIsEditingWarehouse(false);
    setWarehouseFormData({ id: null, name: '', code: '', address: '' });
    setWarehouseDialogOpen(true);
  };

  const handleOpenEditWarehouse = (wh) => {
    handleCloseMenu();
    setIsEditingWarehouse(true);
    setWarehouseFormData({ id: wh.id, name: wh.name || '', code: wh.code || '', address: wh.address || '' });
    setWarehouseDialogOpen(true);
  };

  const handleSaveWarehouse = async (e) => {
    e.preventDefault();
    if (!warehouseFormData.name.trim()) return showSnackbar('Warehouse name is required', 'error');
    if (!warehouseFormData.code.trim()) return showSnackbar('Warehouse code is required', 'error');

    try {
      setSubmitting(true);
      if (isEditingWarehouse) {
        await inventoryService.updateWarehouse(activeCompany.id, warehouseFormData.id, warehouseFormData);
        showSnackbar('Warehouse updated successfully');
      } else {
        await inventoryService.createWarehouse(activeCompany.id, warehouseFormData);
        showSnackbar('Warehouse created successfully');
      }
      setWarehouseDialogOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.code?.[0] || 'Failed to save warehouse';
      showSnackbar(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================
  // CATEGORY HANDLERS
  // ============================================================
  const handleOpenCreateCategory = () => {
    setIsEditingCategory(false);
    setCategoryFormData({ id: null, name: '', description: '' });
    setCategoryDialogOpen(true);
  };

  const handleOpenEditCategory = (cat) => {
    handleCloseMenu();
    setIsEditingCategory(true);
    setCategoryFormData({ id: cat.id, name: cat.name || '', description: cat.description || '' });
    setCategoryDialogOpen(true);
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!categoryFormData.name.trim()) return showSnackbar('Category name is required', 'error');

    try {
      setSubmitting(true);
      if (isEditingCategory) {
        await inventoryService.updateCategory(activeCompany.id, categoryFormData.id, categoryFormData);
        showSnackbar('Category updated successfully');
      } else {
        await inventoryService.createCategory(activeCompany.id, categoryFormData);
        showSnackbar('Category created successfully');
      }
      setCategoryDialogOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.name?.[0] || 'Failed to save category';
      showSnackbar(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================
  // VENDOR HANDLERS
  // ============================================================
  const handleOpenCreateVendor = () => {
    setIsEditingVendor(false);
    setVendorFormData({ id: null, name: '', email: '', phone: '', address: '', tax_id: '' });
    setVendorDialogOpen(true);
  };

  const handleOpenEditVendor = (vend) => {
    handleCloseMenu();
    setIsEditingVendor(true);
    setVendorFormData({
      id: vend.id,
      name: vend.name || '',
      email: vend.email || '',
      phone: vend.phone || '',
      address: vend.address || '',
      tax_id: vend.tax_id || '',
    });
    setVendorDialogOpen(true);
  };

  const handleSaveVendor = async (e) => {
    e.preventDefault();
    if (!vendorFormData.name.trim()) return showSnackbar('Vendor name is required', 'error');

    try {
      setSubmitting(true);
      if (isEditingVendor) {
        await inventoryService.updateVendor(activeCompany.id, vendorFormData.id, vendorFormData);
        showSnackbar('Vendor updated successfully');
      } else {
        await inventoryService.createVendor(activeCompany.id, vendorFormData);
        showSnackbar('Vendor created successfully');
      }
      setVendorDialogOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      showSnackbar('Failed to save vendor', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================
  // DELETION / DEACTIVATION
  // ============================================================
  const handleConfirmDelete = async () => {
    if (!deletingItem) return;
    try {
      setSubmitting(true);
      const { type, id } = deletingItem;
      if (type === 'product') await inventoryService.deleteProduct(activeCompany.id, id);
      else if (type === 'warehouse') await inventoryService.deleteWarehouse(activeCompany.id, id);
      else if (type === 'category') await inventoryService.deleteCategory(activeCompany.id, id);
      else if (type === 'vendor') await inventoryService.deleteVendor(activeCompany.id, id);

      showSnackbar('Item deactivated successfully');
      setDeleteConfirmOpen(false);
      setDeletingItem(null);
      fetchData();
    } catch (err) {
      console.error(err);
      showSnackbar('Failed to deactivate item', 'error');
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
          description="Please select an active company from the top navigation bar to manage your inventory."
        />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Inventory & Stock Management"
        subtitle={`Products, warehouses, live stock levels, and audit movements for ${activeCompany.name}.`}
        breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Inventory' }]}
        action={
          <Stack direction="row" spacing={1}>
            <Tooltip title="Refresh Inventory Data">
              <IconButton onClick={fetchData} color="primary" sx={{ border: 1, borderColor: 'divider' }}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            {currentTab === 1 && (
              <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={handleOpenCreateProduct}>
                Add Product
              </Button>
            )}
            {(currentTab === 2 || currentTab === 3) && (
              <Button variant="contained" color="primary" startIcon={<SwapHorizOutlinedIcon />} onClick={() => handleOpenMovementModal()}>
                New Movement
              </Button>
            )}
            {currentTab === 4 && (
              <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={handleOpenCreateWarehouse}>
                Add Warehouse
              </Button>
            )}
            {currentTab === 5 && (
              <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={handleOpenCreateCategory}>
                Add Category
              </Button>
            )}
            {currentTab === 6 && (
              <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={handleOpenCreateVendor}>
                Add Vendor
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
          aria-label="inventory navigation tabs"
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.875rem',
              minHeight: 48,
            },
          }}
        >
          <Tab icon={<DashboardOutlinedIcon fontSize="small" />} iconPosition="start" label="Dashboard" />
          <Tab icon={<Inventory2OutlinedIcon fontSize="small" />} iconPosition="start" label="Products" />
          <Tab icon={<LayersOutlinedIcon fontSize="small" />} iconPosition="start" label="Stock Levels" />
          <Tab icon={<SwapHorizOutlinedIcon fontSize="small" />} iconPosition="start" label="Stock Movements" />
          <Tab icon={<ApartmentOutlinedIcon fontSize="small" />} iconPosition="start" label="Warehouses" />
          <Tab icon={<CategoryOutlinedIcon fontSize="small" />} iconPosition="start" label="Categories" />
          <Tab icon={<LocalShippingOutlinedIcon fontSize="small" />} iconPosition="start" label="Vendors" />
        </Tabs>
      </Box>

      {/* Loading & Error States */}
      {loading && !submitting && <LoadingState message="Connecting to Inventory backend..." />}
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* ============================================================ */}
      {/* TAB 0: DASHBOARD */}
      {/* ============================================================ */}
      {currentTab === 0 && !loading && dashboard && (
        <Box>
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Total Products"
                value={dashboard.metrics.total_products}
                subtitle={`${dashboard.metrics.active_products} Active SKUs`}
                icon={Inventory2OutlinedIcon}
                color="#2563eb"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Stock Valuation"
                value={`$${Number(dashboard.metrics.stock_valuation).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                subtitle="Based on cost price"
                icon={MonetizationOnOutlinedIcon}
                color="#059669"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Total Stock Units"
                value={dashboard.metrics.total_stock_quantity}
                subtitle={`Across ${dashboard.metrics.total_warehouses} warehouses`}
                icon={LayersOutlinedIcon}
                color="#0284c7"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Stock Alerts"
                value={dashboard.metrics.low_stock_count + dashboard.metrics.out_of_stock_count}
                subtitle={`${dashboard.metrics.low_stock_count} Low, ${dashboard.metrics.out_of_stock_count} Out`}
                icon={WarningAmberOutlinedIcon}
                color="#dc2626"
              />
            </Grid>
          </Grid>

          {/* Quick Actions Row */}
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
                Quick Operations
              </Typography>
              <Stack direction="row" spacing={2} flexWrap="wrap">
                <Button variant="outlined" startIcon={<AddIcon />} onClick={handleOpenCreateProduct}>
                  New Product
                </Button>
                <Button variant="outlined" color="success" startIcon={<SwapHorizOutlinedIcon />} onClick={() => handleOpenMovementModal(null, null, 'STOCK_IN')}>
                  Stock In
                </Button>
                <Button variant="outlined" color="error" startIcon={<SwapHorizOutlinedIcon />} onClick={() => handleOpenMovementModal(null, null, 'STOCK_OUT')}>
                  Stock Out
                </Button>
                <Button variant="outlined" color="secondary" startIcon={<SwapHorizOutlinedIcon />} onClick={() => handleOpenMovementModal(null, null, 'TRANSFER')}>
                  Warehouse Transfer
                </Button>
                <Button variant="outlined" startIcon={<ApartmentOutlinedIcon />} onClick={handleOpenCreateWarehouse}>
                  New Warehouse
                </Button>
              </Stack>
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                Recent Stock Movements
              </Typography>
              {dashboard.recent_transactions.length === 0 ? (
                <EmptyState
                  icon={SwapHorizOutlinedIcon}
                  title="No Stock Movements Yet"
                  description="Begin tracking inventory movements by creating stock-in deliveries or transfers."
                />
              ) : (
                <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: 'grey.50' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Product</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Facility</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Quantity</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Reference</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>By</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {dashboard.recent_transactions.map((tx) => (
                        <TableRow key={tx.id} hover>
                          <TableCell sx={{ fontSize: '0.8rem' }}>{new Date(tx.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Chip label={tx.transaction_type} size="small" color={TX_TYPE_COLORS[tx.transaction_type] || 'default'} />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{tx.product_name}</Typography>
                            <Typography variant="caption" color="text.secondary">{tx.product_sku}</Typography>
                          </TableCell>
                          <TableCell>
                            {tx.warehouse_code}
                            {tx.destination_warehouse_code && ` → ${tx.destination_warehouse_code}`}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>{tx.quantity}</TableCell>
                          <TableCell>{tx.reference || '-'}</TableCell>
                          <TableCell>{tx.created_by_name || 'System'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Box>
      )}

      {/* ============================================================ */}
      {/* TAB 1: PRODUCTS */}
      {/* ============================================================ */}
      {currentTab === 1 && !loading && (
        <Box>
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={6} md={5}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Search by product name, SKU, description..."
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
                    <InputLabel>Filter by Category</InputLabel>
                    <Select
                      value={selectedCategoryFilter}
                      label="Filter by Category"
                      onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                    >
                      <MenuItem value="ALL">All Categories</MenuItem>
                      {categories.map((c) => (
                        <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {products.length === 0 ? (
            <EmptyState
              icon={Inventory2OutlinedIcon}
              title="No Products Found"
              description="Add items to your inventory catalogue to begin tracking stock levels."
              actionLabel="Add Product"
              onAction={handleOpenCreateProduct}
            />
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
              <Table>
                <TableHead sx={{ bgcolor: 'grey.50' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Item Details</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>SKU</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Cost Price</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Selling Price</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Available Stock</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Reorder At</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {products.map((prod) => (
                    <TableRow key={prod.id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{prod.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{prod.unit}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={prod.sku} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>{prod.category_name || '-'}</TableCell>
                      <TableCell>${Number(prod.cost_price).toFixed(2)}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>${Number(prod.selling_price).toFixed(2)}</TableCell>
                      <TableCell>
                        <Chip
                          label={`${prod.total_available_stock} ${prod.unit}`}
                          size="small"
                          color={
                            Number(prod.total_available_stock) === 0
                              ? 'error'
                              : Number(prod.total_available_stock) <= prod.reorder_level
                              ? 'warning'
                              : 'success'
                          }
                        />
                      </TableCell>
                      <TableCell>{prod.reorder_level}</TableCell>
                      <TableCell>
                        <Chip label={prod.is_active ? 'Active' : 'Inactive'} size="small" color={prod.is_active ? 'primary' : 'default'} />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Tooltip title="Stock In">
                            <IconButton size="small" color="success" onClick={() => handleOpenMovementModal(prod, null, 'STOCK_IN')}>
                              <AddIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <IconButton size="small" onClick={(e) => handleOpenMenu(e, { ...prod, entityType: 'product' })}>
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

      {/* ============================================================ */}
      {/* TAB 2: STOCK LEVELS */}
      {/* ============================================================ */}
      {currentTab === 2 && !loading && (
        <Box>
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={6} md={5}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Search stock by product or warehouse..."
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
                    <InputLabel>Filter by Warehouse</InputLabel>
                    <Select
                      value={selectedWarehouseFilter}
                      label="Filter by Warehouse"
                      onChange={(e) => setSelectedWarehouseFilter(e.target.value)}
                    >
                      <MenuItem value="ALL">All Warehouses</MenuItem>
                      {warehouses.map((wh) => (
                        <MenuItem key={wh.id} value={wh.id}>{wh.name} ({wh.code})</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {stockList.length === 0 ? (
            <EmptyState
              icon={LayersOutlinedIcon}
              title="No Stock Records"
              description="Stock entries will appear here once inventory items are added to warehouses."
              actionLabel="Receive Stock"
              onAction={() => handleOpenMovementModal()}
            />
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
              <Table>
                <TableHead sx={{ bgcolor: 'grey.50' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Product Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>SKU</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Warehouse</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Total Qty</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Reserved</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Available</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Reorder Threshold</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Health</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Quick Movement</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stockList.map((stk) => (
                    <TableRow key={stk.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{stk.product_name}</TableCell>
                      <TableCell><Chip label={stk.product_sku} size="small" variant="outlined" /></TableCell>
                      <TableCell>{stk.warehouse_name} ({stk.warehouse_code})</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{stk.quantity} {stk.product_unit}</TableCell>
                      <TableCell>{stk.reserved_quantity}</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: Number(stk.available_quantity) <= 0 ? 'error.main' : 'success.main' }}>
                        {stk.available_quantity} {stk.product_unit}
                      </TableCell>
                      <TableCell>{stk.reorder_level}</TableCell>
                      <TableCell>
                        <Chip
                          label={stk.is_low_stock ? 'Low Stock' : 'Optimal'}
                          size="small"
                          color={stk.is_low_stock ? 'warning' : 'success'}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleOpenMovementModal({ id: stk.product }, { id: stk.warehouse }, 'STOCK_IN')}
                          >
                            Add Stock
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="secondary"
                            onClick={() => handleOpenMovementModal({ id: stk.product }, { id: stk.warehouse }, 'TRANSFER')}
                          >
                            Transfer
                          </Button>
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
      {/* TAB 3: TRANSACTIONS & MOVEMENTS */}
      {/* ============================================================ */}
      {currentTab === 3 && !loading && (
        <Box>
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Filter by Transaction Type</InputLabel>
                    <Select
                      value={selectedTxTypeFilter}
                      label="Filter by Transaction Type"
                      onChange={(e) => setSelectedTxTypeFilter(e.target.value)}
                    >
                      <MenuItem value="ALL">All Types</MenuItem>
                      <MenuItem value="STOCK_IN">Stock In</MenuItem>
                      <MenuItem value="STOCK_OUT">Stock Out</MenuItem>
                      <MenuItem value="TRANSFER">Transfer</MenuItem>
                      <MenuItem value="ADJUSTMENT">Adjustment</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {transactions.length === 0 ? (
            <EmptyState
              icon={SwapHorizOutlinedIcon}
              title="No Movements Recorded"
              description="Inventory audit entries are automatically written whenever stock is received, deducted, or transferred."
              actionLabel="New Movement"
              onAction={() => handleOpenMovementModal()}
            />
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
              <Table>
                <TableHead sx={{ bgcolor: 'grey.50' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Timestamp</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Product</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Source Facility</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Destination</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Quantity</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Reference</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Notes</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Logged By</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id} hover>
                      <TableCell sx={{ fontSize: '0.8rem' }}>{new Date(tx.created_at).toLocaleString()}</TableCell>
                      <TableCell>
                        <Chip label={tx.transaction_type} size="small" color={TX_TYPE_COLORS[tx.transaction_type] || 'default'} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{tx.product_name}</Typography>
                        <Typography variant="caption" color="text.secondary">{tx.product_sku}</Typography>
                      </TableCell>
                      <TableCell>{tx.warehouse_name} ({tx.warehouse_code})</TableCell>
                      <TableCell>{tx.destination_warehouse_code ? `${tx.destination_warehouse_name} (${tx.destination_warehouse_code})` : '-'}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{tx.quantity}</TableCell>
                      <TableCell>{tx.reference || '-'}</TableCell>
                      <TableCell sx={{ maxWidth: 200 }}><Typography variant="caption">{tx.notes || '-'}</Typography></TableCell>
                      <TableCell>{tx.created_by_name || 'System'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* ============================================================ */}
      {/* TAB 4: WAREHOUSES */}
      {/* ============================================================ */}
      {currentTab === 4 && !loading && (
        <Box>
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search warehouses by name or code..."
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

          {warehouses.length === 0 ? (
            <EmptyState
              icon={ApartmentOutlinedIcon}
              title="No Warehouses Found"
              description="Register storage facilities, stockrooms, or fulfillment centers."
              actionLabel="Add Warehouse"
              onAction={handleOpenCreateWarehouse}
            />
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
              <Table>
                <TableHead sx={{ bgcolor: 'grey.50' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Facility Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Code</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Location Address</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Total Items In Stock</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {warehouses.map((wh) => (
                    <TableRow key={wh.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{wh.name}</TableCell>
                      <TableCell><Chip label={wh.code} size="small" variant="outlined" color="primary" /></TableCell>
                      <TableCell>{wh.address || '-'}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{wh.total_stock_count} units</TableCell>
                      <TableCell>
                        <Chip label={wh.is_active ? 'Active' : 'Inactive'} size="small" color={wh.is_active ? 'primary' : 'default'} />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={(e) => handleOpenMenu(e, { ...wh, entityType: 'warehouse' })}>
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

      {/* ============================================================ */}
      {/* TAB 5: CATEGORIES */}
      {/* ============================================================ */}
      {currentTab === 5 && !loading && (
        <Box>
          {categories.length === 0 ? (
            <EmptyState
              icon={CategoryOutlinedIcon}
              title="No Categories Found"
              description="Organize your product catalogue by defining product categories."
              actionLabel="Add Category"
              onAction={handleOpenCreateCategory}
            />
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
              <Table>
                <TableHead sx={{ bgcolor: 'grey.50' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Category Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Products Count</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {categories.map((cat) => (
                    <TableRow key={cat.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{cat.name}</TableCell>
                      <TableCell>{cat.description || '-'}</TableCell>
                      <TableCell>{cat.products_count || 0} products</TableCell>
                      <TableCell>
                        <Chip label={cat.is_active ? 'Active' : 'Inactive'} size="small" color={cat.is_active ? 'primary' : 'default'} />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={(e) => handleOpenMenu(e, { ...cat, entityType: 'category' })}>
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

      {/* ============================================================ */}
      {/* TAB 6: VENDORS */}
      {/* ============================================================ */}
      {currentTab === 6 && !loading && (
        <Box>
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search vendors by name, email, phone, or tax ID..."
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

          {vendors.length === 0 ? (
            <EmptyState
              icon={LocalShippingOutlinedIcon}
              title="No Vendors Found"
              description="Register external suppliers and vendors to manage stock procurement."
              actionLabel="Add Vendor"
              onAction={handleOpenCreateVendor}
            />
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
              <Table>
                <TableHead sx={{ bgcolor: 'grey.50' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Vendor / Supplier Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Phone</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Tax / VAT ID</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Address</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {vendors.map((vend) => (
                    <TableRow key={vend.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{vend.name}</TableCell>
                      <TableCell>{vend.email || '-'}</TableCell>
                      <TableCell>{vend.phone || '-'}</TableCell>
                      <TableCell><Chip label={vend.tax_id || '-'} size="small" variant="outlined" /></TableCell>
                      <TableCell>{vend.address || '-'}</TableCell>
                      <TableCell>
                        <Chip label={vend.is_active ? 'Active' : 'Inactive'} size="small" color={vend.is_active ? 'primary' : 'default'} />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={(e) => handleOpenMenu(e, { ...vend, entityType: 'vendor' })}>
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

      {/* ============================================================ */}
      {/* CONTEXT MENU */}
      {/* ============================================================ */}
      <Menu anchorEl={actionMenuAnchor} open={Boolean(actionMenuAnchor)} onClose={handleCloseMenu}>
        {activeItem?.entityType === 'product' && [
          <MenuItem key="edit" onClick={() => handleOpenEditProduct(activeItem)}>
            <ListItemIcon><EditOutlinedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Edit Product</ListItemText>
          </MenuItem>,
          <MenuItem
            key="del"
            onClick={() => {
              handleCloseMenu();
              setDeletingItem({ type: 'product', id: activeItem.id, label: activeItem.name });
              setDeleteConfirmOpen(true);
            }}
          >
            <ListItemIcon><DeleteOutlineOutlinedIcon fontSize="small" color="error" /></ListItemIcon>
            <ListItemText sx={{ color: 'error.main' }}>Deactivate Product</ListItemText>
          </MenuItem>,
        ]}

        {activeItem?.entityType === 'warehouse' && [
          <MenuItem key="edit" onClick={() => handleOpenEditWarehouse(activeItem)}>
            <ListItemIcon><EditOutlinedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Edit Warehouse</ListItemText>
          </MenuItem>,
          <MenuItem
            key="del"
            onClick={() => {
              handleCloseMenu();
              setDeletingItem({ type: 'warehouse', id: activeItem.id, label: activeItem.name });
              setDeleteConfirmOpen(true);
            }}
          >
            <ListItemIcon><DeleteOutlineOutlinedIcon fontSize="small" color="error" /></ListItemIcon>
            <ListItemText sx={{ color: 'error.main' }}>Deactivate Warehouse</ListItemText>
          </MenuItem>,
        ]}

        {activeItem?.entityType === 'category' && [
          <MenuItem key="edit" onClick={() => handleOpenEditCategory(activeItem)}>
            <ListItemIcon><EditOutlinedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Edit Category</ListItemText>
          </MenuItem>,
          <MenuItem
            key="del"
            onClick={() => {
              handleCloseMenu();
              setDeletingItem({ type: 'category', id: activeItem.id, label: activeItem.name });
              setDeleteConfirmOpen(true);
            }}
          >
            <ListItemIcon><DeleteOutlineOutlinedIcon fontSize="small" color="error" /></ListItemIcon>
            <ListItemText sx={{ color: 'error.main' }}>Deactivate Category</ListItemText>
          </MenuItem>,
        ]}

        {activeItem?.entityType === 'vendor' && [
          <MenuItem key="edit" onClick={() => handleOpenEditVendor(activeItem)}>
            <ListItemIcon><EditOutlinedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Edit Vendor</ListItemText>
          </MenuItem>,
          <MenuItem
            key="del"
            onClick={() => {
              handleCloseMenu();
              setDeletingItem({ type: 'vendor', id: activeItem.id, label: activeItem.name });
              setDeleteConfirmOpen(true);
            }}
          >
            <ListItemIcon><DeleteOutlineOutlinedIcon fontSize="small" color="error" /></ListItemIcon>
            <ListItemText sx={{ color: 'error.main' }}>Deactivate Vendor</ListItemText>
          </MenuItem>,
        ]}
      </Menu>

      {/* ============================================================ */}
      {/* DIALOG: PRODUCT */}
      {/* ============================================================ */}
      <Dialog open={productDialogOpen} onClose={() => setProductDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSaveProduct}>
          <DialogTitle>{isEditingProduct ? 'Edit Product Item' : 'Add New Inventory Product'}</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12} sm={8}>
                <TextField
                  fullWidth
                  required
                  label="Product Name"
                  value={productFormData.name}
                  onChange={(e) => setProductFormData({ ...productFormData, name: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  required
                  label="SKU Code"
                  value={productFormData.sku}
                  onChange={(e) => setProductFormData({ ...productFormData, sku: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={productFormData.category}
                    label="Category"
                    onChange={(e) => setProductFormData({ ...productFormData, category: e.target.value })}
                  >
                    <MenuItem value="">None</MenuItem>
                    {categories.map((c) => (
                      <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Unit (e.g. pcs, kg, box)"
                  value={productFormData.unit}
                  onChange={(e) => setProductFormData({ ...productFormData, unit: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Cost Price ($)"
                  value={productFormData.cost_price}
                  onChange={(e) => setProductFormData({ ...productFormData, cost_price: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Selling Price ($)"
                  value={productFormData.selling_price}
                  onChange={(e) => setProductFormData({ ...productFormData, selling_price: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Tax / VAT (%)"
                  value={productFormData.tax}
                  onChange={(e) => setProductFormData({ ...productFormData, tax: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Reorder Threshold"
                  value={productFormData.reorder_level}
                  onChange={(e) => setProductFormData({ ...productFormData, reorder_level: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Description"
                  value={productFormData.description}
                  onChange={(e) => setProductFormData({ ...productFormData, description: e.target.value })}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setProductDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? <CircularProgress size={24} /> : isEditingProduct ? 'Save Changes' : 'Create Product'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ============================================================ */}
      {/* DIALOG: STOCK MOVEMENT / TRANSACTION */}
      {/* ============================================================ */}
      <Dialog open={movementDialogOpen} onClose={() => setMovementDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleExecuteMovement}>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SwapHorizOutlinedIcon color="primary" /> Record Inventory Stock Movement
          </DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12}>
                <FormControl fullWidth required>
                  <InputLabel>Movement Type</InputLabel>
                  <Select
                    value={movementFormData.transaction_type}
                    label="Movement Type"
                    onChange={(e) => setMovementFormData({ ...movementFormData, transaction_type: e.target.value })}
                  >
                    <MenuItem value="STOCK_IN">Stock In (Receive Goods)</MenuItem>
                    <MenuItem value="STOCK_OUT">Stock Out (Issue / Dispatch)</MenuItem>
                    <MenuItem value="TRANSFER">Transfer Between Warehouses</MenuItem>
                    <MenuItem value="ADJUSTMENT">Stock Audit Adjustment</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth required>
                  <InputLabel>Product</InputLabel>
                  <Select
                    value={movementFormData.product}
                    label="Product"
                    onChange={(e) => setMovementFormData({ ...movementFormData, product: e.target.value })}
                  >
                    {products.map((p) => (
                      <MenuItem key={p.id} value={p.id}>{p.name} [{p.sku}]</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={movementFormData.transaction_type === 'TRANSFER' ? 6 : 12}>
                <FormControl fullWidth required>
                  <InputLabel>{movementFormData.transaction_type === 'TRANSFER' ? 'Source Warehouse' : 'Warehouse'}</InputLabel>
                  <Select
                    value={movementFormData.warehouse}
                    label={movementFormData.transaction_type === 'TRANSFER' ? 'Source Warehouse' : 'Warehouse'}
                    onChange={(e) => setMovementFormData({ ...movementFormData, warehouse: e.target.value })}
                  >
                    {warehouses.map((w) => (
                      <MenuItem key={w.id} value={w.id}>{w.name} ({w.code})</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              {movementFormData.transaction_type === 'TRANSFER' && (
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth required>
                    <InputLabel>Destination Warehouse</InputLabel>
                    <Select
                      value={movementFormData.destination_warehouse}
                      label="Destination Warehouse"
                      onChange={(e) => setMovementFormData({ ...movementFormData, destination_warehouse: e.target.value })}
                    >
                      {warehouses
                        .filter((w) => w.id !== movementFormData.warehouse)
                        .map((w) => (
                          <MenuItem key={w.id} value={w.id}>{w.name} ({w.code})</MenuItem>
                        ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  type="number"
                  label="Quantity"
                  value={movementFormData.quantity}
                  onChange={(e) => setMovementFormData({ ...movementFormData, quantity: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Reference / PO / DO #"
                  value={movementFormData.reference}
                  onChange={(e) => setMovementFormData({ ...movementFormData, reference: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Movement Notes"
                  value={movementFormData.notes}
                  onChange={(e) => setMovementFormData({ ...movementFormData, notes: e.target.value })}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setMovementDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? <CircularProgress size={24} /> : 'Confirm Movement'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ============================================================ */}
      {/* DIALOG: WAREHOUSE */}
      {/* ============================================================ */}
      <Dialog open={warehouseDialogOpen} onClose={() => setWarehouseDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSaveWarehouse}>
          <DialogTitle>{isEditingWarehouse ? 'Edit Warehouse' : 'Add New Warehouse'}</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12} sm={8}>
                <TextField
                  fullWidth
                  required
                  label="Warehouse Facility Name"
                  value={warehouseFormData.name}
                  onChange={(e) => setWarehouseFormData({ ...warehouseFormData, name: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  required
                  label="Code (e.g. WH-01)"
                  value={warehouseFormData.code}
                  onChange={(e) => setWarehouseFormData({ ...warehouseFormData, code: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Facility Address"
                  value={warehouseFormData.address}
                  onChange={(e) => setWarehouseFormData({ ...warehouseFormData, address: e.target.value })}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setWarehouseDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? <CircularProgress size={24} /> : isEditingWarehouse ? 'Save Changes' : 'Create Warehouse'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ============================================================ */}
      {/* DIALOG: CATEGORY */}
      {/* ============================================================ */}
      <Dialog open={categoryDialogOpen} onClose={() => setCategoryDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSaveCategory}>
          <DialogTitle>{isEditingCategory ? 'Edit Category' : 'Add Product Category'}</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  label="Category Name"
                  value={categoryFormData.name}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Description"
                  value={categoryFormData.description}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setCategoryDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? <CircularProgress size={24} /> : isEditingCategory ? 'Save Changes' : 'Create Category'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ============================================================ */}
      {/* DIALOG: VENDOR */}
      {/* ============================================================ */}
      <Dialog open={vendorDialogOpen} onClose={() => setVendorDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSaveVendor}>
          <DialogTitle>{isEditingVendor ? 'Edit Vendor / Supplier' : 'Add Vendor / Supplier'}</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  label="Vendor / Supplier Name"
                  value={vendorFormData.name}
                  onChange={(e) => setVendorFormData({ ...vendorFormData, name: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="email"
                  label="Email"
                  value={vendorFormData.email}
                  onChange={(e) => setVendorFormData({ ...vendorFormData, email: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Phone"
                  value={vendorFormData.phone}
                  onChange={(e) => setVendorFormData({ ...vendorFormData, phone: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Tax / VAT Identifier"
                  value={vendorFormData.tax_id}
                  onChange={(e) => setVendorFormData({ ...vendorFormData, tax_id: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Business Address"
                  value={vendorFormData.address}
                  onChange={(e) => setVendorFormData({ ...vendorFormData, address: e.target.value })}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setVendorDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? <CircularProgress size={24} /> : isEditingVendor ? 'Save Changes' : 'Create Vendor'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ============================================================ */}
      {/* DIALOG: CONFIRM DELETE */}
      {/* ============================================================ */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Confirm Deactivation</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Are you sure you want to deactivate <strong>{deletingItem?.label}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained" disabled={submitting}>
            {submitting ? <CircularProgress size={24} /> : 'Deactivate'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
