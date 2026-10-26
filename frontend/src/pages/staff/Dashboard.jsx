// Staff Dashboard Component
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useNavigate } from 'react-router-dom';

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';

import {
  ArrowForwardRounded,
  CheckCircleRounded,
  Inventory2Outlined,
  LocalAtmRounded,
  LocalOfferOutlined,
  NotificationsOutlined,
  PeopleOutlineRounded,
  PointOfSaleRounded,
  ReceiptLongOutlined,
  RefreshRounded,
  ScheduleRounded,
  ShoppingCartRounded,
  StorefrontRounded,
  TrendingUpRounded,
  WarningAmberRounded,
} from '@mui/icons-material';

import API from '../../api/accountAdmin';
import { getTransactions } from '../../api/sales';
import { getCatalog } from '../../api/catalog';
import AnimatedNumber from '../../components/AnimatedNumber';
import DashboardSkeleton from '../../components/DashboardSkeleton';

const StaffDashboard = () => {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [promos, setPromos] = useState([]);
  const [users, setUsers] = useState([]);

  const [accountNotice, setAccountNotice] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [currentUser, setCurrentUser] = useState(null);

  const fetchDashboardData = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError('');

        const [
          productsRes,
          transactionsRes,
          promosRes,
          usersRes,
          meRes,
        ] = await Promise.all([
          getCatalog('products'),
          getTransactions(),
          getCatalog('promos'),
          API.get('/users'),
          API.get('/auth/me'),
        ]);

        setProducts(
          Array.isArray(productsRes.data)
            ? productsRes.data
            : []
        );

        setTransactions(
          Array.isArray(transactionsRes.data)
            ? transactionsRes.data
            : []
        );

        setPromos(
          Array.isArray(promosRes.data)
            ? promosRes.data
            : []
        );

        setUsers(
          Array.isArray(usersRes.data)
            ? usersRes.data
            : []
        );

        setCurrentUser(meRes.data || null);

        const status = String(
          meRes.data?.status || ''
        ).toLowerCase();

        if (status === 'rejected') {
          setAccountNotice({
            severity: 'error',
            title: 'Account Rejected',
            message:
              'Your Staff account has been rejected by the Administrator. Some functions may not be available.',
          });
        } else if (status === 'pending') {
          setAccountNotice({
            severity: 'warning',
            title: 'Account Pending Approval',
            message:
              'Your Staff account is still waiting for Administrator approval.',
          });
        } else if (status === 'suspended') {
          setAccountNotice({
            severity: 'error',
            title: 'Account Suspended',
            message:
              'Your Staff account is currently suspended. Please contact the Administrator.',
          });
        } else {
          setAccountNotice(null);
        }
      } catch (err) {
        console.error(
          'Failed to load Staff Dashboard:',
          err
        );

        setError(
          err?.response?.data?.message ||
            err?.response?.data?.error ||
            'Unable to load dashboard information.'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const getStock = (product) =>
    Number(
      product?.stock ??
        product?.stock_quantity ??
        0
    );

  const todayTransactions = useMemo(() => {
    const today = new Date();

    return transactions.filter((transaction) => {
      if (!transaction.created_at) return false;

      const transactionDate = new Date(
        transaction.created_at
      );

      return (
        transactionDate.getFullYear() ===
          today.getFullYear() &&
        transactionDate.getMonth() ===
          today.getMonth() &&
        transactionDate.getDate() ===
          today.getDate()
      );
    });
  }, [transactions]);

  const todaySales = todayTransactions.reduce(
    (total, transaction) =>
      total +
      Number(transaction.total_amount || 0),
    0
  );

  const lowStockProducts = products.filter(
    (product) => {
      const stock = getStock(product);

      return stock > 0 && stock <= 10;
    }
  );

  const outOfStockProducts = products.filter(
    (product) => getStock(product) <= 0
  );

  // Additive: expiry tracker helpers (safe, purely display logic)
  const getDaysToExpiry = (expiryDate) => {
    if (!expiryDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
  };

  const expiredProducts = products.filter(
    (product) => getDaysToExpiry(product.expiry_date) !== null &&
      getDaysToExpiry(product.expiry_date) < 0
  );

  const expiringSoonProducts = products.filter(
    (product) => {
      const days = getDaysToExpiry(product.expiry_date);
      return days !== null && days >= 0 && days <= 7;
    }
  );

  const activePromos = promos.filter((promo) => {
    const status = String(
      promo.status || ''
    ).toLowerCase();

    if (status !== 'active') return false;

    const now = new Date();

    if (
      promo.start_date &&
      new Date(promo.start_date) > now
    ) {
      return false;
    }

    if (
      promo.end_date &&
      new Date(promo.end_date) < now
    ) {
      return false;
    }

    return true;
  });

  const pendingItems =
    products.filter(
      (product) =>
        String(product.status || '').toLowerCase() ===
        'pending'
    ).length +
    promos.filter(
      (promo) =>
        String(promo.status || '').toLowerCase() ===
        'pending'
    ).length;

  const clientUsers = users.filter((user) => {
    const role = String(
      user.role || ''
    ).toLowerCase();

    return role === 'client' || role === 'user';
  });

  const formatPrice = (amount) =>
    `₱${Number(amount || 0).toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const userName =
    currentUser?.name ||
    currentUser?.first_name ||
    'Staff';

  const firstName = String(userName)
    .trim()
    .split(' ')[0];

  const statCards = [
    {
      label: 'Total Products',
      value: products.length,
      subtitle: `${lowStockProducts.length} low stock`,
      icon: <Inventory2Outlined />,
      color: '#047857',
      background: '#D8F3E5',
      link: '/staff/products',
    },
    {
      label: "Today's Transactions",
      value: todayTransactions.length,
      subtitle: formatPrice(todaySales),
      icon: <ReceiptLongOutlined />,
      color: '#2563EB',
      background: '#EFF6FF',
      link: '/staff/receipts',
    },
    {
      label: 'Active Promos',
      value: activePromos.length,
      subtitle: `${promos.length} total promos`,
      icon: <LocalOfferOutlined />,
      color: '#7C3AED',
      background: '#F5F3FF',
      link: '/staff/promos',
    },
    {
      label: 'Clients',
      value: clientUsers.length,
      subtitle: `${users.length} total users`,
      icon: <PeopleOutlineRounded />,
      color: '#D97706',
      background: '#FFFBEB',
      link: '/staff/users',
    },
  ];

  const quickActions = [
    {
      label: 'Manage Products',
      description:
        'Add products, update prices, stock and product information.',
      icon: <Inventory2Outlined />,
      link: '/staff/products',
      color: '#047857',
      background: '#D8F3E5',
    },
    {
      label: 'Create Receipt',
      description:
        'Process a walk-in or registered customer transaction.',
      icon: <PointOfSaleRounded />,
      link: '/staff/receipts',
      color: '#2563EB',
      background: '#EFF6FF',
    },
    {
      label: 'Manage Promos',
      description:
        'Create promotions and submit them for approval.',
      icon: <LocalOfferOutlined />,
      link: '/staff/promos',
      color: '#7C3AED',
      background: '#F5F3FF',
    },
    {
      label: 'Manage Users',
      description:
        'Create Client accounts and review Staff account activity.',
      icon: <PeopleOutlineRounded />,
      link: '/staff/users',
      color: '#D97706',
      background: '#FFFBEB',
    },
  ];

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: 450,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        <DashboardSkeleton />

        <Typography
          sx={{
            color: '#617B6C',
            fontSize: 13,
          }}
        >
          Loading Staff Dashboard...
        </Typography>
      </Box>
    );
  }

  return (
    <Box className="page-container">
      {/* HERO HEADER */}

      <Paper
        elevation={0}
        className="dashboard-hero"
        sx={{
          position: 'relative',
          overflow: 'hidden',
          mb: 0,
          color: '#FFFFFF',
          background:
            'linear-gradient(135deg, #022C22 0%, #064E3B 45%, #047857 100%)',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            width: 360,
            height: 360,
            borderRadius: '50%',
            right: -130,
            top: -180,
            background:
              'radial-gradient(circle, rgba(253,230,138,.16), transparent 70%)',
          }}
        />

        <Box
          sx={{
            position: 'absolute',
            width: 230,
            height: 230,
            borderRadius: '50%',
            left: -120,
            bottom: -150,
            bgcolor: 'rgba(255,255,255,.04)',
          }}
        />

        <Stack
          direction={{
            xs: 'column',
            md: 'row',
          }}
          justifyContent="space-between"
          alignItems={{
            xs: 'flex-start',
            md: 'center',
          }}
          spacing={3}
          sx={{
            position: 'relative',
            zIndex: 2,
          }}
        >
          <Box>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{
                mb: 1.4,
              }}
            >
              <StorefrontRounded
                sx={{
                  color: '#FDE68A',
                  fontSize: 20,
                }}
              />

              <Typography
                sx={{
                  color:
                    'rgba(255,255,255,.72)',
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '.12em',
                }}
              >
                StoreHub Staff Workspace
              </Typography>
            </Stack>

            <Typography
              sx={{
                fontSize: {
                  xs: '2rem',
                  md: '2.65rem',
                },
                fontWeight: 900,
                lineHeight: 1.1,
                letterSpacing: '-.045em',
              }}
            >
              Welcome back, {firstName}.
            </Typography>

            <Typography
              sx={{
                mt: 1.3,
                maxWidth: 600,
                color:
                  'rgba(255,255,255,.68)',
                fontSize: 13.5,
                lineHeight: 1.7,
              }}
            >
              Monitor inventory, process sales,
              manage promotions and handle
              customer accounts from one place.
            </Typography>
          </Box>

          <Stack
            direction="row"
            spacing={1.2}
          >
            <Tooltip title="Refresh dashboard">
              <span>
                <IconButton
                  onClick={() =>
                    fetchDashboardData(true)
                  }
                  disabled={refreshing}
                  sx={{
                    width: 46,
                    height: 46,
                    color: '#FFFFFF',
                    bgcolor:
                      'rgba(255,255,255,.1)',
                    border:
                      '1px solid rgba(255,255,255,.14)',
                    '&:hover': {
                      bgcolor:
                        'rgba(255,255,255,.16)',
                    },
                  }}
                >
                  {refreshing ? (
                    <CircularProgress
                      size={20}
                      sx={{
                        color: '#FFFFFF',
                      }}
                    />
                  ) : (
                    <RefreshRounded />
                  )}
                </IconButton>
              </span>
            </Tooltip>

            <Button
              variant="contained"
              startIcon={
                <PointOfSaleRounded />
              }
              onClick={() =>
                navigate('/staff/receipts')
              }
              sx={{
                minHeight: 46,
                px: 2.3,
                bgcolor: '#FDE68A',
                color: '#422006',
                borderRadius: 3,
                textTransform: 'none',
                fontWeight: 850,
                boxShadow: 'none',
                '&:hover': {
                  bgcolor: '#FCD34D',
                  boxShadow: 'none',
                },
              }}
            >
              New Sale
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* ERROR */}

      {error && (
        <Alert
          severity="error"
          onClose={() => setError('')}
          sx={{
            mb: 3,
            borderRadius: 3,
          }}
        >
          {error}
        </Alert>
      )}

      {/* ACCOUNT NOTICE */}

      {accountNotice && (
        <Alert
          severity={accountNotice.severity}
          icon={<NotificationsOutlined />}
          sx={{
            mb: 3,
            borderRadius: 3,
            '& .MuiAlert-message': {
              width: '100%',
            },
          }}
        >
          <Typography
            sx={{
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            {accountNotice.title}
          </Typography>

          <Typography
            sx={{
              mt: 0.4,
              fontSize: 12.5,
              lineHeight: 1.6,
            }}
          >
            {accountNotice.message}
          </Typography>
        </Alert>
      )}

      {/* STOCK HEALTH ALERT (additive - safe) */}
      {(outOfStockProducts.length > 0 ||
        lowStockProducts.length > 0) && (
        <Alert
          severity={
            outOfStockProducts.length > 0
              ? 'error'
              : 'warning'
          }
          icon={
            <Inventory2Outlined fontSize="small" />
          }
          action={
            <Button
              size="small"
              onClick={() =>
                navigate('/staff/products')
              }
              sx={{ ml: 1 }}
            >
              View products
            </Button>
          }
          sx={{
            mb: 3,
            borderRadius: 3,
            alignItems: 'center',
          }}
        >
          <Typography
            sx={{
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            {outOfStockProducts.length > 0
              ? `⚠ ${outOfStockProducts.length} product${
                  outOfStockProducts.length > 1
                    ? 's'
                    : ''
                } out of stock`
              : `⚠ ${lowStockProducts.length} product${
                  lowStockProducts.length > 1
                    ? 's'
                    : ''
                } running low on stock`}
          </Typography>

          <Typography
            sx={{
              mt: 0.3,
              fontSize: 12.5,
              lineHeight: 1.6,
              color: 'text.secondary',
            }}
          >
            {[
              ...outOfStockProducts,
              ...lowStockProducts,
            ]
              .slice(0, 5)
              .map((p) => p.name)
              .join(', ')}
            {outOfStockProducts.length +
              lowStockProducts.length >
            5
              ? '...'
              : ''}
          </Typography>
        </Alert>
      )}

      {/* EXPIRY HEALTH ALERT (additive - safe) */}
      {(expiredProducts.length > 0 ||
        expiringSoonProducts.length > 0) && (
        <Alert
          severity={
            expiredProducts.length > 0 ? 'error' : 'warning'
          }
          icon={<Inventory2Outlined fontSize="small" />}
          action={
            <Button
              size="small"
              onClick={() =>
                navigate('/staff/products')
              }
              sx={{ ml: 1 }}
            >
              View products
            </Button>
          }
          sx={{
            mb: 3,
            borderRadius: 3,
            alignItems: 'center',
          }}
        >
          <Typography
            sx={{
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            {expiredProducts.length > 0
              ? `⏰ ${expiredProducts.length} product${
                  expiredProducts.length > 1
                    ? 's'
                    : ''
                } already expired`
              : `⏰ ${expiringSoonProducts.length} product${
                  expiringSoonProducts.length > 1
                    ? 's'
                    : ''
                } expiring within 7 days`}
          </Typography>

          <Typography
            sx={{
              mt: 0.3,
              fontSize: 12.5,
              lineHeight: 1.6,
              color: 'text.secondary',
            }}
          >
            {[
              ...expiredProducts,
              ...expiringSoonProducts,
            ]
              .slice(0, 5)
              .map((p) => p.name)
              .join(', ')}
            {expiredProducts.length +
              expiringSoonProducts.length >
            5
              ? '...'
              : ''}
          </Typography>
        </Alert>
      )}

      {/* KPI CARDS */}

      <Grid
        container
        spacing={2.2}
        sx={{
          mb: 3.5,
        }}
      >
        {statCards.map((stat) => (
          <Grid
            item
            xs={12}
            sm={6}
            lg={3}
            key={stat.label}
          >
            <Card
              elevation={0}
              onClick={() =>
                navigate(stat.link)
              }
              sx={{
                height: '100%',
                cursor: 'pointer',
                bgcolor: 'var(--sh-glass-bg)',
                border: '1px solid #E8EEF3',
                borderRadius: 3,
                transition: 'all .22s ease',
                '&:hover': {
                  transform: 'translateY(-6px)',
                  boxShadow: '0 18px 40px rgba(2,6,23,.06)',
                  borderColor: 'transparent',
                },
              }}
            >
              <CardContent
                sx={{
                  p: '18px !important',
                }}
              >
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="flex-start"
                >
                  <Box
                    sx={{
                      width: 52,
                      height: 52,
                      display: 'grid',
                      placeItems: 'center',
                      bgcolor:
                        stat.background,
                      color: stat.color,
                      borderRadius: 3,
                    }}
                  >
                    {stat.icon}
                  </Box>

                  <ArrowForwardRounded
                    sx={{
                      color: '#CBD5E1',
                      fontSize: 20,
                    }}
                  />
                </Stack>

                <Typography
                  sx={{
                    mt: 2.3,
                    color: '#183D32',
                    fontSize: 28,
                    lineHeight: 1,
                    fontWeight: 900,
                    letterSpacing: '-.03em',
                  }}
                >
                  <AnimatedNumber value={stat.value} />
                </Typography>

                <Typography
                  sx={{
                    mt: 0.8,
                    color: '#4C695A',
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  {stat.label}
                </Typography>

                <Typography
                  sx={{
                    mt: 0.45,
                    color: '#839B8C',
                    fontSize: 10.5,
                  }}
                >
                  {stat.subtitle}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* OPERATIONS OVERVIEW */}

      <Grid
        container
        spacing={2.5}
        sx={{ mb: 3.5 }}
      >
        {/* INVENTORY HEALTH */}

        <Grid
          item
          xs={12}
          lg={5}
        >
          <Paper
            elevation={0}
            sx={{
              height: '100%',
              p: 3,
              borderRadius: 4,
              bgcolor: 'var(--sh-glass-bg)',
              border:
                '1px solid #D5E5D9',
            }}
          >
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{
                mb: 2.5,
              }}
            >
              <Box>
                <Typography
                  sx={{
                    color: '#183D32',
                    fontSize: 16.5,
                    fontWeight: 850,
                  }}
                >
                  Inventory Health
                </Typography>

                <Typography
                  sx={{
                    mt: 0.3,
                    color: '#839B8C',
                    fontSize: 11,
                  }}
                >
                  Current stock condition
                </Typography>
              </Box>

              <Inventory2Outlined
                sx={{
                  color: '#059669',
                }}
              />
            </Stack>

            <Stack spacing={2.4}>
              <Box>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  sx={{
                    mb: 0.8,
                  }}
                >
                  <Typography
                    sx={{
                      color: '#617B6C',
                      fontSize: 12,
                    }}
                  >
                    Healthy Stock
                  </Typography>

                  <Typography
                    sx={{
                      color: '#047857',
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    {Math.max(
                      products.length -
                        lowStockProducts.length -
                        outOfStockProducts.length,
                      0
                    )}
                  </Typography>
                </Stack>

                <LinearProgress
                  variant="determinate"
                  value={
                    products.length
                      ? Math.min(
                          100,
                          ((products.length -
                            lowStockProducts.length -
                            outOfStockProducts.length) /
                            products.length) *
                            100
                        )
                      : 0
                  }
                  sx={{
                    height: 8,
                    borderRadius: 10,
                    bgcolor: '#D8F3E5',
                    '& .MuiLinearProgress-bar':
                      {
                        bgcolor:
                          '#059669',
                        borderRadius:
                          10,
                      },
                  }}
                />
              </Box>

              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                >
                  <Box
                    sx={{
                      width: 34,
                      height: 34,
                      display: 'grid',
                      placeItems: 'center',
                      bgcolor: '#FFFBEB',
                      color: '#D97706',
                      borderRadius: 2.2,
                    }}
                  >
                    <WarningAmberRounded
                      sx={{
                        fontSize: 18,
                      }}
                    />
                  </Box>

                  <Box>
                    <Typography
                      sx={{
                        color: '#365C4B',
                        fontSize: 12,
                        fontWeight: 750,
                      }}
                    >
                      Low Stock
                    </Typography>

                    <Typography
                      sx={{
                        color: '#839B8C',
                        fontSize: 10.5,
                      }}
                    >
                      Needs attention
                    </Typography>
                  </Box>
                </Stack>

                <Chip
                  label={
                    lowStockProducts.length
                  }
                  size="small"
                  sx={{
                    bgcolor: '#FFFBEB',
                    color: '#B45309',
                    fontWeight: 800,
                  }}
                />
              </Stack>

              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                >
                  <Box
                    sx={{
                      width: 34,
                      height: 34,
                      display: 'grid',
                      placeItems: 'center',
                      bgcolor: '#FEF2F2',
                      color: '#DC2626',
                      borderRadius: 2.2,
                    }}
                  >
                    <WarningAmberRounded
                      sx={{
                        fontSize: 18,
                      }}
                    />
                  </Box>

                  <Box>
                    <Typography
                      sx={{
                        color: '#365C4B',
                        fontSize: 12,
                        fontWeight: 750,
                      }}
                    >
                      Out of Stock
                    </Typography>

                    <Typography
                      sx={{
                        color: '#839B8C',
                        fontSize: 10.5,
                      }}
                    >
                      No available units
                    </Typography>
                  </Box>
                </Stack>

                <Chip
                  label={
                    outOfStockProducts.length
                  }
                  size="small"
                  sx={{
                    bgcolor: '#FEF2F2',
                    color: '#B91C1C',
                    fontWeight: 800,
                  }}
                />
              </Stack>

              <Button
                fullWidth
                variant="outlined"
                onClick={() =>
                  navigate('/staff/products')
                }
                endIcon={
                  <ArrowForwardRounded />
                }
                sx={{
                  mt: 1,
                  borderRadius: 3,
                  color: '#047857',
                  borderColor: '#A7D7C6',
                  textTransform: 'none',
                  fontWeight: 750,
                  '&:hover': {
                    bgcolor: '#F0FDF4',
                    borderColor: '#059669',
                  },
                }}
              >
                Review Inventory
              </Button>
            </Stack>
          </Paper>
        </Grid>

        {/* TODAY ACTIVITY */}

        <Grid
          item
          xs={12}
          lg={7}
        >
          <Paper
            elevation={0}
            sx={{
              height: '100%',
              p: 3,
              borderRadius: 4,
              bgcolor: 'var(--sh-glass-bg)',
              border:
                '1px solid #D5E5D9',
            }}
          >
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{
                mb: 2.5,
              }}
            >
              <Box>
                <Typography
                  sx={{
                    color: '#183D32',
                    fontSize: 16.5,
                    fontWeight: 850,
                  }}
                >
                  Today's Store Activity
                </Typography>

                <Typography
                  sx={{
                    mt: 0.3,
                    color: '#839B8C',
                    fontSize: 11,
                  }}
                >
                  Quick operational summary
                </Typography>
              </Box>

              <TrendingUpRounded
                sx={{
                  color: '#2563EB',
                }}
              />
            </Stack>

            <Grid
              container
              spacing={2}
            >
              {[
                {
                  label: 'Sales Today',
                  value:
                    formatPrice(todaySales),
                  icon: <LocalAtmRounded />,
                  color: '#059669',
                  background: '#D8F3E5',
                },
                {
                  label: 'Transactions',
                  value:
                    todayTransactions.length,
                  icon: <ReceiptLongOutlined />,
                  color: '#2563EB',
                  background: '#EFF6FF',
                },
                {
                  label: 'Active Promos',
                  value:
                    activePromos.length,
                  icon: <LocalOfferOutlined />,
                  color: '#7C3AED',
                  background: '#F5F3FF',
                },
                {
                  label: 'Pending Items',
                  value: pendingItems,
                  icon: <ScheduleRounded />,
                  color: '#D97706',
                  background: '#FFFBEB',
                },
              ].map((item) => (
                <Grid
                  item
                  xs={12}
                  sm={6}
                  key={item.label}
                >
                  <Box
                    sx={{
                      p: 2,
                      height: '100%',
                      border:
                        '1px solid #EDF3E8',
                      borderRadius: 3,
                    }}
                  >
                    <Stack
                      direction="row"
                      spacing={1.2}
                      alignItems="center"
                    >
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          flexShrink: 0,
                          display: 'grid',
                          placeItems: 'center',
                          bgcolor:
                            item.background,
                          color: item.color,
                          borderRadius: 2.5,
                        }}
                      >
                        {item.icon}
                      </Box>

                      <Box>
                        <Typography
                          sx={{
                            color: '#839B8C',
                            fontSize: 10.5,
                            fontWeight: 700,
                          }}
                        >
                          {item.label}
                        </Typography>

                        <Typography
                          sx={{
                            mt: 0.2,
                            color: '#183D32',
                            fontSize: 17,
                            fontWeight: 850,
                          }}
                        >
                          {item.value}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>
      </Grid>

      {/* QUICK ACTIONS */}

      <Box sx={{ mb: 2 }}>
        <Typography
          sx={{
            color: '#183D32',
            fontSize: 19,
            fontWeight: 850,
            letterSpacing: '-.02em',
          }}
        >
          Quick Actions
        </Typography>

        <Typography
          sx={{
            mt: 0.3,
            color: '#839B8C',
            fontSize: 11.5,
          }}
        >
          Access frequently used Staff tools.
        </Typography>
      </Box>

      <Grid
        container
        spacing={2.2}
      >
        {quickActions.map((action) => (
          <Grid
            item
            xs={12}
            sm={6}
            lg={3}
            key={action.label}
          >
            <Card
              elevation={0}
              onClick={() =>
                navigate(action.link)
              }
              sx={{
                height: '100%',
                cursor: 'pointer',
                bgcolor: 'var(--sh-glass-bg)',
                border:
                  '1px solid #D5E5D9',
                borderRadius: 4,
                transition:
                  'all .22s ease',

                '&:hover': {
                  transform:
                    'translateY(-4px)',
                  borderColor:
                    action.color,
                  boxShadow:
                    '0 16px 36px rgba(24,61,50,.06)',

                  '& .action-arrow': {
                    transform:
                      'translateX(4px)',
                  },

                  '& .action-icon': {
                    transform:
                      'scale(1.08)',
                  },
                },
              }}
            >
              <CardContent
                sx={{
                  p: '22px !important',
                }}
              >
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Box
                    className="action-icon"
                    sx={{
                      width: 48,
                      height: 48,
                      display: 'grid',
                      placeItems: 'center',
                      bgcolor:
                        action.background,
                      color: action.color,
                      borderRadius: 3,
                      transition:
                        'transform .22s ease',
                    }}
                  >
                    {action.icon}
                  </Box>

                  <ArrowForwardRounded
                    className="action-arrow"
                    sx={{
                      color: '#CBD5E1',
                      transition:
                        'transform .22s ease',
                    }}
                  />
                </Stack>

                <Typography
                  sx={{
                    mt: 2,
                    color: '#183D32',
                    fontSize: 15,
                    fontWeight: 850,
                  }}
                >
                  {action.label}
                </Typography>

                <Typography
                  sx={{
                    mt: 0.7,
                    minHeight: 38,
                    color: '#617B6C',
                    fontSize: 11.5,
                    lineHeight: 1.6,
                  }}
                >
                  {action.description}
                </Typography>

                <Typography
                  sx={{
                    mt: 1.7,
                    color: action.color,
                    fontSize: 11,
                    fontWeight: 800,
                  }}
                >
                  Open module →
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default StaffDashboard;
