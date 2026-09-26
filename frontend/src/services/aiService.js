import api from './api';

export const aiService = {
  /**
   * Phase 9: Fetch complete business intelligence dashboard across all ERP modules.
   */
  getDashboard: async (companyId) => {
    const response = await api.get(`/companies/${companyId}/ai/dashboard/`);
    return response.data;
  },

  /**
   * Phase 9: Fetch executive business summary, key metrics, strengths, risks, recommendations.
   */
  getSummary: async (companyId) => {
    const response = await api.get(`/companies/${companyId}/ai/summary/`);
    return response.data;
  },

  /**
   * Phase 9: Ask business question with safe grounded ERP fallback.
   */
  ask: async (companyId, question, conversationHistory = []) => {
    const response = await api.post(`/companies/${companyId}/ai/ask/`, {
      question,
      conversation_history: conversationHistory,
    });
    return response.data;
  },

  /**
   * Preserved Phase 7: Send a natural language prompt to the AI ERP Assistant.
   */
  chat: async (companyId, query, conversationHistory = []) => {
    const response = await api.post(`/companies/${companyId}/ai/chat/`, {
      query,
      conversation_history: conversationHistory,
    });
    return response.data;
  },

  /**
   * Preserved Phase 7: Fetch aggregated executive insights across modules.
   */
  getInsights: async (companyId, module = null) => {
    const params = module ? { module } : {};
    const response = await api.get(`/companies/${companyId}/ai/insights/`, { params });
    return response.data;
  },

  /**
   * Preserved Phase 7: Search for customer profile intelligence.
   */
  lookupCustomer: async (companyId, query) => {
    const response = await api.get(`/companies/${companyId}/ai/customer-lookup/`, {
      params: { q: query },
    });
    return response.data;
  },

  /**
   * Preserved Phase 7: Search for vendor profile intelligence.
   */
  lookupVendor: async (companyId, query) => {
    const response = await api.get(`/companies/${companyId}/ai/vendor-lookup/`, {
      params: { q: query },
    });
    return response.data;
  },
};

export default aiService;
