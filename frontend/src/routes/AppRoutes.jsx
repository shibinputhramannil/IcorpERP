import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ERPLayout from '../layouts/ERPLayout';
import ProtectedRoute from './ProtectedRoute';
import PublicRoute from './PublicRoute';

// Auth Pages
import LoginPage from '../pages/LoginPage';
import ForgotPasswordPage from '../pages/ForgotPasswordPage';

// Module Pages
import DashboardPage from '../pages/DashboardPage';
import CompaniesPage from '../pages/CompaniesPage';
import EmployeesPage from '../pages/EmployeesPage';
import CRMPage from '../pages/CRMPage';
import InventoryPage from '../pages/InventoryPage';
import SalesPage from '../pages/SalesPage';
import PurchasePage from '../pages/PurchasePage';
import FinancePage from '../pages/FinancePage';
import ReportsPage from '../pages/ReportsPage';
import AIAssistantPage from '../pages/AIAssistantPage';
import WorkspacePage from '../pages/WorkspacePage';
import NotificationsPage from '../pages/NotificationsPage';
import SettingsPage from '../pages/SettingsPage';
import CalendarPage from '../pages/CalendarPage';
import NotesPage from '../pages/NotesPage';
import EmailPage from '../pages/EmailPage';
import DocumentsPage from '../pages/DocumentsPage';
import NotFoundPage from '../pages/NotFoundPage';

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public Authentication Routes */}
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Route>

      {/* Protected ERP Application Routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<ERPLayout />}>
          {/* Root redirect to Dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Core Live Modules */}
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/companies" element={<CompaniesPage />} />
          <Route path="/employees" element={<EmployeesPage />} />
          <Route path="/crm" element={<CRMPage />} />

          {/* Operations & Workflow Modules */}
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/sales" element={<SalesPage />} />

          <Route path="/purchase" element={<PurchasePage />} />

          <Route path="/finance" element={<FinancePage />} />
          <Route path="/reports" element={<ReportsPage />} />

          {/* Workspace & Collaboration Modules */}
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/notes" element={<NotesPage />} />
          <Route path="/email" element={<EmailPage />} />
          <Route path="/documents" element={<DocumentsPage />} />

          {/* Workspace & Collaboration Modules */}
          <Route path="/workspace" element={<WorkspacePage />} />
          <Route path="/notifications" element={<NotificationsPage />} />

          {/* System & Intelligence Modules */}
          <Route path="/ai-assistant" element={<AIAssistantPage />} />
          <Route path="/settings" element={<SettingsPage />} />

          {/* 404 Not Found within ERP Layout */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
