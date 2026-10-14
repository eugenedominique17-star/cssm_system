import React, { useEffect, useState } from 'react';
import {
  Alert, Box, CircularProgress, FormControl, Grid, InputLabel,
  MenuItem, Paper, Select, Stack, TextField, Typography,
} from '@mui/material';
import { Bar, Doughnut, Line, Radar } from 'react-chartjs-2';
import {
  ArcElement, BarElement, CategoryScale, Chart as ChartJS, Filler,
  Legend, LineElement, LinearScale, PointElement, RadialLinearScale, Tooltip,
} from 'chart.js';
import API from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';

ChartJS.register(ArcElement, BarElement, CategoryScale, Filler, Legend, LineElement, LinearScale, PointElement, RadialLinearScale, Tooltip);

const cyan = '#087F5B';
const blue = '#46AC87';
const pink = '#B4D8A9';
const purple = '#537B61';
const colors = [cyan, pink, purple, blue, '#D6C993', '#B9E5D7'];
const ink = '#343947';
const muted = '#9CA4B3';
const money = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const number = new Intl.NumberFormat('en-PH');

const dateValue = (date) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};
const initialRange = () => {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  return { start: dateValue(start), end: dateValue(end) };
};

const panel = {
  bgcolor: 'var(--sh-glass-bg)',
  border: '1px solid #F0F1F7',
  borderRadius: 3,
  boxShadow: '0 7px 24px rgba(90, 106, 145, .035)',
};
const field = {
  '& .MuiOutlinedInput-root': { borderRadius: 1, bgcolor: 'var(--sh-glass-bg)', fontSize: 13 },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E9ECF5' },
  '& .MuiInputLabel-root': { color: '#8D96A6', fontSize: 13 },
};
const chartBase = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { backgroundColor: '#303847', padding: 10, displayColors: false, cornerRadius: 5 },
  },
};

const Panel = ({ title, note, children, sx = {} }) => (
  <Paper elevation={0} sx={{ ...panel, p: { xs: 2, sm: 2.5 }, height: '100%', ...sx }}>
    <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={1} sx={{ mb: 2 }}>
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: ink }}>{title}</Typography>
      {note && <Typography sx={{ fontSize: 11, color: muted, textAlign: 'right' }}>{note}</Typography>}
    </Stack>
    {children}
  </Paper>
);

const Metric = ({ label, value, note, color }) => (
  <Paper elevation={0} sx={{ ...panel, p: 2.1, minHeight: 107, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, overflow: 'hidden' }}>
    <Box sx={{ borderLeft: `2px solid ${color}`, pl: 1.4, minWidth: 0 }}>
      <Typography sx={{ fontSize: 11, color: ink, mb: 1 }}>{label}</Typography>
      <Typography sx={{ fontSize: { xs: 19, xl: 23 }, fontWeight: 400, lineHeight: 1.2, color: '#5B606A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
      <Typography sx={{ fontSize: 10, color: muted, mt: 0.5 }}>{note}</Typography>
    </Box>
    <Box sx={{ flexShrink: 0, width: 42, height: 42, borderRadius: '50%', border: '3px solid #F0F2F8', borderTopColor: color, borderRightColor: color, transform: 'rotate(-30deg)' }} />
  </Paper>
);

const Empty = ({ text = 'No sales for this period' }) => (
  <Box sx={{ height: '100%', minHeight: 170, display: 'grid', placeItems: 'center', color: muted, fontSize: 12, textAlign: 'center' }}>{text}</Box>
);

const Reports = () => {
  const { user } = useAuth();
  const [period, setPeriod] = useState('monthly');
  const [month, setMonth] = useState(() => dateValue(new Date()).slice(0, 7));
  const [range, setRange] = useState(initialRange);
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const invalidMonth = period === 'monthly' && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month);
  const invalidRange = period === 'custom' && (!range.start || !range.end || range.start > range.end);
  const monthLabel = invalidMonth ? 'Selected month' : new Date(`${month}-01T00:00:00`).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
  const periodLabel = period === 'weekly' ? 'Last 7 days' : period === 'custom' ? `${range.start} – ${range.end}` : monthLabel;
  const groupedLabel = periodLabel;

  useEffect(() => {
    if (invalidMonth || invalidRange) {
      setReports(null);
      setLoading(false);
      return undefined;
    }
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const trendParams = new URLSearchParams({ period: 'monthly', chart: 'sales_trend' });
        if (period === 'weekly') {
          const end = new Date();
          const start = new Date(end);
          start.setDate(start.getDate() - 6);
          trendParams.set('start_date', dateValue(start));
          trendParams.set('end_date', dateValue(end));
        } else if (period === 'custom') {
          trendParams.set('start_date', range.start);
          trendParams.set('end_date', range.end);
        } else {
          const [year, monthNumber] = month.split('-').map(Number);
          trendParams.set('start_date', `${month}-01`);
          trendParams.set('end_date', `${month}-${String(new Date(year, monthNumber, 0).getDate()).padStart(2, '0')}`);
        }
        const groupParams = new URLSearchParams(trendParams);
        groupParams.delete('chart');
        const [trend, category, products] = await Promise.all([
          API.get(`/admin/reports?${trendParams}`),
          API.get(`/admin/reports?${groupParams}&chart=sales_category`),
          API.get(`/admin/reports?${groupParams}&chart=top_products`),
        ]);
        if (active) setReports({ trend: trend.data, category: category.data, products: products.data });
      } catch (fetchError) {
        if (active) {
          setReports(null);
          setError(fetchError.response?.data?.message || 'Could not load sales reports.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [period, month, range.start, range.end, invalidMonth, invalidRange]);

  const daily = reports?.trend?.data || [];
  const categories = reports?.category?.data || [];
  const products = reports?.products?.data || [];
  const summary = reports?.trend?.summary;
  const totalRevenue = Number(summary?.total_revenue || 0);
  const transactions = Number(summary?.total_transactions || 0);
  const averageSale = transactions ? totalRevenue / transactions : 0;
  const itemsSold = products.reduce((sum, product) => sum + Number(product.total_quantity || 0), 0);
  const leadingCategory = categories[0];
  const categoryTotal = categories.reduce((sum, category) => sum + Number(category.total_sales || 0), 0);
  const leadingShare = categoryTotal ? Math.round(Number(leadingCategory?.total_sales || 0) / categoryTotal * 100) : 0;
  const dailyLabels = daily.map((item) => item.date.slice(5));
  const dailyValues = daily.map((item) => Number(item.total_sales || 0));
  const categoryLabels = categories.map((item) => item.category || 'Uncategorized');
  const categoryValues = categories.map((item) => Number(item.total_sales || 0));
  const chartHeight = { xs: 205, sm: 225 };
  const comparison = reports?.trend?.comparison;
  const projection = reports?.trend?.projection;
  const revenueChange = comparison?.revenue_change_percent;
  const changeText = revenueChange == null ? 'No percentage comparison: the previous period had no sales.' : `Revenue ${revenueChange >= 0 ? 'increased' : 'decreased'} by ${Math.abs(revenueChange).toFixed(1)}% versus the previous equal-length period.`;

  const dailyBarData = {
    labels: dailyLabels,
    datasets: [{ data: dailyValues, backgroundColor: dailyValues.map((_, index) => colors[index % 4]), borderRadius: 3, maxBarThickness: 12, categoryPercentage: 0.76 }],
  };
  const dailyLineData = {
    labels: dailyLabels,
    datasets: [{ data: dailyValues, borderColor: blue, backgroundColor: 'rgba(105,171,245,.12)', fill: true, tension: 0.42, borderWidth: 2, pointBackgroundColor: blue, pointBorderColor: '#FFFFFF', pointBorderWidth: 2, pointRadius: 0, pointHoverRadius: 5 }],
  };
  const radarData = {
    labels: categoryLabels,
    datasets: [{ data: categoryValues, borderColor: pink, backgroundColor: 'rgba(166,157,247,.29)', borderWidth: 2, pointBackgroundColor: cyan, pointRadius: 2 }],
  };
  const doughnutData = {
    labels: categoryLabels,
    datasets: [{ data: categoryValues, backgroundColor: categoryValues.map((_, index) => colors[index % colors.length]), borderWidth: 0, hoverOffset: 4, borderRadius: 4 }],
  };
  const cartesianOptions = {
    ...chartBase,
    scales: {
      x: { border: { display: false }, grid: { display: false }, ticks: { color: muted, font: { size: 9 }, maxTicksLimit: 9, maxRotation: 0 } },
      y: { beginAtZero: true, border: { display: false }, grid: { color: '#EDF0F6' }, ticks: { color: muted, font: { size: 9 }, maxTicksLimit: 5, callback: (value) => Number(value).toLocaleString('en-PH') } },
    },
  };

  return (
    <Box sx={{ maxWidth: 1450, mx: 'auto', color: ink }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1.5} sx={{ mb: 2.4 }}>
        <Box>
          <Typography component="h1" sx={{ fontSize: { xs: 22, sm: 27 }, fontWeight: 700, letterSpacing: '-.03em' }}>Hello, {user?.full_name || user?.name || 'Admin'}</Typography>
          <Typography sx={{ color: muted, fontSize: 12, mt: 0.25 }}>Your sales dashboard</Typography>
        </Box>
        <Typography sx={{ color: '#08BFD3', fontSize: 12, fontWeight: 700 }}>{periodLabel}</Typography>
      </Stack>

      <Paper elevation={0} sx={{ ...panel, p: 1.6, mb: 2.2 }}>
        <Grid container spacing={1.4} alignItems="center">
          <Grid item xs={12} sm={4} md={3}>
            <FormControl fullWidth size="small" sx={field}>
              <InputLabel>Period</InputLabel>
              <Select value={period} label="Period" onChange={(event) => setPeriod(event.target.value)}>
                <MenuItem value="monthly">Monthly</MenuItem>
                <MenuItem value="weekly">Last 7 days</MenuItem>
                <MenuItem value="custom">Custom dates</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          {period === 'monthly' && (
            <Grid item xs={12} sm={4} md={3}>
              <TextField fullWidth size="small" type="month" label="Month and year" value={month} onChange={(event) => setMonth(event.target.value)} InputLabelProps={{ shrink: true }} error={invalidMonth} helperText={invalidMonth ? 'Choose a valid month.' : undefined} sx={field} />
            </Grid>
          )}
          {period === 'custom' && (
            <>
              <Grid item xs={12} sm={4} md={3}><TextField fullWidth size="small" type="date" label="Start date" value={range.start} onChange={(event) => setRange((current) => ({ ...current, start: event.target.value }))} InputLabelProps={{ shrink: true }} sx={field} /></Grid>
              <Grid item xs={12} sm={4} md={3}><TextField fullWidth size="small" type="date" label="End date" value={range.end} onChange={(event) => setRange((current) => ({ ...current, end: event.target.value }))} InputLabelProps={{ shrink: true }} sx={field} /></Grid>
            </>
          )}
          {period !== 'custom' && <Grid item xs={12} md={6}><Typography sx={{ fontSize: 11, color: muted, textAlign: { md: 'right' } }}>Choose a month to update every chart and metric</Typography></Grid>}
        </Grid>
      </Paper>

      {invalidRange && <Alert severity="error" sx={{ mb: 2 }}>End date must be the same as or later than start date.</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading ? <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 320 }}><CircularProgress sx={{ color: cyan }} /></Box> : reports && (
        <>
          <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
            <Grid item xs={12} md={7}>
              <Panel title="Daily revenues" note={periodLabel}>
                <Box sx={{ height: chartHeight }}>
                  {dailyValues.some(Boolean) ? <Bar data={dailyBarData} options={cartesianOptions} /> : <Empty />}
                </Box>
              </Panel>
            </Grid>
            <Grid item xs={12} md={5}>
              <Panel title="Sales by category" note={groupedLabel}>
                <Box sx={{ height: chartHeight }}>
                  {categoryValues.some(Boolean) ? <Radar data={radarData} options={{ ...chartBase, scales: { r: { beginAtZero: true, angleLines: { color: '#EDF0F6' }, grid: { color: '#EDF0F6' }, pointLabels: { color: muted, font: { size: 9 } }, ticks: { display: false } } } }} /> : <Empty />}
                </Box>
              </Panel>
            </Grid>
          </Grid>

          <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
            <Grid item xs={12} sm={6} lg={3}><Metric label="Total revenue" value={money.format(totalRevenue)} note={periodLabel} color={pink} /></Grid>
            <Grid item xs={12} sm={6} lg={3}><Metric label="Transactions" value={number.format(transactions)} note="Completed sales" color={cyan} /></Grid>
            <Grid item xs={12} sm={6} lg={3}><Metric label="Average sale" value={money.format(averageSale)} note="Revenue per transaction" color={purple} /></Grid>
            <Grid item xs={12} sm={6} lg={3}><Metric label="Top 10 units sold" value={number.format(itemsSold)} note={groupedLabel} color="#F2C866" /></Grid>
          </Grid>

          <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
            <Grid item xs={12} md={8}>
              <Panel title="Revenue trend" note={periodLabel}>
                <Box sx={{ height: { xs: 230, sm: 250 } }}>
                  {dailyValues.some(Boolean) ? <Line data={dailyLineData} options={cartesianOptions} /> : <Empty />}
                </Box>
              </Panel>
            </Grid>
            <Grid item xs={12} md={4}>
              <Panel title="Top category share" note={groupedLabel}>
                <Box sx={{ height: { xs: 230, sm: 250 }, position: 'relative' }}>
                  {categoryValues.some(Boolean) ? (
                    <>
                      <Doughnut data={doughnutData} options={{ ...chartBase, cutout: '78%', layout: { padding: 7 } }} />
                      <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', pointerEvents: 'none', textAlign: 'center' }}>
                        <Typography sx={{ fontSize: 29, fontWeight: 300, color: ink }}>{leadingShare}%</Typography>
                        <Typography sx={{ fontSize: 10, color: muted, maxWidth: 95, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{leadingCategory?.category}</Typography>
                      </Box>
                    </>
                  ) : <Empty />}
                </Box>
              </Panel>
            </Grid>
          </Grid>

          <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
            <Grid item xs={12} md={6}>
              <Panel title="Sales analysis" note={periodLabel}>
                <Typography sx={{ fontSize: 13, mb: 1 }}>{changeText}</Typography>
                {comparison && <Typography sx={{ fontSize: 12, color: muted, mb: 1 }}>Previous period: {comparison.previous_start_date} – {comparison.previous_end_date}; revenue {money.format(comparison.total_revenue)}.</Typography>}
                <Typography sx={{ fontSize: 13 }}>{products.length ? `Best seller: ${products[0].name} (${number.format(products[0].total_quantity)} units). Leading category: ${leadingCategory?.category || 'Uncategorized'} (${leadingShare}% of category revenue).` : 'Record completed sales to see product and category analysis.'}</Typography>
              </Panel>
            </Grid>
            <Grid item xs={12} md={6}>
              <Panel title="Next 7 days: estimated sales" note={projection ? `${projection.forecast_start} – ${projection.forecast_end}` : ''}>
                <Typography sx={{ fontSize: 25, fontWeight: 700, color: cyan }}>{projection?.available ? money.format(projection.estimated_revenue) : 'Insufficient sales history'}</Typography>
                <Typography sx={{ fontSize: 12, mt: 1 }}>{projection?.available ? `Daily average: ${money.format(projection.average_daily_sales)}.` : 'At least 7 complete calendar days since the first recorded sale are needed.'}</Typography>
                <Typography sx={{ fontSize: 12, color: muted, mt: 1 }}>Based on {projection?.source_start} – {projection?.source_end}. Uses the latest complete days, independently of the report filter.</Typography>
                <Typography sx={{ fontSize: 12, color: muted, mt: 1 }}>{projection?.method}</Typography>
              </Panel>
            </Grid>
          </Grid>

          <Panel title="Best-selling products" note={groupedLabel}>
            <Box sx={{ overflowX: 'auto' }}>
              <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', minWidth: 500, '& th': { color: muted, fontSize: 10, fontWeight: 500, textAlign: 'left', py: 1.2, borderBottom: '1px solid #EEF0F5' }, '& td': { fontSize: 11, color: '#626A77', py: 1.3, borderBottom: '1px solid #F3F4F8' } }}>
                <thead><tr><th>Product</th><th>Category</th><th>Units sold</th><th>Revenue</th></tr></thead>
                <tbody>
                  {products.length ? products.map((product, index) => (
                    <tr key={`${product.name}-${index}`}>
                      <td><Stack direction="row" alignItems="center" spacing={1}><Box sx={{ width: 22, height: 22, bgcolor: colors[index % colors.length], borderRadius: '50%', opacity: 0.72 }} /><span>{product.name}</span></Stack></td>
                      <td>{product.category || 'Uncategorized'}</td>
                      <td>{number.format(Number(product.total_quantity || 0))}</td>
                      <td>{money.format(Number(product.total_sales || 0))}</td>
                    </tr>
                  )) : <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20 }}>No product sales for this period.</td></tr>}
                </tbody>
              </Box>
            </Box>
          </Panel>
        </>
      )}
    </Box>
  );
};

export default Reports;
