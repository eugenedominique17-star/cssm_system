import React, { useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Stack,
  LinearProgress,
} from '@mui/material';
import {
  TrendingUpRounded,
  TrendingDownRounded,
  AssessmentRounded,
  ReceiptLongRounded,
} from '@mui/icons-material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler
);

/**
 * Analytics Charts Component
 * Shows spending trends, monthly comparison, and top products
 */
const AnalyticsCharts = ({ orders = [], products = [] }) => {
  // Format currency
  const formatPrice = (price) =>
    `₱${Number(price || 0).toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  // Calculate spending trend (last 6 months dynamically)
  const spendingTrend = useMemo(() => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const labels = [];
    const totals = new Array(6).fill(0);

    // Build last 6 months labels
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(monthNames[d.getMonth()]);
    }

    orders.forEach((order) => {
      const orderDate = new Date(order.created_at);
      const monthDiff = (now.getFullYear() - orderDate.getFullYear()) * 12 + (now.getMonth() - orderDate.getMonth());

      if (monthDiff >= 0 && monthDiff < 6) {
        totals[5 - monthDiff] += Number(order.total_amount || 0);
      }
    });

    return {
      labels,
      datasets: [
        {
          label: 'Spending',
          data: totals,
          borderColor: '#B9EBD0',
          backgroundColor: (context) => {
            const ctx = context.chart.ctx;
            const gradient = ctx.createLinearGradient(0, 0, 0, 200);
            gradient.addColorStop(0, 'rgba(185,235,208, 0.35)');
            gradient.addColorStop(1, 'rgba(185,235,208, 0.0)');
            return gradient;
          },
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#087F5B',
          pointBorderColor: '#B9EBD0',
          pointBorderWidth: 2,
        },
      ],
    };
  }, [orders]);

  // Calculate this month vs last month
  const monthComparison = useMemo(() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = lastMonthDate.getMonth();
    const lastMonthYear = lastMonthDate.getFullYear();

    let thisMonthSpent = 0;
    let lastMonthSpent = 0;

    orders.forEach((order) => {
      const d = new Date(order.created_at);
      if (d.getMonth() === thisMonth && d.getFullYear() === thisYear) {
        thisMonthSpent += Number(order.total_amount || 0);
      } else if (d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear) {
        lastMonthSpent += Number(order.total_amount || 0);
      }
    });

    const difference = thisMonthSpent - lastMonthSpent;
    const percentChange =
      lastMonthSpent > 0
        ? ((difference / lastMonthSpent) * 100).toFixed(1)
        : thisMonthSpent > 0
        ? 100
        : 0;

    return {
      thisMonth: thisMonthSpent,
      lastMonth: lastMonthSpent,
      percentChange,
      isIncrease: difference >= 0,
    };
  }, [orders]);

  // Calculate top products from orders or fallback to products prop
  const topProducts = useMemo(() => {
    const itemMap = {};

    orders.forEach((order) => {
      const items = order.items || order.order_items || [];
      items.forEach((item) => {
        const name = item.name || item.product_name || 'Product';
        const qty = Number(item.quantity || 1);
        itemMap[name] = (itemMap[name] || 0) + qty;
      });
    });

    const sorted = Object.entries(itemMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    if (sorted.length > 0) return sorted;

    // Fallback display if no items found in orders
    return products.slice(0, 3).map((p) => ({ name: p.name, count: 1 })) || [
      { name: 'No purchase data available', count: 0 },
    ];
  }, [orders, products]);

  const maxCount = Math.max(...topProducts.map((p) => p.count), 1);

  return (
    <Box sx={{ mb: 4 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
        <Box
          sx={{
            width: 42,
            height: 42,
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'rgba(8,127,91, 0.15)',
            color: '#B9EBD0',
            border: '1px solid rgba(185,235,208, 0.2)',
            borderRadius: '12px',
            flexShrink: 0,
          }}
        >
          <AssessmentRounded />
        </Box>

        <Box>
          <Typography
            sx={{
              color: '#B9EBD0',
              fontSize: '0.72rem',
              fontWeight: 800,
              letterSpacing: '1px',
              textTransform: 'uppercase',
            }}
          >
            Analytics
          </Typography>
          <Typography
            sx={{
              color: '#F7F5EC',
              fontSize: '1.25rem',
              fontWeight: 800,
              lineHeight: 1.2,
            }}
          >
            Your Spending Insights
          </Typography>
        </Box>
      </Stack>

      <Grid container spacing={2.5}>
        {/* Metric Card 1: Month Comparison */}
        <Grid item xs={12} sm={6} lg={3}>
          <Card
            elevation={0}
            sx={{
              height: '100%',
              bgcolor: '#183D32',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
            }}
          >
            <CardContent sx={{ p: 2.5 }}>
              <Stack spacing={2}>
                <Typography
                  sx={{
                    color: '#617B6C',
                    fontWeight: 800,
                    fontSize: '0.72rem',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                  }}
                >
                  This Month vs Last
                </Typography>

                <Box>
                  <Typography
                    variant="h5"
                    sx={{ fontWeight: 900, color: '#F7F5EC', lineHeight: 1 }}
                  >
                    {formatPrice(monthComparison.thisMonth)}
                  </Typography>

                  <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 1.5 }}>
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        px: 0.8,
                        py: 0.2,
                        borderRadius: '6px',
                        bgcolor: monthComparison.isIncrease
                          ? 'rgba(239, 68, 68, 0.15)'
                          : 'rgba(34, 197, 94, 0.15)',
                        color: monthComparison.isIncrease ? '#EF4444' : '#22C55E',
                      }}
                    >
                      {monthComparison.isIncrease ? (
                        <TrendingUpRounded sx={{ fontSize: '1rem', mr: 0.3 }} />
                      ) : (
                        <TrendingDownRounded sx={{ fontSize: '1rem', mr: 0.3 }} />
                      )}
                      <Typography variant="caption" sx={{ fontWeight: 800 }}>
                        {monthComparison.isIncrease ? '+' : ''}
                        {monthComparison.percentChange}%
                      </Typography>
                    </Box>

                    <Typography variant="caption" sx={{ color: '#617B6C', fontSize: '0.75rem' }}>
                      vs last month
                    </Typography>
                  </Stack>
                </Box>

                <Typography variant="caption" sx={{ color: '#617B6C', fontSize: '0.72rem' }}>
                  Last month: {formatPrice(monthComparison.lastMonth)}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Metric Card 2: Total Orders */}
        <Grid item xs={12} sm={6} lg={3}>
          <Card
            elevation={0}
            sx={{
              height: '100%',
              bgcolor: '#183D32',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
            }}
          >
            <CardContent sx={{ p: 2.5 }}>
              <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography
                    sx={{
                      color: '#617B6C',
                      fontWeight: 800,
                      fontSize: '0.72rem',
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase',
                    }}
                  >
                    Total Orders
                  </Typography>
                  <ReceiptLongRounded sx={{ color: '#B9EBD0', fontSize: '1.2rem' }} />
                </Stack>

                <Box>
                  <Typography
                    variant="h3"
                    sx={{ fontWeight: 900, color: '#F7F5EC', lineHeight: 1 }}
                  >
                    {orders.length}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: '#617B6C', fontSize: '0.75rem', mt: 1, display: 'block' }}
                  >
                    Completed transactions
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Chart: Spending Trend */}
        <Grid item xs={12} lg={6}>
          <Card
            elevation={0}
            sx={{
              bgcolor: '#183D32',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
            }}
          >
            <CardContent sx={{ p: 2.5 }}>
              <Typography
                sx={{
                  fontWeight: 800,
                  fontSize: '0.875rem',
                  color: '#F7F5EC',
                  mb: 2,
                }}
              >
                6-Month Spending Trend
              </Typography>
              <Box sx={{ height: 180 }}>
                <Line
                  data={spendingTrend}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        backgroundColor: '#254D3F',
                        titleColor: '#F7F5EC',
                        bodyColor: '#B9EBD0',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        padding: 10,
                        displayColors: false,
                        callbacks: {
                          label: (context) => formatPrice(context.raw),
                        },
                      },
                    },
                    scales: {
                      x: {
                        grid: { display: false },
                        ticks: { color: '#617B6C', font: { size: 11, weight: '600' } },
                      },
                      y: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: {
                          color: '#617B6C',
                          font: { size: 10 },
                          callback: (value) => `₱${value}`,
                        },
                        beginAtZero: true,
                      },
                    },
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Progress List: Top Products */}
        <Grid item xs={12}>
          <Card
            elevation={0}
            sx={{
              bgcolor: '#183D32',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
            }}
          >
            <CardContent sx={{ p: 2.5 }}>
              <Typography
                sx={{
                  fontWeight: 800,
                  fontSize: '0.875rem',
                  color: '#F7F5EC',
                  mb: 2,
                }}
              >
                Most Purchased Items
              </Typography>

              <Grid container spacing={2}>
                {topProducts.map((product, index) => (
                  <Grid item xs={12} sm={6} key={index}>
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: '12px',
                        bgcolor: 'rgba(37,77,63, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                      }}
                    >
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        sx={{ mb: 1 }}
                      >
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 700, color: '#D5E5D9' }}
                        >
                          {product.name}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 800,
                            color: '#B9EBD0',
                            bgcolor: 'rgba(8,127,91, 0.2)',
                            px: 1,
                            py: 0.2,
                            borderRadius: '6px',
                          }}
                        >
                          {product.count}x
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={(product.count / maxCount) * 100}
                        sx={{
                          height: 6,
                          borderRadius: 3,
                          bgcolor: 'rgba(255, 255, 255, 0.08)',
                          '& .MuiLinearProgress-bar': {
                            bgcolor: '#087F5B',
                            borderRadius: 3,
                          },
                        }}
                      />
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AnalyticsCharts;