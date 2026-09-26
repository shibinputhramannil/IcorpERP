import api from './api';

export const settingsService = {
  /**
   * Fetch current authenticated user's profile
   */
  getProfile: async () => {
    const response = await api.get('/settings/profile/');
    return response.data;
  },

  /**
   * Update profile details (first_name, last_name, email, phone, designation)
   */
  updateProfile: async (data) => {
    const response = await api.patch('/settings/profile/', data);
    return response.data;
  },

  /**
   * Safely change user password
   */
  changePassword: async (currentPassword, newPassword, confirmPassword) => {
    const response = await api.post('/settings/change-password/', {
      current_password: currentPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
    });
    return response.data;
  },

  /**
   * Fetch company settings
   */
  getCompanySettings: async (companyId) => {
    const response = await api.get(`/companies/${companyId}/settings/`);
    return response.data;
  },

  /**
   * Update company settings (Company Admin or Super Admin only)
   */
  updateCompanySettings: async (companyId, data) => {
    const response = await api.patch(`/companies/${companyId}/settings/`, data);
    return response.data;
  },

  /**
   * Fetch user notification preferences
   */
  getNotificationPreferences: async (companyId = null) => {
    const params = companyId ? { company_id: companyId } : {};
    const response = await api.get('/settings/notifications/', { params });
    return response.data;
  },

  /**
   * Update user notification preferences
   */
  updateNotificationPreferences: async (data, companyId = null) => {
    const payload = companyId ? { ...data, company_id: companyId } : data;
    const response = await api.patch('/settings/notifications/', payload);
    return response.data;
  },
};

export default settingsService;
