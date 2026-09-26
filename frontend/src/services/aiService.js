import api from './api';

export const aiService = {
  /**
   * Phase 9: Fetch complete business intelligence dashboard across all ERP modules.
   * If companyId is null/omitted, fetches global multi-workspace dashboard.
   */
  getDashboard: async (companyId = null) => {
    if (companyId) {
      const response = await api.get(`/companies/${companyId}/ai/dashboard/`);
      return response.data;
    }
    const response = await api.get('/ai/dashboard/');
    return response.data;
  },

  /**
   * Phase 9: Fetch executive business summary, key metrics, strengths, risks, recommendations.
   * If companyId is null/omitted, fetches global multi-workspace summary.
   */
  getSummary: async (companyId = null) => {
    if (companyId) {
      const response = await api.get(`/companies/${companyId}/ai/summary/`);
      return response.data;
    }
    const response = await api.get('/ai/summary/');
    return response.data;
  },

  /**
   * Phase 9: Ask business question with safe grounded ERP fallback.
   * If companyId is null/omitted, queries globally across all authorized companies.
   */
  ask: async (companyId = null, question, conversationHistory = []) => {
    if (companyId) {
      const response = await api.post(`/companies/${companyId}/ai/ask/`, {
        question,
        conversation_history: conversationHistory,
      });
      return response.data;
    }
    const response = await api.post('/ai/ask/', {
      question,
      conversation_history: conversationHistory,
    });
    return response.data;
  },

  /**
   * Preserved Phase 7 & Phase 9: Send a natural language prompt to the AI ERP Assistant.
   * If companyId is null/omitted, queries globally across all authorized companies.
   */
  chat: async (companyId = null, query, conversationHistory = []) => {
    if (companyId) {
      const response = await api.post(`/companies/${companyId}/ai/chat/`, {
        query,
        conversation_history: conversationHistory,
      });
      return response.data;
    }
    const response = await api.post('/ai/chat/', {
      query,
      conversation_history: conversationHistory,
    });
    return response.data;
  },

  /**
   * Explicit global multi-company AI dashboard.
   */
  getGlobalDashboard: async (companyId = null) => {
    const params = companyId ? { company_id: companyId } : {};
    const response = await api.get('/ai/dashboard/', { params });
    return response.data;
  },

  /**
   * Explicit global multi-company executive summary.
   */
  getGlobalSummary: async (companyId = null) => {
    const params = companyId ? { company_id: companyId } : {};
    const response = await api.get('/ai/summary/', { params });
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
