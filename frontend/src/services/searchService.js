import api from './api';

export const searchService = {
  /**
   * Search globally across all ERP modules or scoped to a specific company.
   */
  globalSearch: async (query, companyId = null) => {
    const params = { q: query };
    if (companyId) {
      params.company_id = companyId;
    }
    const response = await api.get('/search/', { params });
    return response.data;
  },
};

export default searchService;
