const fs = require('fs');
const file = 'frontend/src/pages/admin/Reports.jsx';
let s = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
function replace(a,b) { if (!s.includes(a)) throw new Error('Missing: ' + a); s=s.replace(a,b); }
replace("const dateValue = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;", "const dateValue = (date) => {\n  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date).map(({ type, value }) => [type, value]));\n  return `${parts.year}-${parts.month}-${parts.day}`;\n};");
replace("const invalidMonth = period !== 'weekly'", "const invalidMonth = period === 'monthly'");
replace("const groupedLabel = period === 'custom' ? monthLabel : periodLabel;", "const groupedLabel = periodLabel;");
replace("        const groupParams = new URLSearchParams({ period: period === 'weekly' ? 'weekly' : 'monthly' });\n        if (period !== 'weekly') groupParams.set('month', month);\n", '');
replace('        const [trend, category, products] = await Promise.all([', "        const groupParams = new URLSearchParams(trendParams);\n        groupParams.delete('chart');\n        const [trend, category, products] = await Promise.all([");
replace("          {period !== 'weekly' && (", "          {period === 'monthly' && (");
replace("label={period === 'custom' ? 'Category/product month' : 'Month and year'}", 'label="Month and year"');
replace("  const chartHeight = { xs: 205, sm: 225 };", "  const chartHeight = { xs: 205, sm: 225 };\n  const comparison = reports?.trend?.comparison;\n  const projection = reports?.trend?.projection;\n  const revenueChange = comparison?.revenue_change_percent;\n  const changeText = revenueChange == null ? 'No percentage comparison: the previous period had no sales.' : `Revenue ${revenueChange >= 0 ? 'increased' : 'decreased'} by ${Math.abs(revenueChange).toFixed(1)}% versus the previous equal-length period.`;");
replace('          <Panel title="Best-selling products" note={groupedLabel}>', `          <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
            <Grid item xs={12} md={6}>
              <Panel title="Sales analysis" note={periodLabel}>
                <Typography sx={{ fontSize: 13, mb: 1 }}>{changeText}</Typography>
                {comparison && <Typography sx={{ fontSize: 12, color: muted, mb: 1 }}>Previous period: {comparison.previous_start_date} – {comparison.previous_end_date}; revenue {money.format(comparison.total_revenue)}.</Typography>}
                <Typography sx={{ fontSize: 13 }}>{products.length ? \`Best seller: \${products[0].name} (\${number.format(products[0].total_quantity)} units). Leading category: \${leadingCategory?.category || 'Uncategorized'} (\${leadingShare}% of category revenue).\` : 'Record completed sales to see product and category analysis.'}</Typography>
              </Panel>
            </Grid>
            <Grid item xs={12} md={6}>
              <Panel title="Next 7 days: estimated sales" note={projection ? \`\${projection.forecast_start} – \${projection.forecast_end}\` : ''}>
                <Typography sx={{ fontSize: 25, fontWeight: 700, color: cyan }}>{projection?.available ? money.format(projection.estimated_revenue) : 'Insufficient sales history'}</Typography>
                <Typography sx={{ fontSize: 12, mt: 1 }}>{projection?.available ? \`Daily average: \${money.format(projection.average_daily_sales)}.\` : 'At least 7 complete calendar days since the first recorded sale are needed.'}</Typography>
                <Typography sx={{ fontSize: 12, color: muted, mt: 1 }}>Based on {projection?.source_start} – {projection?.source_end}. Uses the latest complete days, independently of the report filter.</Typography>
                <Typography sx={{ fontSize: 12, color: muted, mt: 1 }}>{projection?.method}</Typography>
              </Panel>
            </Grid>
          </Grid>

          <Panel title="Best-selling products" note={groupedLabel}>`);
fs.writeFileSync(file,s);
