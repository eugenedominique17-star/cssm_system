const OBSERVED_DAYS_REQUIRED = 30;
const SALES_DAYS_REQUIRED = 7;
const FORECAST_DAYS = 7;

export const calculateSevenDaySalesEstimate = (dailySales) => {
  if (!Array.isArray(dailySales) || dailySales.length !== OBSERVED_DAYS_REQUIRED) {
    return { status: 'insufficient', salesDays: 0 };
  }

  const values = dailySales.map((day) => Number(day.total_sales));
  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    return { status: 'invalid' };
  }

  const salesDays = values.filter((value) => value > 0).length;
  if (salesDays < SALES_DAYS_REQUIRED) {
    return { status: 'insufficient', salesDays };
  }

  const totalSales = values.reduce((total, value) => total + value, 0);
  return {
    status: 'available',
    salesDays,
    averageDailySales: totalSales / OBSERVED_DAYS_REQUIRED,
    estimatedSales: (totalSales / OBSERVED_DAYS_REQUIRED) * FORECAST_DAYS,
  };
};
