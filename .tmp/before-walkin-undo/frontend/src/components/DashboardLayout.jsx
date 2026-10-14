import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {
  AssignmentRounded,
  BarChartRounded,
  CloseRounded,
  DashboardRounded,
  FavoriteBorderRounded,
  HistoryRounded,
  Inventory2Rounded,
  LogoutRounded,
  MenuRounded,
  PeopleAltRounded,
  PersonRounded,
  ReceiptLongRounded,
  SettingsRounded,
  ShoppingBagRounded,
  StorefrontRounded,
  VerifiedRounded,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import DashboardWelcome from './DashboardWelcome';

const roleLabels = {
  admin: 'Administrator',
  staff: 'Staff',
  client: 'Client',
};

const navByRole = {
  admin: [
    { label: 'Inventory', href: '/admin/inventory', icon: Inventory2Rounded },
    { label: 'Audit Log', href: '/admin/audit-logs', icon: HistoryRounded },
    { label: 'Dashboard', href: '/admin/dashboard', icon: DashboardRounded },
    { label: 'Accounts', href: '/admin/accounts', icon: PeopleAltRounded },
    { label: 'Staff Approvals', href: '/admin/approvals/staff', icon: VerifiedRounded },
    { label: 'Client Approvals', href: '/admin/approvals/clients', icon: PeopleAltRounded },
    { label: 'Submissions', href: '/admin/approvals/submissions', icon: AssignmentRounded },
    { label: 'Reports', href: '/admin/reports', icon: BarChartRounded },
    { label: 'Product Monitor', href: '/admin/product-monitor', icon: Inventory2Rounded },
  ],
  staff: [
    { label: 'Inventory', href: '/staff/inventory', icon: Inventory2Rounded },
    { label: 'Dashboard', href: '/staff/dashboard', icon: DashboardRounded },
    { label: 'Products', href: '/staff/products', icon: Inventory2Rounded },
    { label: 'New Order', href: '/staff/order-management', icon: ShoppingBagRounded },
    { label: 'Receipts', href: '/staff/receipts', icon: ReceiptLongRounded },
    { label: 'Promos', href: '/staff/promos', icon: BarChartRounded },
    { label: 'Users', href: '/staff/users', icon: PeopleAltRounded },
    { label: 'Submissions', href: '/staff/submissions', icon: AssignmentRounded },
  ],
  client: [
    { label: 'Dashboard', href: '/client/dashboard', icon: DashboardRounded },
    { label: 'Purchase History', href: '/client/history', icon: HistoryRounded },
    { label: 'Favorites', href: '/client/favorites', icon: FavoriteBorderRounded },
    { label: 'Profile', href: '/client/profile', icon: PersonRounded },
  ],
};

const DashboardLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const [mobileOpen, setMobileOpen] = React.useState(false);

  const role = user?.role || (location.pathname.startsWith('/admin') ? 'admin' : location.pathname.startsWith('/staff') ? 'staff' : 'client');
  const navItems = navByRole[role] || navByRole.client;
  const isReportsPage = location.pathname.startsWith('/admin/reports');

  const currentPage =
    navItems.find(
      (item) =>
        location.pathname === item.href ||
        (item.href !== '/' && location.pathname.startsWith(`${item.href}/`))
    ) || navItems[0];

  const displayName = user?.full_name || user?.name || user?.email || 'User';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'U';

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const sidebar = (
    <Box
      sx={{
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'var(--sh-glass-raised)',
        backdropFilter: 'blur(22px) saturate(125%)',
        WebkitBackdropFilter: 'blur(22px) saturate(125%)',
        border: '1px solid rgba(255,255,255,.85)',
        borderRadius: { xs: 0, md: '26px' },
        boxShadow: '0 16px 48px rgba(24,61,50,.08)',
      }}
    >
      <Box
        sx={{
          px: 2.5,
          py: 2.2,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 1.2,
        }}
      >
        <Box
          sx={{
            width: 42,
            height: 42,
            borderRadius: 2.5,
            display: 'grid',
            placeItems: 'center',
            background: 'linear-gradient(135deg, #066649 0%, #27AE80 100%)',
            color: '#fff',
            boxShadow: '0 12px 24px rgba(6,102,73,0.18)',
          }}
        >
          <StorefrontRounded sx={{ fontSize: 22 }} />
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '.12em',
              textTransform: 'uppercase',
              color: '#5F817B',
            }}
          >
            StoreHub
          </Typography>
          <Typography
            sx={{
              mt: 0.2,
              fontSize: 15,
              fontWeight: 800,
              color: '#123D36',
              lineHeight: 1.2,
            }}
          >
            {roleLabels[role] || 'Dashboard'}
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ borderColor: '#E6F0EC' }} />

      <List
        aria-label="Dashboard navigation"
        sx={{
          px: 1.5,
          py: 1.5,
          flex: '1 1 0%',
          minHeight: 0,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
        }}
        disablePadding
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage.href === item.href;

          return (
            <ListItemButton
              key={item.href}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => {
                navigate(item.href);
                setMobileOpen(false);
              }}
              sx={{
                borderRadius: '24px',
                mb: 0.75,
                px: 1.25,
                py: 0.9,
                bgcolor: isActive ? '#087F5B' : 'transparent',
                color: isActive ? '#fff' : '#3D5B56',
                boxShadow: isActive ? 'inset 0 0 0 1px rgba(6,102,73,0.12)' : 'none',
                '&:hover': {
                  bgcolor: isActive ? '#066649' : 'rgba(6,102,73,0.06)',
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}>
                <Icon sx={{ fontSize: 20 }} />
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  fontWeight: isActive ? 800 : 700,
                  fontSize: 14,
                  lineHeight: 1.3,
                }}
              />
            </ListItemButton>
          );
        })}
      </List>

      <Box sx={{ px: 2, pt: 1.5, pb: 'max(16px, env(safe-area-inset-bottom))', flexShrink: 0, borderTop: '1px solid #E6F0EC' }}>
        <Box
          sx={{
            border: '1px solid #DDECE7',
            borderRadius: 2.5,
            bgcolor: 'var(--sh-glass-bg)',
            p: 1.5,
          }}
        >
          <Stack direction="row" spacing={1.2} alignItems="center">
            <Avatar
              sx={{
                width: 34,
                height: 34,
                bgcolor: '#066649',
                color: '#fff',
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              {initials}
            </Avatar>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                sx={{
                  fontWeight: 800,
                  fontSize: 13,
                  lineHeight: 1.2,
                  color: '#183B36',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {displayName}
              </Typography>
              <Chip
                label={roleLabels[role] || 'User'}
                size="small"
                sx={{
                  mt: 0.5,
                  height: 22,
                  bgcolor: '#D8F3E5',
                  color: '#066649',
                  fontWeight: 700,
                  '& .MuiChip-label': { px: 0.8, fontSize: 11 },
                }}
              />
            </Box>
          </Stack>

          <Button
            fullWidth
            variant="contained"
            startIcon={<LogoutRounded />}
            onClick={handleLogout}
            sx={{
              mt: 1.5,
              bgcolor: '#066649',
              color: '#fff',
              textTransform: 'none',
              fontWeight: 800,
              borderRadius: 1.75,
              boxShadow: 'none',
              '&:hover': {
                bgcolor: '#07543E',
                boxShadow: 'none',
              },
            }}
          >
            Log out
          </Button>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        minHeight: '100vh',
        bgcolor: 'var(--sh-page-tint)',
      }}
    >
      <Box
        sx={{
          display: { xs: 'none', md: 'block' },
          width: 280,
          flexShrink: 0,
          position: 'sticky',
          top: 16,
          m: 2,
          mr: 0,
          height: 'calc(100vh - 32px)',
          '@supports (height: 100dvh)': { height: 'calc(100dvh - 32px)' },
          alignSelf: 'flex-start',
        }}
      >
        {sidebar}
      </Box>

      <Box
        sx={{
          display: { xs: 'block', md: 'none' },
          position: 'sticky',
          top: 0,
          zIndex: 1300,
          bgcolor: 'var(--sh-glass-raised)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid #E6F0EC',
          px: 2,
          py: 1.2,
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1} alignItems="center">
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                background: 'linear-gradient(135deg, #066649 0%, #27AE80 100%)',
                color: '#fff',
              }}
            >
              <StorefrontRounded sx={{ fontSize: 18 }} />
            </Box>
            <Typography sx={{ fontWeight: 800, color: '#123D36' }}>
              {currentPage.label}
            </Typography>
          </Stack>

          <IconButton
            aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileOpen}
            aria-controls={mobileOpen ? 'mobile-navigation' : undefined}
            onClick={() => setMobileOpen((prev) => !prev)}
            sx={{ color: '#066649' }}
          >
            {mobileOpen ? <CloseRounded /> : <MenuRounded />}
          </IconButton>
        </Stack>

        {mobileOpen && (
          <Box
            id="mobile-navigation"
            sx={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              height: 'calc(100vh - 100%)',
              '@supports (height: 100dvh)': { height: 'calc(100dvh - 100%)' },
              overflow: 'hidden',
              bgcolor: 'var(--sh-glass-bg)',
              borderBottom: '1px solid #E6F0EC',
              boxShadow: '0 12px 30px rgba(6,102,73,0.08)',
              zIndex: 10,
            }}
          >
            {sidebar}
          </Box>
        )}
      </Box>

      <Box
        component="main"
        className="dashboard-content"
        sx={{
          flex: 1,
          minWidth: 0,
          p: { xs: 2, md: 3 },
        }}
      >
        {location.pathname.endsWith('/dashboard') && role !== 'staff' && <DashboardWelcome name={displayName} role={role} />}
        {isReportsPage ? children : (
        <Paper
          elevation={0}
          sx={{
            border: '1px solid #E7F0ED',
            borderRadius: 4,
            bgcolor: 'var(--sh-glass-bg)',
            p: { xs: 2, md: 3 },
            boxShadow: '0 12px 30px rgba(6,102,73,0.04)',
          }}
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            spacing={2}
            sx={{ mb: 2 }}
          >
            <Box>
              <Typography
                sx={{
                  fontSize: 12,
                  color: '#5F817B',
                  letterSpacing: '.12em',
                  textTransform: 'uppercase',
                  fontWeight: 800,
                }}
              >
                Overview
              </Typography>
              <Typography
                sx={{
                  mt: 0.3,
                  fontSize: { xs: 24, md: 30 },
                  lineHeight: 1.15,
                  fontWeight: 900,
                  color: '#123D36',
                }}
              >
                {currentPage.label}
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                icon={<SettingsRounded sx={{ fontSize: 16 }} />}
                label={roleLabels[role] || 'Dashboard'}
                sx={{
                  bgcolor: '#D8F3E5',
                  color: '#066649',
                  borderRadius: 2,
                  fontWeight: 800,
                  '& .MuiChip-icon': { color: '#066649' },
                }}
              />
            </Stack>
          </Stack>

          <Divider sx={{ mb: 2, borderColor: '#E6F0EC' }} />

          {children}
        </Paper>
        )}
      </Box>
    </Box>
  );
};

export default DashboardLayout;
