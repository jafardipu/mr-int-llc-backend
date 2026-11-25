import config from '@app/config/index.js';
import HashPassword from '@app/shared/hashPassword.js';
import prisma from '@app/shared/prisma.js';
import { assignMissingFaqOrder } from '@app/module/faq/faq.service.js';
import { DEFAULT_PRICES } from '@app/module/contents/content.pricing.js';

export async function defaultTask() {
  // Not awaited by the caller, so a failure here must not become an
  // unhandled rejection that stops the server.
  try {
    await assignMissingFaqOrder();
  } catch (error) {
    console.error('Could not assign display order to existing FAQs:', error);
  }

  const email = config?.admin_credentials?.email || 'admin@gmail.com';

  const admin = await prisma.user.findFirst({
    where: {
      role: 'admin',
    },
  });
  if (!admin) {
    await prisma.user.upsert({
      where: { email },
      update: {
        role: 'admin',
      },
      create: {
        name: 'MD Admin',
        email,
        phoneNumber: '+8801321834780',
        password: await HashPassword('112233'),
        role: 'admin',
        expireAt: null,
        verification: {
          create: {
            otp: 0,
            status: true,
          },
        },
      },
    });
  }

  const content = await prisma.contents.findFirst({});
  if (!content) {
    await prisma.contents.create({
      data: {
        termsAndCondition:
          'These are the terms and conditions of MR International LLC...',
        privacyPolicy:
          'We value your privacy and ensure your data is protected...',
        refundPolicy: 'Refunds are processed within 7-10 business days...',
        shippingPolicy: 'Orders are shipped within 3-5 business days...',
        aboutUs:
          'MR International LLC is dedicated to providing quality products for retail and wholesale customers.',
        copyRight: '© 2026 MR International LLC. All rights reserved.',
        footerText: 'Thank you for visiting MR International LLC.',
        prices: DEFAULT_PRICES,
      },
    });
  } else if (!content.prices) {
    // Contents made before store prices existed: give them the starting prices.
    await prisma.contents.update({
      where: { id: content.id },
      data: { prices: { set: DEFAULT_PRICES } },
    });
  }
}
