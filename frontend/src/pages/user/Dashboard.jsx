import DashboardSkeleton from '../../components/DashboardSkeleton';
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
  CircularProgress,
  Grid,
  IconButton,
  Paper,
  Stack,
  ThemeProvider,
  Tooltip,
  Typography,
} from '@mui/material';

import {
  ArrowForwardRounded,
  DarkModeRounded,
  Inventory2Outlined,
  LightModeRounded,
  LocalAtmRounded,
  LocalOfferRounded,
  ReceiptLongRounded,
  RefreshRounded,
  ShoppingBagOutlined,
  StorefrontRounded,
  WarningAmberRounded,
} from '@mui/icons-material';

import API from '../../api/axios';
import { useDarkMode } from '../../hooks/useDarkMode';
import { useFavorites } from '../../hooks/useFavorites';
import { createAppTheme } from '../../theme';
import ProductCard from '../../components/ProductCard';
import FeaturedCarousel from '../../components/FeaturedCarousel';
import SearchFilterBar from '../../components/SearchFilterBar';
import DealCountdown from '../../components/DealCountdown';
import AnalyticsCharts from '../../components/AnalyticsCharts';
import FloatingActionPanel from '../../components/FloatingActionPanel';

const UserDashboard = () => {
  const navigate = useNavigate();
  const { isDarkMode, toggle: toggleDarkMode } = useDarkMode();
  const {
    favorites,
    toggleFavorite,
    isFavorited,
  } = useFavorites();

  const [data, setData] = useState({
    products: [],
    promos: [],
    recentOrders: [],
    allOrders: [],
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSettings, setFilterSettings] = useState({
    priceRange: [0, 10000],
    sortBy: 'relevant',
    inStockOnly: false,
  });

  /* =========================================================
     FETCH DATA
  ========================================================= */

  const fetchData = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError('');

        const [
          prodRes,
          promoRes,
          transRes,
        ] = await Promise.all([
          API.get('/products?active=true'),
          API.get('/promos?active=true'),
          API.get('/transactions/my'),
        ]);

        const products = Array.isArray(prodRes.data)
          ? prodRes.data
          : [];

        const promos = Array.isArray(promoRes.data)
          ? promoRes.data
          : [];

        const orders = Array.isArray(transRes.data)
          ? transRes.data
          : [];

        const sortedOrders = [...orders].sort(
          (a, b) =>
            new Date(b.created_at || 0) -
            new Date(a.created_at || 0)
        );

        setData({
          products,
          promos,
          allOrders: sortedOrders,
          recentOrders: sortedOrders.slice(0, 5),
        });
      } catch (error) {
        console.error(
          'Failed to fetch dashboard data:',
          error
        );

        setError(
          error?.response?.data?.message ||
            error?.response?.data?.error ||
            'Unable to load your dashboard.'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* =========================================================
     HELPERS
  ========================================================= */

  const formatPrice = (price) =>
    `₱${Number(price || 0).toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const formatDate = (date) => {
    if (!date) return '—';

    return new Date(date).toLocaleDateString(
      'en-PH',
      {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }
    );
  };

  const getStock = (product) =>
    Number(
      product?.stock ??
        product?.stock_quantity ??
        0
    );

  const getPromoLabel = (promo) => {
    if (
      promo.discount_type === 'percentage'
    ) {
      return `${Number(
        promo.discount_value || 0
      )}% OFF`;
    }

    if (promo.discount_type === 'fixed') {
      return `${formatPrice(
        promo.discount_value
      )} OFF`;
    }

    return 'Bundle Deal';
  };

  /* =========================================================
     STATS & FILTERING
  ========================================================= */

  const availableProducts = useMemo(
    () =>
      data.products.filter(
        (product) => getStock(product) > 0
      ),
    [data.products]
  );

  const lowStockProducts = useMemo(
    () =>
      data.products.filter((product) => {
        const stock = getStock(product);

        return stock > 0 && stock <= 10;
      }),
    [data.products]
  );

  const totalSpent = useMemo(
    () =>
      data.allOrders.reduce(
        (total, order) =>
          total +
          Number(order.total_amount || 0),
        0
      ),
    [data.allOrders]
  );

  const latestOrder =
    data.recentOrders.length > 0
      ? data.recentOrders[0]
      : null;

  // Featured products (top 3)
  const featuredProducts = useMemo(
    () =>
      data.products
        .filter((p) => getStock(p) > 0)
        .sort((a, b) => (b.popular || 0) - (a.popular || 0))
        .slice(0, 3),
    [data.products]
  );

  // Filtered and sorted products
  const filteredProducts = useMemo(() => {
    let result = [...data.products];

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (p) =>
          p.name?.toLowerCase().includes(term) ||
          p.description?.toLowerCase().includes(term)
      );
    }

    // Stock filter
    if (filterSettings.inStockOnly) {
      result = result.filter((p) => getStock(p) > 0);
    }

    // Price range filter
    result = result.filter(
      (p) =>
        Number(p.price || 0) >= filterSettings.priceRange[0] &&
        Number(p.price || 0) <= filterSettings.priceRange[1]
    );

    // Sort
    if (filterSettings.sortBy === 'price-low') {
      result.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    } else if (filterSettings.sortBy === 'price-high') {
      result.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    } else if (filterSettings.sortBy === 'newest') {
      result.sort(
        (a, b) =>
          new Date(b.created_at || 0) - new Date(a.created_at || 0)
      );
    }

    return result;
  }, [data.products, searchTerm, filterSettings]);

  /* =========================================================
     HANDLERS
  ========================================================= */

  const handleSearch = (term) => {
    setSearchTerm(term);
  };

  const handleFilterChange = (newFilters) => {
    setFilterSettings(newFilters);
  };


  const handleViewFavorites = () => {
    navigate('/client/favorites');
  };

  const handleShare = () => {
    const dashboardUrl = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: 'StoreHub Dashboard',
        text: 'Check out my store dashboard!',
        url: dashboardUrl,
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(dashboardUrl);
      alert('Dashboard URL copied to clipboard!');
    }
  };

  /* =========================================================
     LOADING
  ========================================================= */

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
          Loading your dashboard...
        </Typography>
      </Box>
    );
  }

  const appTheme = createAppTheme(isDarkMode ? 'dark' : 'light');

  return (
    <ThemeProvider theme={appTheme}>
      <Box className="page-container">
        {/* =====================================================
            HERO HEADER WITH DARK MODE TOGGLE
        ====================================================== */}

        <Paper
          elevation={0}
          className="dashboard-hero"
          sx={{
            position: 'relative',
            overflow: 'hidden',
            mb: 0,
            color: '#FFFFFF',
            background:
              isDarkMode
                ? 'linear-gradient(135deg, #064E3B 0%, #047857 50%, #059669 100%)'
                : 'linear-gradient(135deg, #022C22 0%, #064E3B 50%, #047857 100%)',
          }}
        >
          <Box
            sx={{
              position: 'absolute',

              width: 340,
              height: 340,

              top: -180,
              right: -110,

              borderRadius: '50%',

              background:
                'radial-gradient(circle, rgba(253,230,138,.18), transparent 70%)',
            }}
          />

          <Box
            sx={{
              position: 'absolute',

              width: 220,
              height: 220,

              left: -120,
              bottom: -140,

              borderRadius: '50%',

              bgcolor:
                'rgba(255,255,255,.04)',
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
                spacing={0.8}
                alignItems="center"
                sx={{
                  mb: 1.4,
                }}
              >
                <StorefrontRounded
                  sx={{
                    color: '#FDE68A',
                    fontSize: 19,
                  }}
                />

                <Typography
                  sx={{
                    color:
                      'rgba(255,255,255,.66)',

                    fontSize: 10.5,

                    fontWeight: 800,

                    textTransform:
                      'uppercase',

                    letterSpacing: '.12em',
                  }}
                >
                  StoreHub Client Portal
                </Typography>
              </Stack>

              <Typography
                sx={{
                  fontSize: {
                    xs: '2rem',
                    md: '2.6rem',
                  },

                  fontWeight: 900,

                  lineHeight: 1.08,

                  letterSpacing: '-.045em',
                }}
              >
                My Dashboard
              </Typography>

              <Typography
                sx={{
                  mt: 1.3,

                  maxWidth: 590,

                  color:
                    'rgba(255,255,255,.68)',

                  fontSize: 13.5,

                  lineHeight: 1.7,
                }}
              >
                Browse available store products,
                discover current offers and review
                your payment and billing receipts.
              </Typography>

              <Button
                variant="contained"
                endIcon={
                  <ArrowForwardRounded />
                }
                onClick={() =>
                  navigate('/client/history')
                }
                sx={{
                  mt: 2.4,

                  minHeight: 44,

                  px: 2.4,

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
                View Purchase History
              </Button>
            </Box>

            <Stack
              spacing={1.2}
              alignItems={{
                xs: 'flex-start',
                md: 'flex-end',
              }}
            >
              <Tooltip title={isDarkMode ? 'Light mode' : 'Dark mode'}>
                <span>
                  <IconButton
                    onClick={toggleDarkMode}
                    sx={{
                      width: 44,
                      height: 44,

                      color: '#FFFFFF',

                      bgcolor:
                        'rgba(255,255,255,.09)',

                      border:
                        '1px solid rgba(255,255,255,.13)',

                      '&:hover': {
                        bgcolor:
                          'rgba(255,255,255,.15)',
                      },
                    }}
                  >
                    {isDarkMode ? (
                      <LightModeRounded />
                    ) : (
                      <DarkModeRounded />
                    )}
                  </IconButton>
                </span>
              </Tooltip>

              <Tooltip title="Refresh dashboard">
                <span>
                  <IconButton
                    onClick={() =>
                      fetchData(true)
                    }
                    disabled={refreshing}
                    sx={{
                      width: 44,
                      height: 44,

                      color: '#FFFFFF',

                      bgcolor:
                        'rgba(255,255,255,.09)',

                      border:
                        '1px solid rgba(255,255,255,.13)',

                      '&:hover': {
                        bgcolor:
                          'rgba(255,255,255,.15)',
                      },
                    }}
                  >
                    {refreshing ? (
                      <CircularProgress
                        size={19}
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

              <Paper
                elevation={0}
                sx={{
                  minWidth: 220,

                  p: 2,

                  bgcolor:
                    'rgba(255,255,255,.09)',

                  color: '#FFFFFF',

                  border:
                    '1px solid rgba(255,255,255,.12)',

                  borderRadius: 3.5,

                  backdropFilter: 'blur(10px)',
                }}
              >
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                >
                  <StorefrontRounded
                    sx={{
                      color: '#6EE7B7',
                    }}
                  />

                  <Box>
                    <Typography
                      sx={{
                        color:
                          'rgba(255,255,255,.55)',

                        fontSize: 9.5,

                        fontWeight: 800,

                        textTransform:
                          'uppercase',
                      }}
                    >
                      Client Portal
                    </Typography>

                    <Typography
                      sx={{
                        fontSize: 12.5,
                        fontWeight: 850,
                      }}
                    >
                      View Only Mode
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            </Stack>
          </Stack>
        </Paper>

        {/* =====================================================
            ERROR
        ====================================================== */}

        {error && (
          <Alert
            severity="error"
            onClose={() =>
              setError('')
            }
            sx={{
              mb: 3,
              borderRadius: 3,
            }}
          >
            {error}
          </Alert>
        )}

        {/* =====================================================
            STAT CARDS
        ====================================================== */}

        <Grid
          container
          spacing={2.2}
          sx={{
            mb: 4,
          }}
        >
          {[
            {
              label: 'Available Products',
              value: availableProducts.length,
              subtitle: `${data.products.length} total listed`,
              icon: <Inventory2Outlined />,
              color: '#059669',
              background: '#D8F3E5',
            },

            {
              label: 'Current Offers',
              value: data.promos.length,
              subtitle:
                data.promos.length > 0
                  ? 'Active store promotions'
                  : 'No current offers',
              icon: <LocalOfferRounded />,
              color: '#D97706',
              background: '#FFFBEB',
            },

            {
              label: 'My Purchases',
              value: data.allOrders.length,
              subtitle:
                latestOrder
                  ? `Last: ${formatDate(
                      latestOrder.created_at
                    )}`
                  : 'No purchase history',
              icon: <ReceiptLongRounded />,
              color: '#2563EB',
              background: '#EFF6FF',
            },

            {
              label: 'Total Purchased',
              value: formatPrice(totalSpent),
              subtitle: 'Recorded purchases',
              icon: <LocalAtmRounded />,
              color: '#7C3AED',
              background: '#F5F3FF',
            },
          ].map((item) => (
            <Grid
              item
              xs={12}
              sm={6}
              lg={3}
              key={item.label}
            >
              <Paper
                elevation={0}
                sx={{
                  p: 2.4,

                  height: '100%',

                  bgcolor: 'background.paper',

                  border:
                    '1px solid',

                  borderColor: 'divider',

                  borderRadius: 4,

                  transition:
                    'all .22s ease',

                  '&:hover': {
                    transform:
                      'translateY(-4px)',

                    boxShadow:
                      (theme) =>
                        theme.palette.mode === 'dark'
                          ? '0 16px 36px rgba(0, 168, 150, 0.12)'
                          : '0 16px 36px rgba(24,61,50,.07)',
                  },
                }}
              >
                <Stack
                  direction="row"
                  spacing={1.4}
                  alignItems="center"
                >
                  <Box
                    sx={{
                      width: 48,
                      height: 48,

                      display: 'grid',

                      placeItems: 'center',

                      flexShrink: 0,

                      bgcolor:
                        item.background,

                      color: item.color,

                      borderRadius: 3,
                    }}
                  >
                    {item.icon}
                  </Box>

                  <Box
                    sx={{
                      minWidth: 0,
                    }}
                  >
                    <Typography
                      sx={{
                        color: 'text.secondary',
                        fontSize: 10.8,
                        fontWeight: 700,
                      }}
                    >
                      {item.label}
                    </Typography>

                    <Typography
                      sx={{
                        mt: 0.2,

                        color: 'text.primary',

                        fontSize:
                          item.label ===
                          'Total Purchased'
                            ? 18
                            : 24,

                        fontWeight: 900,

                        lineHeight: 1.25,
                      }}
                    >
                      {item.value}
                    </Typography>

                    <Typography
                      sx={{
                        mt: 0.35,

                        color: 'text.secondary',

                        fontSize: 9.8,

                        whiteSpace:
                          'nowrap',

                        overflow: 'hidden',

                        textOverflow:
                          'ellipsis',
                      }}
                    >
                      {item.subtitle}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            </Grid>
          ))}
        </Grid>

        {/* =====================================================
            FEATURED CAROUSEL
        ====================================================== */}

        {featuredProducts.length > 0 && (
          <FeaturedCarousel
            products={featuredProducts}
          />
        )}

        {/* =====================================================
            SEARCH & FILTER
        ====================================================== */}

        <SearchFilterBar
          onSearch={handleSearch}
          onFilterChange={handleFilterChange}
          products={data.products}
        />

        {/* =====================================================
            ANALYTICS
        ====================================================== */}

        {data.allOrders.length > 0 && (
          <AnalyticsCharts
            orders={data.allOrders}
            products={data.products}
          />
        )}

        {/* =====================================================
            CURRENT OFFERS
        ====================================================== */}

        {data.promos.length > 0 && (
          <Box
            sx={{
              mb: 4.5,
            }}
          >
            <Stack
              direction="row"
              alignItems="center"
              spacing={1.2}
              sx={{
                mb: 2.2,
              }}
            >
              <Box
                sx={{
                  width: 42,
                  height: 42,

                  display: 'grid',

                  placeItems: 'center',

                  bgcolor: '#FFF7ED',

                  color: '#EA580C',

                  borderRadius: 2.5,
                }}
              >
                <LocalOfferRounded />
              </Box>

              <Box>
                <Typography
                  sx={{
                    color: 'text.primary',

                    fontSize: 19,

                    fontWeight: 850,

                    letterSpacing: '-.02em',
                  }}
                >
                  Current Offers
                </Typography>

                <Typography
                  sx={{
                    mt: 0.2,

                    color: 'text.secondary',

                    fontSize: 11,
                  }}
                >
                  Promotions currently available in
                  the store.
                </Typography>
              </Box>
            </Stack>

            <Grid
              container
              spacing={2}
            >
              {data.promos.map(
                (promo) => (
                  <Grid
                    item
                    xs={12}
                    md={6}
                    lg={4}
                    key={promo.id}
                  >
                    <Paper
                      elevation={0}
                      sx={{
                        position: 'relative',

                        overflow: 'hidden',

                        height: '100%',

                        p: 2.5,

                        color: '#FFFFFF',

                        borderRadius: 4,

                        background:
                          'linear-gradient(135deg, #9A3412 0%, #EA580C 60%, #F59E0B 100%)',

                        boxShadow:
                          '0 10px 26px rgba(234,88,12,.12)',

                        transition:
                          'all .22s ease',

                        '&:hover': {
                          transform:
                            'translateY(-4px)',

                          boxShadow:
                            '0 16px 32px rgba(234,88,12,.18)',
                        },
                      }}
                    >
                      <Box
                        sx={{
                          position:
                            'absolute',

                          width: 140,
                          height: 140,

                          right: -65,
                          top: -65,

                          borderRadius:
                            '50%',

                          bgcolor:
                            'rgba(255,255,255,.08)',
                        }}
                      />

                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        spacing={2}
                        sx={{
                          position:
                            'relative',

                          zIndex: 1,
                          mb: 1,
                        }}
                      >
                        <Box
                          sx={{
                            minWidth: 0,
                            flex: 1,
                          }}
                        >
                          <Typography
                            sx={{
                              color:
                                '#FED7AA',

                              fontSize:
                                9.5,

                              fontWeight:
                                850,

                              textTransform:
                                'uppercase',

                              letterSpacing:
                                '.08em',
                            }}
                          >
                            Special Offer
                          </Typography>

                          <Typography
                            sx={{
                              mt: 0.7,

                              fontSize:
                                16,

                              fontWeight:
                                850,

                              lineHeight:
                                1.3,
                            }}
                          >
                            {promo.title}
                          </Typography>

                          <Typography
                            sx={{
                              mt: 0.7,

                              color:
                                'rgba(255,255,255,.72)',

                              fontSize:
                                11.3,

                              lineHeight:
                                1.6,
                            }}
                          >
                            {promo.description ||
                              'Special promotion available in store.'}
                          </Typography>
                        </Box>
                      </Stack>

                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="flex-end"
                        spacing={1}
                      >
                        <Box>
                          <Typography
                            sx={{
                              color:
                                'rgba(255,255,255,.7)',

                              fontSize:
                                9,

                              fontWeight:
                                600,

                              textTransform:
                                'uppercase',
                            }}
                          >
                            Discount
                          </Typography>
                          <Typography
                            sx={{
                              mt: 0.3,

                              fontSize:
                                13.5,

                              fontWeight:
                                900,
                            }}
                          >
                            {getPromoLabel(promo)}
                          </Typography>
                        </Box>

                        {promo.end_date && (
                          <DealCountdown
                            endTime={promo.end_date}
                            compact={true}
                          />
                        )}
                      </Stack>
                    </Paper>
                  </Grid>
                )
              )}
            </Grid>
          </Box>
        )}

        {/* =====================================================
            PRODUCTS GRID
        ====================================================== */}

        <Box
          sx={{
            mb: 4.5,
          }}
        >
          <Stack
            direction={{
              xs: 'column',
              sm: 'row',
            }}
            justifyContent="space-between"
            alignItems={{
              xs: 'flex-start',
              sm: 'center',
            }}
            spacing={1}
            sx={{
              mb: 2.2,
            }}
          >
            <Stack
              direction="row"
              spacing={1.2}
              alignItems="center"
            >
              <Box
                sx={{
                  width: 42,
                  height: 42,

                  display: 'grid',

                  placeItems: 'center',

                  bgcolor: '#D8F3E5',

                  color: '#059669',

                  borderRadius: 2.5,
                }}
              >
                <ShoppingBagOutlined />
              </Box>

              <Box>
                <Typography
                  sx={{
                    color: 'text.primary',

                    fontSize: 19,

                    fontWeight: 850,

                    letterSpacing: '-.02em',
                  }}
                >
                  Available Products
                  {searchTerm && ` - "${searchTerm}"`}
                </Typography>

                <Typography
                  sx={{
                    mt: 0.2,

                    color: 'text.secondary',

                    fontSize: 11,
                  }}
                >
                  {filteredProducts.length} products
                  found
                </Typography>
              </Box>
            </Stack>

            <Stack
              direction="row"
              spacing={1}
              sx={{
                flexWrap: 'wrap',
              }}
            >
              {filteredProducts.length > 0 && (
                <>
                  {availableProducts.length > 0 && (
                    <Box
                      sx={{
                        px: 1.2,
                        py: 0.6,
                        bgcolor: '#D8F3E5',
                        color: '#047857',
                        borderRadius: 2,
                        fontSize: '0.8rem',
                        fontWeight: 700,
                      }}
                    >
                      {availableProducts.length} in
                      stock
                    </Box>
                  )}

                  {lowStockProducts.length > 0 && (
                    <Box
                      sx={{
                        px: 1.2,
                        py: 0.6,
                        bgcolor: '#FFFBEB',
                        color: '#B45309',
                        borderRadius: 2,
                        fontSize: '0.8rem',
                        fontWeight: 700,
                      }}
                    >
                      ⚠ {lowStockProducts.length} low
                      stock
                    </Box>
                  )}
                </>
              )}
            </Stack>
          </Stack>

          {filteredProducts.length === 0 ? (
            <Paper
              elevation={0}
              sx={{
                py: 7,
                px: 3,

                textAlign: 'center',

                bgcolor: 'background.paper',

                border:
                  '1px solid',

                borderColor: 'divider',

                borderRadius: 4,
              }}
            >
              <Box
                sx={{
                  width: 72,
                  height: 72,

                  mx: 'auto',

                  mb: 2,

                  display: 'grid',

                  placeItems: 'center',

                  bgcolor: '#D8F3E5',

                  color: '#059669',

                  borderRadius: 4,
                }}
              >
                <Inventory2Outlined
                  sx={{
                    fontSize: 36,
                  }}
                />
              </Box>

              <Typography
                sx={{
                  color: 'text.primary',

                  fontSize: 16,

                  fontWeight: 850,
                }}
              >
                {searchTerm
                  ? 'No products match your search'
                  : 'No products available'}
              </Typography>

              <Typography
                sx={{
                  mt: 0.6,

                  color: 'text.secondary',

                  fontSize: 12,
                }}
              >
                {searchTerm
                  ? 'Try adjusting your search or filters'
                  : 'Please check back later for new store products.'}
              </Typography>
            </Paper>
          ) : (
            <Grid
              container
              spacing={2.2}
            >
              {filteredProducts.map(
                (product) => (
                  <Grid
                    item
                    xs={12}
                    sm={6}
                    md={4}
                    lg={3}
                    key={product.id}
                  >
                    <ProductCard
                      product={product}
                      isFavorited={isFavorited(
                        product.id
                      )}
                      onFavoriteToggle={
                        toggleFavorite
                      }
                    />
                  </Grid>
                )
              )}
            </Grid>
          )}
        </Box>

        {/* =====================================================
            FLOATING ACTION PANEL
        ====================================================== */}

        <FloatingActionPanel
          favoriteCount={favorites.length}
          onViewFavorites={handleViewFavorites}
          onShare={handleShare}
          onToggleFilters={() => {
            const searchBar = document.querySelector(
              '[data-search-bar]'
            );
            if (searchBar) {
              searchBar.scrollIntoView({ behavior: 'smooth' });
            }
          }}
        />
      </Box>
    </ThemeProvider>
  );
};

export default UserDashboard;
