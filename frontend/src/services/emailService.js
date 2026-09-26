import api from './api';

export const emailService = {
  /**
   * Get list of emails with folder and search filtering.
   */
  getEmails: async (companyId, params = {}) => {
    const response = await api.get(`/companies/${companyId}/emails/`, { params });
    return response.data;
  },

  /**
   * Get single email detail.
   */
  getEmail: async (companyId, emailId) => {
    const response = await api.get(`/companies/${companyId}/emails/${emailId}/`);
    return response.data;
  },

  /**
   * Send a new email or save draft.
   */
  sendEmail: async (companyId, emailData) => {
    const response = await api.post(`/companies/${companyId}/emails/`, emailData);
    return response.data;
  },

  /**
   * Update email (e.g. toggle starred, read, or move folder).
   */
  updateEmail: async (companyId, emailId, data) => {
    const response = await api.patch(`/companies/${companyId}/emails/${emailId}/`, data);
    return response.data;
  },

  /**
   * Delete email (moves to trash or deletes permanently).
   */
  deleteEmail: async (companyId, emailId) => {
    const response = await api.delete(`/companies/${companyId}/emails/${emailId}/`);
    return response.data;
  },

  /**
   * Get folder message counts (inbox, sent, drafts, trash, unread).
   */
  getFolderCounts: async (companyId) => {
    const response = await api.get(`/companies/${companyId}/emails/counts/`);
    return response.data;
  },

  /**
   * Get Gmail / SMTP delivery service status.
   */
  getStatus: async (companyId) => {
    const response = await api.get(`/companies/${companyId}/workspace/mail/status/`);
    return response.data;
  },
};

export default emailService;
