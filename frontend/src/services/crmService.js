import api from './api';

export const crmService = {
  // ============================================================
  // 1. LEADS
  // ============================================================
  getLeads: async (companyId, params = {}) => {
    const response = await api.get(`/companies/${companyId}/leads/`, { params });
    return response.data;
  },

  getLead: async (companyId, leadId) => {
    const response = await api.get(`/companies/${companyId}/leads/${leadId}/`);
    return response.data;
  },

  createLead: async (companyId, data) => {
    const response = await api.post(`/companies/${companyId}/leads/`, data);
    return response.data;
  },

  updateLead: async (companyId, leadId, data) => {
    const response = await api.patch(`/companies/${companyId}/leads/${leadId}/`, data);
    return response.data;
  },

  deleteLead: async (companyId, leadId) => {
    const response = await api.delete(`/companies/${companyId}/leads/${leadId}/`);
    return response.data;
  },

  convertLead: async (companyId, leadId, data) => {
    const response = await api.post(`/companies/${companyId}/leads/${leadId}/convert/`, data);
    return response.data;
  },

  // ============================================================
  // 2. CUSTOMERS
  // ============================================================
  getCustomers: async (companyId, params = {}) => {
    const response = await api.get(`/companies/${companyId}/customers/`, { params });
    return response.data;
  },

  getCustomer: async (companyId, customerId) => {
    const response = await api.get(`/companies/${companyId}/customers/${customerId}/`);
    return response.data;
  },

  createCustomer: async (companyId, data) => {
    const response = await api.post(`/companies/${companyId}/customers/`, data);
    return response.data;
  },

  updateCustomer: async (companyId, customerId, data) => {
    const response = await api.patch(`/companies/${companyId}/customers/${customerId}/`, data);
    return response.data;
  },

  deleteCustomer: async (companyId, customerId) => {
    const response = await api.delete(`/companies/${companyId}/customers/${customerId}/`);
    return response.data;
  },

  // ============================================================
  // 3. CONTACTS
  // ============================================================
  getContacts: async (companyId, params = {}) => {
    const response = await api.get(`/companies/${companyId}/contacts/`, { params });
    return response.data;
  },

  getContact: async (companyId, contactId) => {
    const response = await api.get(`/companies/${companyId}/contacts/${contactId}/`);
    return response.data;
  },

  createContact: async (companyId, data) => {
    const response = await api.post(`/companies/${companyId}/contacts/`, data);
    return response.data;
  },

  updateContact: async (companyId, contactId, data) => {
    const response = await api.patch(`/companies/${companyId}/contacts/${contactId}/`, data);
    return response.data;
  },

  deleteContact: async (companyId, contactId) => {
    const response = await api.delete(`/companies/${companyId}/contacts/${contactId}/`);
    return response.data;
  },

  // ============================================================
  // 4. DEALS & PIPELINE
  // ============================================================
  getDeals: async (companyId, params = {}) => {
    const response = await api.get(`/companies/${companyId}/deals/`, { params });
    return response.data;
  },

  getDeal: async (companyId, dealId) => {
    const response = await api.get(`/companies/${companyId}/deals/${dealId}/`);
    return response.data;
  },

  createDeal: async (companyId, data) => {
    const response = await api.post(`/companies/${companyId}/deals/`, data);
    return response.data;
  },

  updateDeal: async (companyId, dealId, data) => {
    const response = await api.patch(`/companies/${companyId}/deals/${dealId}/`, data);
    return response.data;
  },

  deleteDeal: async (companyId, dealId) => {
    const response = await api.delete(`/companies/${companyId}/deals/${dealId}/`);
    return response.data;
  },

  // ============================================================
  // 5. ACTIVITIES & NOTES
  // ============================================================
  getActivities: async (companyId, params = {}) => {
    const response = await api.get(`/companies/${companyId}/activities/`, { params });
    return response.data;
  },

  getActivity: async (companyId, activityId) => {
    const response = await api.get(`/companies/${companyId}/activities/${activityId}/`);
    return response.data;
  },

  createActivity: async (companyId, data) => {
    const response = await api.post(`/companies/${companyId}/activities/`, data);
    return response.data;
  },

  updateActivity: async (companyId, activityId, data) => {
    const response = await api.patch(`/companies/${companyId}/activities/${activityId}/`, data);
    return response.data;
  },

  deleteActivity: async (companyId, activityId) => {
    const response = await api.delete(`/companies/${companyId}/activities/${activityId}/`);
    return response.data;
  },

  // ============================================================
  // 6. GMAIL INTEGRATION STATUS
  // ============================================================
  getGmailStatus: async (companyId) => {
    const response = await api.get(`/companies/${companyId}/gmail/status/`);
    return response.data;
  },
};

export default crmService;
