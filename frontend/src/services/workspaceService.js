import api from './api';

export const workspaceService = {
  // ============================================================
  // 1. WORKSPACE CORE & OVERVIEW
  // ============================================================
  /**
   * Fetch company workspace overview: stats, members counts, and recent activity
   */
  getWorkspace: async (companyId) => {
    const response = await api.get(`/companies/${companyId}/workspace/`);
    return response.data;
  },

  /**
   * Fetch consolidated workspace collaboration overview (Notes, Mail, Docs, Activities, Members, Stats)
   */
  getCollaborationOverview: async (companyId) => {
    const response = await api.get(`/companies/${companyId}/workspace/collaboration/`);
    return response.data;
  },

  // ============================================================
  // 2. MEMBERS
  // ============================================================
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

  // ============================================================
  // 3. NOTES
  // ============================================================
  /**
   * List notes with optional search and entity filtering
   */
  getNotes: async (companyId, params = {}) => {
    const response = await api.get(`/companies/${companyId}/workspace/notes/`, { params });
    return response.data;
  },

  /**
   * Create a new workspace note
   */
  createNote: async (companyId, data) => {
    const response = await api.post(`/companies/${companyId}/workspace/notes/`, data);
    return response.data;
  },

  /**
   * Get single note details
   */
  getNote: async (companyId, noteId) => {
    const response = await api.get(`/companies/${companyId}/workspace/notes/${noteId}/`);
    return response.data;
  },

  /**
   * Update an existing note
   */
  updateNote: async (companyId, noteId, data) => {
    const response = await api.patch(`/companies/${companyId}/workspace/notes/${noteId}/`, data);
    return response.data;
  },

  /**
   * Delete a note
   */
  deleteNote: async (companyId, noteId) => {
    const response = await api.delete(`/companies/${companyId}/workspace/notes/${noteId}/`);
    return response.data;
  },

  // ============================================================
  // 4. MAIL / EMAIL
  // ============================================================
  /**
   * List email activities for workspace
   */
  getMail: async (companyId, params = {}) => {
    const response = await api.get(`/companies/${companyId}/workspace/mail/`, { params });
    return response.data;
  },

  /**
   * Compose & send/log an email
   */
  sendMail: async (companyId, data) => {
    const response = await api.post(`/companies/${companyId}/workspace/mail/send/`, data);
    return response.data;
  },

  /**
   * Check Gmail/SMTP integration status
   */
  getMailStatus: async (companyId) => {
    const response = await api.get(`/companies/${companyId}/workspace/mail/status/`);
    return response.data;
  },

  // ============================================================
  // 5. DOCUMENTS
  // ============================================================
  /**
   * List company documents with search, file_type, and module filtering
   */
  getDocuments: async (companyId, params = {}) => {
    const response = await api.get(`/companies/${companyId}/documents/`, { params });
    return response.data;
  },

  /**
   * Upload a new document (multipart/form-data)
   */
  uploadDocument: async (companyId, formData) => {
    const response = await api.post(`/companies/${companyId}/documents/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Get document metadata
   */
  getDocument: async (companyId, documentId) => {
    const response = await api.get(`/companies/${companyId}/documents/${documentId}/`);
    return response.data;
  },

  /**
   * Delete a document
   */
  deleteDocument: async (companyId, documentId) => {
    const response = await api.delete(`/companies/${companyId}/documents/${documentId}/`);
    return response.data;
  },

  /**
   * Get safe download URL
   */
  getDocumentDownloadUrl: (companyId, documentId) => {
    return `/api/companies/${companyId}/documents/${documentId}/download/`;
  },

  // ============================================================
  // 6. UNIFIED ACTIVITY FEED
  // ============================================================
  /**
   * Fetch unified activity feed (Workspace + CRM activities)
   */
  getActivities: async (companyId) => {
    const response = await api.get(`/companies/${companyId}/workspace/activities/`);
    return response.data;
  },
};

export default workspaceService;
