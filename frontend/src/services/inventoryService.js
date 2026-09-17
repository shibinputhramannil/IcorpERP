import api from './api';

export const inventoryService = {
  // ============================================================
  // 1. CATEGORIES
  // ============================================================
  getCategories: async (companyId, params = {}) => {
    const response = await api.get(`/companies/${companyId}/inventory/categories/`, { params });
    return response.data;
  },

  getCategory: async (companyId, categoryId) => {
    const response = await api.get(`/companies/${companyId}/inventory/categories/${categoryId}/`);
    return response.data;
  },

  createCategory: async (companyId, data) => {
    const response = await api.post(`/companies/${companyId}/inventory/categories/`, data);
    return response.data;
  },

  updateCategory: async (companyId, categoryId, data) => {
    const response = await api.patch(`/companies/${companyId}/inventory/categories/${categoryId}/`, data);
    return response.data;
  },

  deleteCategory: async (companyId, categoryId) => {
    const response = await api.delete(`/companies/${companyId}/inventory/categories/${categoryId}/`);
    return response.data;
  },

  // ============================================================
  // 2. PRODUCTS
  // ============================================================
  getProducts: async (companyId, params = {}) => {
    const response = await api.get(`/companies/${companyId}/inventory/products/`, { params });
    return response.data;
  },

  getProduct: async (companyId, productId) => {
    const response = await api.get(`/companies/${companyId}/inventory/products/${productId}/`);
    return response.data;
  },

  createProduct: async (companyId, data) => {
    const response = await api.post(`/companies/${companyId}/inventory/products/`, data);
    return response.data;
  },

  updateProduct: async (companyId, productId, data) => {
    const response = await api.patch(`/companies/${companyId}/inventory/products/${productId}/`, data);
    return response.data;
  },

  deleteProduct: async (companyId, productId) => {
    const response = await api.delete(`/companies/${companyId}/inventory/products/${productId}/`);
    return response.data;
  },

  // ============================================================
  // 3. WAREHOUSES
  // ============================================================
  getWarehouses: async (companyId, params = {}) => {
    const response = await api.get(`/companies/${companyId}/inventory/warehouses/`, { params });
    return response.data;
  },

  getWarehouse: async (companyId, warehouseId) => {
    const response = await api.get(`/companies/${companyId}/inventory/warehouses/${warehouseId}/`);
    return response.data;
  },

  createWarehouse: async (companyId, data) => {
    const response = await api.post(`/companies/${companyId}/inventory/warehouses/`, data);
    return response.data;
  },

  updateWarehouse: async (companyId, warehouseId, data) => {
    const response = await api.patch(`/companies/${companyId}/inventory/warehouses/${warehouseId}/`, data);
    return response.data;
  },

  deleteWarehouse: async (companyId, warehouseId) => {
    const response = await api.delete(`/companies/${companyId}/inventory/warehouses/${warehouseId}/`);
    return response.data;
  },

  // ============================================================
  // 4. STOCK LEVELS
  // ============================================================
  getStock: async (companyId, params = {}) => {
    const response = await api.get(`/companies/${companyId}/inventory/stock/`, { params });
    return response.data;
  },

  getStockDetail: async (companyId, stockId) => {
    const response = await api.get(`/companies/${companyId}/inventory/stock/${stockId}/`);
    return response.data;
  },

  // ============================================================
  // 5. STOCK TRANSACTIONS & MOVEMENTS
  // ============================================================
  getTransactions: async (companyId, params = {}) => {
    const response = await api.get(`/companies/${companyId}/inventory/transactions/`, { params });
    return response.data;
  },

  createTransaction: async (companyId, data) => {
    const response = await api.post(`/companies/${companyId}/inventory/transactions/`, data);
    return response.data;
  },

  // ============================================================
  // 6. VENDORS / SUPPLIERS
  // ============================================================
  getVendors: async (companyId, params = {}) => {
    const response = await api.get(`/companies/${companyId}/inventory/vendors/`, { params });
    return response.data;
  },

  getVendor: async (companyId, vendorId) => {
    const response = await api.get(`/companies/${companyId}/inventory/vendors/${vendorId}/`);
    return response.data;
  },

  createVendor: async (companyId, data) => {
    const response = await api.post(`/companies/${companyId}/inventory/vendors/`, data);
    return response.data;
  },

  updateVendor: async (companyId, vendorId, data) => {
    const response = await api.patch(`/companies/${companyId}/inventory/vendors/${vendorId}/`, data);
    return response.data;
  },

  deleteVendor: async (companyId, vendorId) => {
    const response = await api.delete(`/companies/${companyId}/inventory/vendors/${vendorId}/`);
    return response.data;
  },

  // ============================================================
  // 7. INVENTORY DASHBOARD
  // ============================================================
  getDashboard: async (companyId) => {
    const response = await api.get(`/companies/${companyId}/inventory/dashboard/`);
    return response.data;
  },
};

export default inventoryService;
