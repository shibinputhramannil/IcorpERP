import api from './api';

export const employeeService = {
  /**
   * List employees for a specific company
   */
  getEmployees: async (companyId, showAll = false) => {
    const url = `/companies/${companyId}/employees/${showAll ? '?all=true' : ''}`;
    const response = await api.get(url);
    return response.data;
  },

  /**
   * Get single employee detail
   */
  getEmployee: async (companyId, employeeId) => {
    const response = await api.get(`/companies/${companyId}/employees/${employeeId}/`);
    return response.data;
  },

  /**
   * Create a new employee in the company
   */
  createEmployee: async (companyId, data) => {
    const response = await api.post(`/companies/${companyId}/employees/`, data);
    return response.data;
  },

  /**
   * Update an employee
   */
  updateEmployee: async (companyId, employeeId, data) => {
    const response = await api.patch(`/companies/${companyId}/employees/${employeeId}/`, data);
    return response.data;
  },

  /**
   * Deactivate/delete an employee
   */
  deleteEmployee: async (companyId, employeeId) => {
    const response = await api.delete(`/companies/${companyId}/employees/${employeeId}/`);
    return response.data;
  },
};

export default employeeService;
