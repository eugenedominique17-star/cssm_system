import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, user, loading } = useAuth();
  const { pathname } = useLocation();

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const normalizedRole = user?.role === 'user' ? 'client' : user?.role;
  if (user?.must_change_password && pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(normalizedRole)) {
    // Redirect to appropriate dashboard
    const redirectMap = {
      admin: '/admin/dashboard',
      staff: '/staff/dashboard',
      client: '/client/dashboard'
    };
    return <Navigate to={redirectMap[normalizedRole] || '/'} replace />;
  }

  return children;
};

export default ProtectedRoute;
