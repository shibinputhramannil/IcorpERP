import api from './api';

export const companyService = {
  /**
   * List all companies accessible to the user
   */
  getCompanies: async () => {
    const response = await api.get('/companies/');
    return response.data;
  },

  /**
   * Retrieve a single company detail
   */
  getCompany: async (id) => {
    const response = await api.get(`/companies/${id}/`);
    return response.data;
  },

  /**
   * Create a new company
   */
  createCompany: async (data) => {
    const response = await api.post('/companies/create/', data);
    return response.data;
  },

  /**
   * Update an existing company
   */
  updateCompany: async (id, data) => {
    const response = await api.patch(`/companies/${id}/`, data);
    return response.data;
  },

  /**
   * Deactivate/delete a company
   */
  deleteCompany: async (id) => {
    const response = await api.delete(`/companies/${id}/`);
    return response.data;
  },

  /**
   * Get members of a company
   */
  getCompanyMembers: async (companyId) => {
    const response = await api.get(`/companies/${companyId}/members/`);
    return response.data;
  },

  /**
   * Add a member to a company
   */
  addCompanyMember: async (companyId, data) => {
    const response = await api.post(`/companies/${companyId}/members/add/`, data);
    return response.data;
  },

  /**
   * Update a member's role
   */
  updateMemberRole: async (companyId, membershipId, role) => {
    const response = await api.patch(`/companies/${companyId}/members/${membershipId}/`, { role });
    return response.data;
  },

  /**
   * Remove a member from a company
   */
  removeMember: async (companyId, membershipId) => {
    const response = await api.delete(`/companies/${companyId}/members/${membershipId}/`);
    return response.data;
  },
};

export default companyService;
