import api from './api';

export const notificationService = {
  /**
   * Fetch paginated notifications for active company with optional filters
   */
  getNotifications: async (companyId, params = {}) => {
    const response = await api.get(`/companies/${companyId}/notifications/`, { params });
    return response.data;
  },

  /**
   * Mark a single notification as read
   */
  markAsRead: async (companyId, notificationId) => {
    const response = await api.post(`/companies/${companyId}/notifications/${notificationId}/read/`);
    return response.data;
  },

  /**
   * Mark all unread notifications as read for current user in company
   */
  markAllAsRead: async (companyId) => {
    const response = await api.post(`/companies/${companyId}/notifications/read-all/`);
    return response.data;
  },

  /**
   * Fetch total unread notifications count
   */
  getUnreadCount: async (companyId) => {
    const response = await api.get(`/companies/${companyId}/notifications/unread-count/`);
    return response.data;
  },
};

export default notificationService;
