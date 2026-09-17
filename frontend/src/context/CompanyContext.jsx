import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import companyService from '../services/companyService';

const CompanyContext = createContext(null);

export function CompanyProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [activeCompany, setActiveCompanyState] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchCompanies = useCallback(async () => {
    if (!isAuthenticated) {
      setCompanies([]);
      setActiveCompanyState(null);
      return;
    }

    try {
      setLoading(true);
      const data = await companyService.getCompanies();
      setCompanies(data);

      // Determine active company:
      // 1. Stored in localStorage
      // 2. Or first available company
      const storedId = localStorage.getItem('active_company_id');
      const matched = data.find((c) => String(c.id) === String(storedId));

      if (matched) {
        setActiveCompanyState(matched);
      } else if (data.length > 0) {
        setActiveCompanyState(data[0]);
        localStorage.setItem('active_company_id', data[0].id);
      } else {
        setActiveCompanyState(null);
      }
    } catch (err) {
      console.error('Failed to load companies:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies, user]);

  const setActiveCompany = (companyOrId) => {
    if (!companyOrId) {
      setActiveCompanyState(null);
      localStorage.removeItem('active_company_id');
      return;
    }

    let selected = null;
    if (typeof companyOrId === 'object' && companyOrId.id) {
      selected = companyOrId;
    } else {
      selected = companies.find((c) => String(c.id) === String(companyOrId));
    }

    if (selected) {
      setActiveCompanyState(selected);
      localStorage.setItem('active_company_id', selected.id);
    }
  };

  const value = {
    companies,
    activeCompany,
    activeCompanyId: activeCompany ? activeCompany.id : null,
    loadingCompanies: loading,
    reloadCompanies: fetchCompanies,
    setActiveCompany,
  };

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}

export default CompanyContext;
