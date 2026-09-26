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
import AIPage from '../pages/AIPage';
import AIAssistantPage from '../pages/AIAssistantPage';
import ModulePlaceholderPage from '../pages/ModulePlaceholderPage';
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
        <Route
          path="/calendar"
          element={
            <ModulePlaceholderPage
              title="Calendar & Scheduling"
              subtitle="Coordinate internal events, client meetings, and sales follow-ups."
              category="Workspace & Collaboration"
              phaseNumber={9}
              features={[
                'Internal event scheduling',
                'Client & customer meetings',
                'Employee shift & meeting planning',
                'Sales follow-up reminders',
                'Optional Google Calendar synchronization bridge',
              ]}
            />
          }
        />

        <Route
          path="/notes"
          element={
            <ModulePlaceholderPage
              title="Enterprise Notes"
              subtitle="Collaborative notes contextualized to companies, deals, and contacts."
              category="Workspace & Collaboration"
              phaseNumber={9}
              features={[
                'Rich text notes editor',
                'Entity-linked notes (Companies, Contacts, Leads)',
                'Private and team-shared notes',
                'Tags and search filtering',
              ]}
            />
          }
        />

        <Route
          path="/email"
          element={
            <ModulePlaceholderPage
              title="Email Hub"
              subtitle="Unified corporate email client and outbound correspondence tracking."
              category="Workspace & Collaboration"
              phaseNumber={9}
              features={[
                'Inbox & sent folder viewing',
                'Email composer with template support',
                'Correspondence timeline linked to CRM contacts',
                'Standard IMAP/SMTP integration support',
              ]}
            />
          }
        />

        <Route
          path="/documents"
          element={
            <ModulePlaceholderPage
              title="Document Management"
              subtitle="Central repository for contracts, invoices, employee records, and quotations."
              category="Workspace & Collaboration"
              phaseNumber={9}
              features={[
                'Contract & NDA repository',
                'Generated invoice & quotation archives',
                'Employee compliance documents',
                'Secure access control & version history',
              ]}
            />
          }
        />

        <Route
          path="/notifications"
          element={
            <ModulePlaceholderPage
              title="Notification Center"
              subtitle="Real-time alerts, task reminders, and audit notices."
              category="Workspace & Collaboration"
              phaseNumber={9}
              features={[
                'Unread / read notification filtering',
                'Actionable task alerts',
                'System security & audit alerts',
                'Custom notification preferences',
              ]}
            />
          }
        />

        {/* System & Intelligence Modules */}
        <Route path="/ai" element={<AIPage />} />
        <Route path="/ai-assistant" element={<AIPage />} />

        <Route
          path="/settings"
          element={
            <ModulePlaceholderPage
              title="System Settings"
              subtitle="Organization settings, role assignments, and system preferences."
              category="System & Intelligence"
              phaseNumber={10}
              features={[
                'General organization configuration',
                'Security policies & password rules',
                'User roles and permissions matrix',
                'UI theme & regional preferences',
              ]}
            />
          }
        />

          {/* 404 Not Found within ERP Layout */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
