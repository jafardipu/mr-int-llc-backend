import dotenv from 'dotenv';
import path from 'path';
import {
  CustomerType,
  OrderStatus,
  PAYMENT_STATUS,
  PrismaClient,
  Role,
} from '../generated/prisma/index.js';
import bcrypt from 'bcrypt';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const prisma = new PrismaClient();

const hash = async (password: string) => bcrypt.hash(password, 12);

async function main() {
  const adminEmail = process.env.ADMIN_MAIL || 'admin@gmail.com';
  const password = await hash('112233');

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: Role.admin },
    create: {
      name: 'MR Admin',
      email: adminEmail,
      password,
      role: Role.admin,
      phoneNumber: '+10000000000',
      expireAt: null,
      verification: { create: { otp: 0, status: true } },
    },
  });

  await prisma.user.upsert({
    where: { email: 'superadmin@mrint.com' },
    update: { role: Role.supper_admin },
    create: {
      name: 'Super Admin',
      email: 'superadmin@mrint.com',
      password,
      role: Role.supper_admin,
      expireAt: null,
      verification: { create: { otp: 0, status: true } },
    },
  });

  await prisma.user.upsert({
    where: { email: 'retail@mrint.com' },
    update: {},
    create: {
      name: 'Retail Customer',
      email: 'retail@mrint.com',
      password,
      role: Role.retail,
      expireAt: null,
      verification: { create: { otp: 0, status: true } },
    },
  });

  await prisma.user.upsert({
    where: { email: 'wholesale@mrint.com' },
    update: {},
    create: {
      name: 'Wholesale Customer',
      email: 'wholesale@mrint.com',
      password,
      role: Role.wholesale,
      expireAt: null,
      verification: { create: { otp: 0, status: true } },
    },
  });

  const categories = await Promise.all(
    [
      { name: 'Electronics', image: 'https://placehold.co/400x400?text=Electronics' },
      { name: 'Home Goods', image: 'https://placehold.co/400x400?text=Home+Goods' },
      { name: 'Office Supplies', image: 'https://placehold.co/400x400?text=Office' },
    ].map(item =>
      prisma.category.upsert({
        where: { name: item.name },
        update: item,
        create: item,
      }),
    ),
  );

  const brands = await Promise.all(
    [
      { name: 'MRI Basics', image: 'https://placehold.co/400x400?text=MRI+Basics' },
      { name: 'Northline', image: 'https://placehold.co/400x400?text=Northline' },
    ].map(item =>
      prisma.brand.upsert({
        where: { name: item.name },
        update: item,
        create: item,
      }),
    ),
  );

  const [electronics, homeGoods] = categories;
  const [mriBasics, northline] = brands;

  if (electronics && homeGoods && mriBasics && northline) {
    const products = [
      {
        name: 'Wireless Headphones',
        slug: 'wireless-headphones',
        sku: 'MRI-HP-001',
        description: 'Over-ear wireless headphones for retail and wholesale.',
        retailPrice: 89.99,
        wholesalePrice: 64.99,
        wholesaleMinQty: 6,
        stock: 120,
        categoryId: electronics.id,
        brandId: northline.id,
        isDeal: true,
        dealPrice: 74.99,
        images: {
          create: [
            { url: 'https://placehold.co/800x800?text=Headphones', isPrimary: true },
          ],
        },
      },
      {
        name: 'Stainless Water Bottle',
        slug: 'stainless-water-bottle',
        sku: 'MRI-BT-002',
        description: 'Insulated 24oz bottle.',
        retailPrice: 24.5,
        wholesalePrice: 14.75,
        wholesaleMinQty: 12,
        stock: 300,
        categoryId: homeGoods.id,
        brandId: mriBasics.id,
        images: {
          create: [
            { url: 'https://placehold.co/800x800?text=Bottle', isPrimary: true },
          ],
        },
      },
      {
        name: 'USB-C Hub',
        slug: 'usb-c-hub',
        sku: 'MRI-HB-003',
        description: '7-in-1 USB-C hub.',
        retailPrice: 49.0,
        wholesalePrice: 32.0,
        wholesaleMinQty: 8,
        stock: 80,
        categoryId: electronics.id,
        brandId: northline.id,
        images: {
          create: [{ url: 'https://placehold.co/800x800?text=Hub', isPrimary: true }],
        },
      },
    ];

    for (const product of products) {
      await prisma.product.upsert({
        where: { sku: product.sku },
        update: {
          name: product.name,
          slug: product.slug,
          retailPrice: product.retailPrice,
          wholesalePrice: product.wholesalePrice,
          wholesaleMinQty: product.wholesaleMinQty,
          stock: product.stock,
        },
        create: product,
      });
    }

    const dealProduct = await prisma.product.findUnique({
      where: { sku: 'MRI-HP-001' },
    });
    if (dealProduct) {
      const existingDeal = await prisma.deal.findFirst({
        where: { productId: dealProduct.id, isDeleted: false },
      });
      if (!existingDeal) {
        await prisma.deal.create({
          data: {
            productId: dealProduct.id,
            dealPrice: 74.99,
            type: 'weekly',
            isActive: true,
          },
        });
      }
    }
  }

  const existingBanner = await prisma.banner.findFirst({
    where: {
      image: 'https://placehold.co/1400x500?text=MR+International',
      isDeleted: false,
    },
  });
  if (!existingBanner) {
    await prisma.banner.create({
      data: {
        image: 'https://placehold.co/1400x500?text=MR+International',
        link: '/products',
        isActive: true,
      },
    });
  }

  const existingPromo = await prisma.promoCode.findFirst({
    where: { code: 'WELCOME10' },
  });
  if (!existingPromo) {
    await prisma.promoCode.create({
      data: {
        code: 'WELCOME10',
        description: '10% off your first eligible order',
        discountType: 'percentage',
        discountValue: 10,
        minOrderAmount: 50,
        maxDiscount: 100,
        usageLimit: 1000,
        perUserLimit: 1,
        isActive: true,
      },
    });
  }

  const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (admin) {
    const existingNotes = await prisma.notification.count({
      where: { receiverId: admin.id },
    });
    if (existingNotes === 0) {
      await prisma.notification.create({
        data: {
          receiverId: admin.id,
          message: 'Welcome to the admin dashboard',
          description: 'Order and 3PL prep alerts will appear here.',
        },
      });
      await prisma.notification.create({
        data: {
          receiverId: admin.id,
          message: 'New order placed',
          description: 'Retail Customer placed order MRI-84021.',
        },
      });
    }
  }

  const retailUser = await prisma.user.findUnique({ where: { email: 'retail@mrint.com' } });
  const wholesaleUser = await prisma.user.findUnique({
    where: { email: 'wholesale@mrint.com' },
  });
  const seedProduct = await prisma.product.findFirst({ where: { isDeleted: false } });
  const seededRevenue = await prisma.payment.count({
    where: { transactionId: { startsWith: 'SEED-REV-' } },
  });

  if (retailUser && wholesaleUser && seedProduct && seededRevenue === 0) {
    const currentYear = new Date().getFullYear();
    const revenueSamples = [
      { year: currentYear, month: 0, amount: 4200, customerType: CustomerType.retail, userId: retailUser.id },
      { year: currentYear, month: 2, amount: 6100, customerType: CustomerType.wholesale, userId: wholesaleUser.id },
      { year: currentYear, month: 4, amount: 5300, customerType: CustomerType.retail, userId: retailUser.id },
      { year: currentYear, month: 7, amount: 8900, customerType: CustomerType.wholesale, userId: wholesaleUser.id },
      { year: currentYear, month: 9, amount: 4700, customerType: CustomerType.retail, userId: retailUser.id },
      { year: currentYear - 1, month: 1, amount: 3100, customerType: CustomerType.retail, userId: retailUser.id },
      { year: currentYear - 1, month: 5, amount: 7200, customerType: CustomerType.wholesale, userId: wholesaleUser.id },
      { year: currentYear - 1, month: 10, amount: 5500, customerType: CustomerType.retail, userId: retailUser.id },
    ];

    for (const [index, sample] of revenueSamples.entries()) {
      const paidAt = new Date(sample.year, sample.month, 12, 14, 0, 0);
      const orderNumber = `MRI-SEED-${sample.year}-${String(index + 1).padStart(2, '0')}`;
      const existing = await prisma.order.findUnique({ where: { orderNumber } });
      if (existing) continue;

      const order = await prisma.order.create({
        data: {
          orderNumber,
          userId: sample.userId,
          customerType: sample.customerType,
          status: OrderStatus.completed,
          subtotal: sample.amount,
          shippingFee: 0,
          tax: 0,
          discount: 0,
          total: sample.amount,
          createdAt: paidAt,
          items: {
            create: {
              productId: seedProduct.id,
              name: seedProduct.name,
              sku: seedProduct.sku,
              quantity: 1,
              unitPrice: sample.amount,
              total: sample.amount,
            },
          },
          payment: {
            create: {
              userId: sample.userId,
              amount: sample.amount,
              status: PAYMENT_STATUS.paid,
              transactionId: `SEED-REV-${sample.year}-${index + 1}`,
              paymentMethod: 'card',
              paidAt,
              createdAt: paidAt,
            },
          },
        },
      });
      void order;
    }
  }

  const contents = await prisma.contents.findFirst();
  if (!contents) {
    await prisma.contents.create({
      data: {
        aboutUs:
          'MR International LLC supplies retail and wholesale customers with quality products and 3PL prep services.',
        termsAndCondition: 'These are the terms and conditions of our store.',
        privacyPolicy: 'We protect customer data and never sell personal information.',
        refundPolicy: 'Eligible refunds are processed within 7-10 business days.',
        shippingPolicy: 'Orders ship within 3-5 business days.',
        copyRight: '© 2026 MR International LLC. All rights reserved.',
        footerText: 'Thank you for shopping with MR International LLC.',
      },
    });
  }

  const faqCount = await prisma.faq.count();
  if (faqCount === 0) {
    await prisma.faq.createMany({
      data: [
        {
          question: 'Do wholesale customers need a minimum quantity?',
          answer: 'Yes. Each product has its own wholesale minimum quantity.',
        },
        {
          question: 'How do I request a 3PL prep service?',
          answer: 'Sign in and submit a request from Prep Services with notes and attachments.',
        },
        {
          question: 'What payment methods are supported?',
          answer: 'Checkout creates a Stripe payment intent for card payments.',
        },
      ],
    });
  }

  console.log('Seed completed for MR International LLC');
}

main()
  .catch(error => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
