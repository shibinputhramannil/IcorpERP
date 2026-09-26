import api from './api';

export const workspaceService = {
  /**
   * Fetch company workspace overview: stats, members counts, and recent activity
   */
  getWorkspace: async (companyId) => {
    const response = await api.get(`/companies/${companyId}/workspace/`);
    return response.data;
  },

  /**
   * Fetch company members with optional search and role filtering
   */
  getMembers: async (companyId, params = {}) => {
    const response = await api.get(`/companies/${companyId}/members/`, { params });
    return response.data;
  },

  /**
   * Add / invite a member to the workspace
   */
  addMember: async (companyId, data) => {
    const response = await api.post(`/companies/${companyId}/members/`, data);
    return response.data;
  },

  /**
   * Update member role or active status
   */
  updateMember: async (companyId, memberId, data) => {
    const response = await api.patch(`/companies/${companyId}/members/${memberId}/`, data);
    return response.data;
  },

  /**
   * Remove member or deactivate membership
   */
  removeMember: async (companyId, memberId, deactivateOnly = false) => {
    const params = deactivateOnly ? { deactivate: 'true' } : {};
    const response = await api.delete(`/companies/${companyId}/members/${memberId}/`, { params });
    return response.data;
  },
};

export default workspaceService;
