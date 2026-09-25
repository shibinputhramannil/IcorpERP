import api from './api';

export const financeService = {
  // ============================================================
  // 1. FINANCE DASHBOARD
  // ============================================================
  getDashboard: async (companyId) => {
    const response = await api.get(`/companies/${companyId}/finance/dashboard/`);
    return response.data;
  },

  // ============================================================
  // 2. CHART OF ACCOUNTS
  // ============================================================
  getAccounts: async (companyId, params = {}) => {
    const response = await api.get(`/companies/${companyId}/finance/accounts/`, { params });
    return response.data;
  },

  getAccount: async (companyId, accountId) => {
    const response = await api.get(`/companies/${companyId}/finance/accounts/${accountId}/`);
    return response.data;
  },

  createAccount: async (companyId, data) => {
    const response = await api.post(`/companies/${companyId}/finance/accounts/`, data);
    return response.data;
  },

  updateAccount: async (companyId, accountId, data) => {
    const response = await api.patch(`/companies/${companyId}/finance/accounts/${accountId}/`, data);
    return response.data;
  },

  deleteAccount: async (companyId, accountId) => {
    const response = await api.delete(`/companies/${companyId}/finance/accounts/${accountId}/`);
    return response.data;
  },

  seedDefaultAccounts: async (companyId) => {
    const response = await api.post(`/companies/${companyId}/finance/default-accounts/`);
    return response.data;
  },

  // ============================================================
  // 3. FISCAL PERIODS
  // ============================================================
  getFiscalPeriods: async (companyId) => {
    const response = await api.get(`/companies/${companyId}/finance/fiscal-periods/`);
    return response.data;
  },

  createFiscalPeriod: async (companyId, data) => {
    const response = await api.post(`/companies/${companyId}/finance/fiscal-periods/`, data);
    return response.data;
  },

  updateFiscalPeriod: async (companyId, periodId, data) => {
    const response = await api.patch(`/companies/${companyId}/finance/fiscal-periods/${periodId}/`, data);
    return response.data;
  },

  deleteFiscalPeriod: async (companyId, periodId) => {
    const response = await api.delete(`/companies/${companyId}/finance/fiscal-periods/${periodId}/`);
    return response.data;
  },

  // ============================================================
  // 4. JOURNAL ENTRIES
  // ============================================================
  getJournalEntries: async (companyId, params = {}) => {
    const response = await api.get(`/companies/${companyId}/finance/journal-entries/`, { params });
    return response.data;
  },

  getJournalEntry: async (companyId, entryId) => {
    const response = await api.get(`/companies/${companyId}/finance/journal-entries/${entryId}/`);
    return response.data;
  },

  createJournalEntry: async (companyId, data) => {
    const response = await api.post(`/companies/${companyId}/finance/journal-entries/`, data);
    return response.data;
  },

  cancelJournalEntry: async (companyId, entryId) => {
    const response = await api.patch(`/companies/${companyId}/finance/journal-entries/${entryId}/`, {
      status: 'CANCELLED',
    });
    return response.data;
  },

  // ============================================================
  // 5. FINANCIAL STATEMENTS & LEDGERS
  // ============================================================
  getGeneralLedger: async (companyId, params = {}) => {
    const response = await api.get(`/companies/${companyId}/finance/general-ledger/`, { params });
    return response.data;
  },

  getTrialBalance: async (companyId, params = {}) => {
    const response = await api.get(`/companies/${companyId}/finance/trial-balance/`, { params });
    return response.data;
  },

  getProfitLoss: async (companyId, params = {}) => {
    const response = await api.get(`/companies/${companyId}/finance/profit-loss/`, { params });
    return response.data;
  },

  getBalanceSheet: async (companyId, params = {}) => {
    const response = await api.get(`/companies/${companyId}/finance/balance-sheet/`, { params });
    return response.data;
  },

  // ============================================================
  // 6. RECEIVABLES & PAYABLES
  // ============================================================
  getAccountsReceivable: async (companyId) => {
    const response = await api.get(`/companies/${companyId}/finance/accounts-receivable/`);
    return response.data;
  },

  getAccountsPayable: async (companyId) => {
    const response = await api.get(`/companies/${companyId}/finance/accounts-payable/`);
    return response.data;
  },

  // ============================================================
  // 7. CASH & BANK
  // ============================================================
  getBankAccounts: async (companyId) => {
    const response = await api.get(`/companies/${companyId}/finance/bank/`);
    return response.data;
  },

  createBankAccount: async (companyId, data) => {
    const response = await api.post(`/companies/${companyId}/finance/bank/`, data);
    return response.data;
  },

  updateBankAccount: async (companyId, bankId, data) => {
    const response = await api.patch(`/companies/${companyId}/finance/bank/${bankId}/`, data);
    return response.data;
  },

  deleteBankAccount: async (companyId, bankId) => {
    const response = await api.delete(`/companies/${companyId}/finance/bank/${bankId}/`);
    return response.data;
  },

  getCashAccounts: async (companyId) => {
    const response = await api.get(`/companies/${companyId}/finance/cash/`);
    return response.data;
  },

  createCashAccount: async (companyId, data) => {
    const response = await api.post(`/companies/${companyId}/finance/cash/`, data);
    return response.data;
  },

  updateCashAccount: async (companyId, cashId, data) => {
    const response = await api.patch(`/companies/${companyId}/finance/cash/${cashId}/`, data);
    return response.data;
  },

  deleteCashAccount: async (companyId, cashId) => {
    const response = await api.delete(`/companies/${companyId}/finance/cash/${cashId}/`);
    return response.data;
  },

  // ============================================================
  // 8. DATA SYNCHRONIZATION
  // ============================================================
  syncRecords: async (companyId) => {
    const response = await api.post(`/companies/${companyId}/finance/sync-records/`);
    return response.data;
  },
};

export default financeService;
