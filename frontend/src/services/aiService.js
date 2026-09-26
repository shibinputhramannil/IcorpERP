import api from './api';

export const aiService = {
  /**
   * Send a natural language prompt to the AI ERP Assistant.
   */
  chat: async (companyId, query, conversationHistory = []) => {
    const response = await api.post(`/companies/${companyId}/ai/chat/`, {
      query,
      conversation_history: conversationHistory,
    });
    return response.data;
  },

  /**
   * Fetch aggregated executive insights across Sales, Purchases, Inventory, and Finance.
   */
  getInsights: async (companyId, module = null) => {
    const params = module ? { module } : {};
    const response = await api.get(`/companies/${companyId}/ai/insights/`, { params });
    return response.data;
  },

  /**
   * Search for customer profile intelligence, orders, and debt status.
   */
  lookupCustomer: async (companyId, query) => {
    const response = await api.get(`/companies/${companyId}/ai/customer-lookup/`, {
      params: { q: query },
    });
    return response.data;
  },

  /**
   * Search for vendor profile intelligence, purchase orders, and spend history.
   */
  lookupVendor: async (companyId, query) => {
    const response = await api.get(`/companies/${companyId}/ai/vendor-lookup/`, {
      params: { q: query },
    });
    return response.data;
  },
};

export default aiService;
