import api from './api';

export const authService = {
  /**
   * Authenticate with username or email and password
   */
  login: async (username, password) => {
    const response = await api.post('/auth/login/', { username, password });
    return response.data;
  },

  /**
   * Refresh JWT access token
   */
  refreshToken: async (refresh) => {
    const response = await api.post('/auth/refresh/', { refresh });
    return response.data;
  },

  /**
   * Get current user profile and company memberships
   */
  getMe: async () => {
    const response = await api.get('/auth/me/');
    return response.data;
  },
};

export default authService;
