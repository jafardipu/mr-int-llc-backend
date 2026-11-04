import prisma from '@app/shared/prisma.js';
import { PAYMENT_STATUS, Role } from '../../../../generated/prisma/index.js';

type OverviewQuery = {
  year?: string | number;
};

const parseYear = (value: string | number | undefined, fallback: number) => {
  const year = Number(value);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return fallback;
  return year;
};

const emptyMonthly = () =>
  Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    retail: 0,
    wholesale: 0,
    revenue: 0,
  }));

const getOverview = async (query: OverviewQuery = {}) => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const year = parseYear(query.year, currentYear);
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);

  const yearPaymentFilter = {
    status: PAYMENT_STATUS.paid,
    OR: [
      { paidAt: { gte: yearStart, lt: yearEnd } },
      {
        paidAt: null,
        createdAt: { gte: yearStart, lt: yearEnd },
      },
    ],
  };

  const [
    paidPayments,
    yearPaidPayments,
    totalOrders,
    retailOrderCount,
    wholesaleOrderCount,
    customers,
    products,
    latestOrders,
    recentActivity,
    yearOrders,
  ] = await Promise.all([
    prisma.payment.aggregate({
      where: { status: PAYMENT_STATUS.paid },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: yearPaymentFilter,
      _sum: { amount: true },
    }),
    prisma.order.count({ where: { isDeleted: false } }),
    prisma.order.count({
      where: { isDeleted: false, customerType: 'retail' },
    }),
    prisma.order.count({
      where: { isDeleted: false, customerType: 'wholesale' },
    }),
    prisma.user.count({
      where: {
        isDeleted: false,
        role: { in: [Role.retail, Role.wholesale] },
      },
    }),
    prisma.product.count({ where: { isDeleted: false } }),
    prisma.order.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        payment: true,
      },
    }),
    prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.order.findMany({
      where: {
        isDeleted: false,
        payment: { is: yearPaymentFilter },
      },
      select: {
        customerType: true,
        total: true,
        createdAt: true,
        payment: {
          select: { amount: true, paidAt: true, createdAt: true },
        },
        items: {
          select: {
            total: true,
            product: { select: { category: { select: { name: true } } } },
          },
        },
      },
    }),
  ]);

  const monthlySales = emptyMonthly();
  let retailSales = 0;
  let wholesaleSales = 0;
  let retailOrders = 0;
  let wholesaleOrders = 0;
  const categoryTotals = new Map<string, number>();

  yearOrders.forEach(order => {
    const paymentDate = order.payment?.paidAt || order.payment?.createdAt || order.createdAt;
    if (paymentDate.getFullYear() !== year) return;

    const amount = order.payment?.amount ?? order.total;
    const bucket = monthlySales[paymentDate.getMonth()];
    if (!bucket) return;

    bucket.revenue += amount;
    if (order.customerType === 'retail') {
      bucket.retail += amount;
      retailSales += amount;
      retailOrders += 1;
    }
    if (order.customerType === 'wholesale') {
      bucket.wholesale += amount;
      wholesaleSales += amount;
      wholesaleOrders += 1;
    }

    order.items.forEach(item => {
      const name = item.product?.category?.name;
      if (!name) return;
      categoryTotals.set(name, (categoryTotals.get(name) ?? 0) + item.total);
    });
  });

  const categoryRevenue = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1]);
  const categorySum = categoryRevenue.reduce((sum, [, value]) => sum + value, 0);

  // Full year list so admins can pick any year (empty years return zeroed charts).
  const minYear = 2000;
  const maxYear = Math.max(currentYear, year);
  const availableYears: number[] = [];
  for (let value = maxYear; value >= minYear; value -= 1) {
    availableYears.push(value);
  }

  return {
    totalSales: paidPayments._sum.amount || 0,
    yearSales: yearPaidPayments._sum.amount || 0,
    retailSales,
    wholesaleSales,
    totalOrders,
    customers,
    products,
    orderCounts: {
      retail: retailOrderCount,
      wholesale: wholesaleOrderCount,
    },
    orderBreakdown: {
      retail: retailOrders,
      wholesale: wholesaleOrders,
    },
    salesByCategory: categoryRevenue.slice(0, 6).map(([name, revenue]) => ({
      name,
      revenue,
      percent: categorySum ? Math.round((revenue / categorySum) * 100) : 0,
    })),
    year,
    availableYears,
    monthlySales,
    yearlyRevenue: monthlySales.map(item => ({
      month: item.month,
      revenue: item.revenue,
    })),
    latestOrders,
    recentActivity,
  };
};

export const dashboardService = {
  getOverview,
};
