import api from './api';

export const reportsService = {
  getExecutiveReport: async (companyId, dateFrom = null, dateTo = null) => {
    const params = {};
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    const response = await api.get(`/companies/${companyId}/reports/executive/`, { params });
    return response.data;
  },

  getSalesReport: async (companyId, dateFrom = null, dateTo = null) => {
    const params = {};
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    const response = await api.get(`/companies/${companyId}/reports/sales/`, { params });
    return response.data;
  },

  getPurchaseReport: async (companyId, dateFrom = null, dateTo = null) => {
    const params = {};
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    const response = await api.get(`/companies/${companyId}/reports/purchase/`, { params });
    return response.data;
  },

  getInventoryReport: async (companyId) => {
    const response = await api.get(`/companies/${companyId}/reports/inventory/`);
    return response.data;
  },

  getCRMReport: async (companyId, dateFrom = null, dateTo = null) => {
    const params = {};
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    const response = await api.get(`/companies/${companyId}/reports/crm/`, { params });
    return response.data;
  },

  getFinanceReport: async (companyId, dateFrom = null, dateTo = null) => {
    const params = {};
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    const response = await api.get(`/companies/${companyId}/reports/finance/`, { params });
    return response.data;
  },

  getEmployeeReport: async (companyId) => {
    const response = await api.get(`/companies/${companyId}/reports/employees/`);
    return response.data;
  },

  getMonthlyReport: async (companyId, months = 6) => {
    const response = await api.get(`/companies/${companyId}/reports/monthly/`, {
      params: { months },
    });
    return response.data;
  },

  downloadCSV: async (companyId, reportType = 'executive', dateFrom = null, dateTo = null) => {
    const params = { report: reportType };
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;

    const response = await api.get(`/companies/${companyId}/reports/export/`, {
      params,
      responseType: 'blob',
    });

    // Create a temporary anchor to trigger browser file download
    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `icorp_${reportType}_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};

export default reportsService;
