import { Router } from 'express';
import { userRoutes } from '@app/module/users/users.routes.js';
import { otpRoutes } from '@app/module/otp/otp.routes.js';
import { authRoutes } from '@app/module/auth/auth.route.js';
import { contentsRoutes } from '@app/module/contents/contents.route.js';
import { notificationRoutes } from '@app/module/notification/notification.route.js';
import { categoryRoutes } from '@app/module/category/category.route.js';
import { brandRoutes } from '@app/module/brand/brand.route.js';
import { productRoutes } from '@app/module/product/product.route.js';
import { cartRoutes } from '@app/module/cart/cart.route.js';
import { wishlistRoutes } from '@app/module/wishlist/wishlist.route.js';
import { orderRoutes } from '@app/module/order/order.route.js';
import { paymentRoutes } from '@app/module/payment/payment.route.js';
import { dealRoutes } from '@app/module/deal/deal.route.js';
import { bannerRoutes } from '@app/module/banner/banner.route.js';
import { prepServiceRoutes } from '@app/module/prepService/prepService.route.js';
import { reviewRoutes } from '@app/module/review/review.route.js';
import { faqRoutes } from '@app/module/faq/faq.route.js';
import { dashboardRoutes } from '@app/module/dashboard/dashboard.route.js';
import { contactRoutes } from '@app/module/contact/contact.route.js';
import { addressRoutes } from '@app/module/address/address.route.js';
import { stripeRoutes } from '@app/module/stripe/stripe.route.js';
import { promoCodeRoutes } from '@app/module/promoCode/promoCode.route.js';
import { wholesaleFeeRoutes } from '@app/module/wholesaleFee/wholesaleFee.route.js';

const router: Router = Router();

const moduleRoutes = [
  { path: '/auth', route: authRoutes },
  { path: '/users', route: userRoutes },
  { path: '/otp', route: otpRoutes },
  { path: '/categories', route: categoryRoutes },
  { path: '/brands', route: brandRoutes },
  { path: '/products', route: productRoutes },
  { path: '/cart', route: cartRoutes },
  { path: '/wishlist', route: wishlistRoutes },
  { path: '/orders', route: orderRoutes },
  { path: '/payments', route: paymentRoutes },
  { path: '/stripe', route: stripeRoutes },
  { path: '/deals', route: dealRoutes },
  { path: '/banners', route: bannerRoutes },
  { path: '/prep-services', route: prepServiceRoutes },
  { path: '/reviews', route: reviewRoutes },
  { path: '/contents', route: contentsRoutes },
  { path: '/faq', route: faqRoutes },
  { path: '/notifications', route: notificationRoutes },
  { path: '/dashboard', route: dashboardRoutes },
  { path: '/contact', route: contactRoutes },
  { path: '/address', route: addressRoutes },
  { path: '/promo-codes', route: promoCodeRoutes },
  { path: '/wholesale-fee', route: wholesaleFeeRoutes },
];

moduleRoutes.forEach(route => router.use(route.path, route.route));

export default router;
