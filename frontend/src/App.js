import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Box } from '@mui/material';

import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout';

// Public pages
import Homepage from './pages/public/Homepage';
import Login from './pages/public/Login';
import LoginAdmin from './pages/public/LoginAdmin';
import LoginStaff from './pages/public/LoginStaff';
import LoginClient from './pages/public/LoginClient';
import RegisterClient from './pages/public/RegisterClient';

import ChangePassword, {
  ChangePasswordSuccess,
} from './pages/public/ChangePassword';

// Admin pages
import AdminDashboard from './pages/admin/Dashboard';
import AuditLogs from './pages/admin/AuditLogs';
import BodegaInventory from './pages/staff/BodegaInventory';
import AccountManagement from './pages/admin/AccountManagement';
import ClientApprovals from './pages/admin/ClientApprovals';
import StaffApprovals from './pages/admin/StaffApprovals';
import SubmissionApprovals from './pages/admin/SubmissionApprovals';
import Reports from './pages/admin/Reports';
import ProductMonitor from './pages/admin/ProductMonitor';

// Staff pages
import StaffDashboard from './pages/staff/Dashboard';
import ProductManagement from './pages/staff/ProductManagement';
import OrderManagement from './pages/staff/OrderManagement';
import ReceiptManagement from './pages/staff/ReceiptManagement';
import PromoManagement from './pages/staff/PromoManagement';
import UserManagement from './pages/staff/UserManagement';
import StaffSubmissions from './pages/staff/Submissions';

// Client/User pages
import UserDashboard from './pages/user/Dashboard';
import OrderHistory from './pages/user/OrderHistory';
import Profile from './pages/user/Profile';

function App() {
  const location = useLocation();

  // Detect dashboard routes
  const isDashboardRoute = /^(\/admin|\/staff|\/client)\//.test(
    location.pathname
  );
  const isHomeRoute = location.pathname === '/';
  const isLoginRoute = location.pathname === '/login';
  const isRegisterClientRoute = location.pathname === '/register/client';

  // Reusable protected dashboard wrapper
  const dashboardPage = (page, roles) => (
    <ProtectedRoute allowedRoles={roles}>
      <DashboardLayout>{page}</DashboardLayout>
    </ProtectedRoute>
  );

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
      }}
    >
      {/* ========================================
          PUBLIC NAVBAR
          Hidden on Admin / Staff / Client pages
      ======================================== */}
      {!isDashboardRoute && !isHomeRoute && !isLoginRoute && !isRegisterClientRoute && <Navbar />}

      {/* ========================================
          MAIN CONTENT
      ======================================== */}
      <Box
        component="main"
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
        }}
      >
        <Routes>
          {/* =====================================
              PUBLIC ROUTES
          ===================================== */}

          <Route
            path="/"
            element={<Homepage />}
          />

          <Route
            path="/login"
            element={<Login />}
          />

          <Route
            path="/login/admin"
            element={<LoginAdmin />}
          />

          <Route
            path="/login/staff"
            element={<LoginStaff />}
          />

          <Route
            path="/login/client"
            element={<LoginClient />}
          />

          <Route
            path="/register/client"
            element={<RegisterClient />}
          />

          {/* =====================================
              FIRST LOGIN PASSWORD CHANGE
          ===================================== */}

          <Route
            path="/change-password"
            element={
              <ProtectedRoute
                allowedRoles={['admin', 'staff', 'client']}
              >
                <ChangePassword />
              </ProtectedRoute>
            }
          />

          <Route
            path="/change-password/success"
            element={
              <ProtectedRoute
                allowedRoles={['admin', 'staff', 'client']}
              >
                <ChangePasswordSuccess />
              </ProtectedRoute>
            }
          />

          {/* =====================================
              ADMIN ROUTES
          ===================================== */}

          <Route
            path="/admin/dashboard"
            element={dashboardPage(
              <AdminDashboard />,
              ['admin']
            )}
          />
          <Route path="/admin/audit-logs" element={dashboardPage(<AuditLogs />, ['admin'])} />
          <Route path="/admin/inventory" element={dashboardPage(<BodegaInventory />, ['admin'])} />
          <Route path="/staff/inventory" element={dashboardPage(<BodegaInventory />, ['staff'])} />

          <Route
            path="/admin/accounts/clients"
            element={dashboardPage(
              <AccountManagement accountRole="client" />,
              ['admin']
            )}
          />
          <Route
            path="/admin/accounts/staff"
            element={dashboardPage(
              <AccountManagement accountRole="staff" />,
              ['admin']
            )}
          />

          <Route
            path="/admin/approvals/staff"
            element={dashboardPage(
              <StaffApprovals />,
              ['admin']
            )}
          />

          <Route
            path="/admin/approvals/clients"
            element={dashboardPage(
              <ClientApprovals />,
              ['admin']
            )}
          />

          <Route
            path="/admin/approvals/submissions"
            element={dashboardPage(
              <SubmissionApprovals />,
              ['admin']
            )}
          />

          <Route
            path="/admin/reports"
            element={dashboardPage(
              <Reports />,
              ['admin']
            )}
          />

          <Route
            path="/admin/product-monitor"
            element={dashboardPage(
              <ProductMonitor />,
              ['admin']
            )}
          />

          {/* =====================================
              STAFF ROUTES
          ===================================== */}

          <Route
            path="/staff/dashboard"
            element={dashboardPage(
              <StaffDashboard />,
              ['staff']
            )}
          />

          <Route
            path="/staff/products"
            element={dashboardPage(
              <ProductManagement />,
              ['staff']
            )}
          />

          <Route
            path="/staff/order-management"
            element={dashboardPage(
              <OrderManagement />,
              ['staff']
            )}
          />

          <Route
            path="/staff/receipts"
            element={dashboardPage(
              <ReceiptManagement />,
              ['staff']
            )}
          />

          <Route
            path="/staff/promos"
            element={dashboardPage(
              <PromoManagement />,
              ['staff']
            )}
          />

          <Route
            path="/staff/users"
            element={dashboardPage(
              <UserManagement />,
              ['staff']
            )}
          />

          <Route
            path="/staff/submissions"
            element={dashboardPage(
              <StaffSubmissions />,
              ['staff']
            )}
          />

          {/* =====================================
              CLIENT ROUTES
          ===================================== */}

          <Route
            path="/client/dashboard"
            element={dashboardPage(
              <UserDashboard />,
              ['client']
            )}
          />

          <Route
            path="/client/history"
            element={dashboardPage(
              <OrderHistory />,
              ['client']
            )}
          />

          <Route
            path="/client/profile"
            element={dashboardPage(
              <Profile />,
              ['client']
            )}
          />
        </Routes>
      </Box>

      {/*
        WALA NAY GLOBAL <Footer /> DINHI.

        Reason:
        Ang Homepage.jsx adunay kaugalingong
        enhanced footer.

        Before:
          <Homepage />
          <Footer />   <-- mao ni naka-double

        Now:
          <Homepage /> <-- usa ra ka footer
      */}
    </Box>
  );
}

export default App;
