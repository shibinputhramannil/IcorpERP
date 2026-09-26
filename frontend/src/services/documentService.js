import api from './api';

export const documentService = {
  /**
   * List documents with category, search, and type filters.
   */
  getDocuments: async (companyId, params = {}) => {
    const response = await api.get(`/companies/${companyId}/documents/`, { params });
    return response.data;
  },

  /**
   * Upload a new document file.
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
   * Get single document details.
   */
  getDocument: async (companyId, documentId) => {
    const response = await api.get(`/companies/${companyId}/documents/${documentId}/`);
    return response.data;
  },

  /**
   * Update document metadata (name, category, tags).
   */
  updateDocument: async (companyId, documentId, data) => {
    const response = await api.patch(`/companies/${companyId}/documents/${documentId}/`, data);
    return response.data;
  },

  /**
   * Delete a document.
   */
  deleteDocument: async (companyId, documentId) => {
    const response = await api.delete(`/companies/${companyId}/documents/${documentId}/`);
    return response.data;
  },

  /**
   * Get direct download URL for a document.
   */
  getDownloadUrl: (companyId, documentId) => {
    return `/api/companies/${companyId}/documents/${documentId}/download/`;
  },
};

export default documentService;
