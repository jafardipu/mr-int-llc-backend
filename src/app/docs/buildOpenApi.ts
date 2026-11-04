type HttpMethod = 'get' | 'post' | 'patch' | 'put' | 'delete';

type Op = {
  method: HttpMethod;
  path: string;
  summary: string;
  tags: string[];
  auth?: 'bearer' | 'optional' | 'none';
  roles?: string;
  query?: Record<
    string,
    {
      type?: string;
      description?: string;
      required?: boolean;
      enum?: string[];
      example?: string | number;
    }
  >;
  pathParams?: string[];
  body?: Record<string, unknown>;
  multipart?: boolean;
  description?: string;
};

const envelope = {
  type: 'object',
  required: ['success', 'message', 'data'],
  properties: {
    success: { type: 'boolean', example: true },
    message: { type: 'string' },
    data: {},
    meta: {
      type: 'object',
      properties: {
        page: { type: 'integer' },
        limit: { type: 'integer' },
        total: { type: 'integer' },
        totalPage: { type: 'integer' },
      },
    },
  },
};

const objectId = {
  type: 'string',
  description: 'MongoDB ObjectId',
  example: '66f000000000000000000001',
};

const paginationQuery = {
  page: { type: 'integer', description: 'Page number (default 1)' },
  limit: { type: 'integer', description: 'Page size (default 10)' },
  searchTerm: { type: 'string', description: 'Free-text search' },
};

const ops: Op[] = [
  // Auth
  {
    method: 'post',
    path: '/auth/register',
    summary: 'Register retail or wholesale customer',
    tags: ['Auth'],
    body: {
      name: { type: 'string' },
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 6 },
      phoneNumber: { type: 'string' },
      role: { type: 'string', enum: ['retail', 'wholesale'] },
      fcmToken: { type: 'string' },
    },
  },
  {
    method: 'post',
    path: '/auth/login',
    summary: 'Login and receive access/refresh tokens',
    tags: ['Auth'],
    body: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string' },
      fcmToken: { type: 'string' },
    },
  },
  {
    method: 'post',
    path: '/auth/refresh-token',
    summary: 'Refresh access token from cookie/body refresh token',
    tags: ['Auth'],
  },
  {
    method: 'patch',
    path: '/auth/change-password',
    summary: 'Change password for authenticated user',
    tags: ['Auth'],
    auth: 'bearer',
    roles: 'any authenticated role',
    body: {
      oldPassword: { type: 'string' },
      newPassword: { type: 'string', minLength: 6 },
      confirmPassword: { type: 'string' },
    },
  },
  {
    method: 'patch',
    path: '/auth/forgot-password',
    summary: 'Request password reset email/OTP',
    tags: ['Auth'],
    body: { email: { type: 'string', format: 'email' } },
  },
  {
    method: 'patch',
    path: '/auth/reset-password',
    summary: 'Reset password after OTP verification',
    tags: ['Auth'],
    body: {
      newPassword: { type: 'string', minLength: 6 },
      confirmPassword: { type: 'string' },
    },
  },

  // OTP
  {
    method: 'post',
    path: '/otp/verify-otp',
    summary: 'Verify OTP (primary)',
    tags: ['OTP'],
    body: {
      email: { type: 'string', format: 'email' },
      otp: { type: 'number' },
    },
  },
  {
    method: 'post',
    path: '/otp/verify',
    summary: 'Verify OTP (alias)',
    tags: ['OTP'],
    body: {
      email: { type: 'string', format: 'email' },
      otp: { type: 'number' },
    },
  },
  {
    method: 'post',
    path: '/otp/resend-otp',
    summary: 'Resend OTP (primary)',
    tags: ['OTP'],
    body: { email: { type: 'string', format: 'email' } },
  },
  {
    method: 'post',
    path: '/otp/send',
    summary: 'Resend OTP (alias)',
    tags: ['OTP'],
    body: { email: { type: 'string', format: 'email' } },
  },

  // Users
  {
    method: 'post',
    path: '/users',
    summary: 'Create user (multipart profile optional)',
    tags: ['Users'],
    multipart: true,
    body: {
      name: { type: 'string' },
      email: { type: 'string' },
      password: { type: 'string' },
      role: { type: 'string', enum: ['retail', 'wholesale'] },
      phoneNumber: { type: 'string' },
      profile: { type: 'string', format: 'binary', description: 'Profile image file' },
    },
  },
  {
    method: 'get',
    path: '/users',
    summary: 'List customers (admin)',
    tags: ['Users'],
    auth: 'bearer',
    roles: 'admin, supper_admin',
    query: {
      ...paginationQuery,
      status: { type: 'string', enum: ['active', 'blocked'] },
      role: { type: 'string', enum: ['retail', 'wholesale'] },
    },
  },
  {
    method: 'get',
    path: '/users/my-profile',
    summary: 'Get authenticated user profile',
    tags: ['Users'],
    auth: 'bearer',
  },
  {
    method: 'patch',
    path: '/users/update-my-profile',
    summary: 'Update own profile (multipart profile optional)',
    tags: ['Users'],
    auth: 'bearer',
    multipart: true,
    body: {
      name: { type: 'string' },
      phoneNumber: { type: 'string' },
      profile: { type: 'string', format: 'binary' },
    },
  },
  {
    method: 'delete',
    path: '/users/delete-my-account',
    summary: 'Soft-delete own account',
    tags: ['Users'],
    auth: 'bearer',
  },
  {
    method: 'get',
    path: '/users/{id}',
    summary: 'Get user by id (admin)',
    tags: ['Users'],
    auth: 'bearer',
    roles: 'admin, supper_admin',
    pathParams: ['id'],
  },
  {
    method: 'patch',
    path: '/users/{id}',
    summary: 'Update user by id (admin)',
    tags: ['Users'],
    auth: 'bearer',
    roles: 'admin, supper_admin',
    pathParams: ['id'],
    multipart: true,
  },
  {
    method: 'patch',
    path: '/users/{id}/block',
    summary: 'Block or unblock user (admin)',
    tags: ['Users'],
    auth: 'bearer',
    roles: 'admin, supper_admin',
    pathParams: ['id'],
    body: { status: { type: 'string', enum: ['active', 'blocked'] } },
  },
  {
    method: 'delete',
    path: '/users/{id}',
    summary: 'Delete user (admin)',
    tags: ['Users'],
    auth: 'bearer',
    roles: 'admin, supper_admin',
    pathParams: ['id'],
  },

  // Categories
  {
    method: 'get',
    path: '/categories',
    summary: 'List categories',
    tags: ['Categories'],
    query: paginationQuery,
  },
  {
    method: 'get',
    path: '/categories/{id}',
    summary: 'Get category by id',
    tags: ['Categories'],
    pathParams: ['id'],
  },
  {
    method: 'post',
    path: '/categories',
    summary: 'Create category (admin, multipart image)',
    tags: ['Categories'],
    auth: 'bearer',
    roles: 'admin, supper_admin',
    multipart: true,
    body: {
      name: { type: 'string' },
      status: { type: 'string', enum: ['active', 'inactive'] },
      image: { type: 'string', format: 'binary' },
    },
  },
  {
    method: 'patch',
    path: '/categories/{id}',
    summary: 'Update category (admin)',
    tags: ['Categories'],
    auth: 'bearer',
    roles: 'admin, supper_admin',
    pathParams: ['id'],
    multipart: true,
  },
  {
    method: 'delete',
    path: '/categories/{id}',
    summary: 'Delete category (admin)',
    tags: ['Categories'],
    auth: 'bearer',
    roles: 'admin, supper_admin',
    pathParams: ['id'],
  },

  // Brands
  {
    method: 'get',
    path: '/brands',
    summary: 'List brands',
    tags: ['Brands'],
    query: paginationQuery,
  },
  {
    method: 'get',
    path: '/brands/{id}',
    summary: 'Get brand by id',
    tags: ['Brands'],
    pathParams: ['id'],
  },
  {
    method: 'post',
    path: '/brands',
    summary: 'Create brand (admin)',
    tags: ['Brands'],
    auth: 'bearer',
    roles: 'admin, supper_admin',
    multipart: true,
    body: {
      name: { type: 'string' },
      image: { type: 'string', format: 'binary' },
    },
  },
  {
    method: 'patch',
    path: '/brands/{id}',
    summary: 'Update brand (admin)',
    tags: ['Brands'],
    auth: 'bearer',
    roles: 'admin, supper_admin',
    pathParams: ['id'],
    multipart: true,
  },
  {
    method: 'delete',
    path: '/brands/{id}',
    summary: 'Delete brand (admin)',
    tags: ['Brands'],
    auth: 'bearer',
    roles: 'admin, supper_admin',
    pathParams: ['id'],
  },

  // Products
  {
    method: 'get',
    path: '/products',
    summary: 'List products (optional auth for role pricing)',
    tags: ['Products'],
    auth: 'optional',
    query: {
      ...paginationQuery,
      categoryId: { type: 'string' },
      brandId: { type: 'string' },
      status: { type: 'string', enum: ['active', 'inactive', 'out_of_stock'] },
    },
  },
  {
    method: 'get',
    path: '/products/{id}',
    summary: 'Get product by id',
    tags: ['Products'],
    auth: 'optional',
    pathParams: ['id'],
  },
  {
    method: 'post',
    path: '/products',
    summary: 'Create product (admin, multipart images[])',
    tags: ['Products'],
    auth: 'bearer',
    roles: 'admin, supper_admin',
    multipart: true,
    body: {
      name: { type: 'string' },
      sku: { type: 'string' },
      retailPrice: { type: 'number' },
      wholesalePrice: { type: 'number' },
      wholesaleMinQty: { type: 'integer' },
      stock: { type: 'integer' },
      brandId: { type: 'string' },
      categoryId: { type: 'string' },
      subcategory: { type: 'string' },
      asin: { type: 'string' },
      amazonUrl: { type: 'string' },
      walmartUrl: { type: 'string' },
      description: { type: 'string' },
      status: { type: 'string', enum: ['active', 'inactive', 'out_of_stock'] },
      volumeTiers: { type: 'string', description: 'JSON string array of volume tiers' },
      images: { type: 'array', items: { type: 'string', format: 'binary' } },
    },
  },
  {
    method: 'patch',
    path: '/products/{id}',
    summary: 'Update product (admin)',
    tags: ['Products'],
    auth: 'bearer',
    roles: 'admin, supper_admin',
    pathParams: ['id'],
    multipart: true,
  },
  {
    method: 'delete',
    path: '/products/{id}',
    summary: 'Delete product (admin)',
    tags: ['Products'],
    auth: 'bearer',
    roles: 'admin, supper_admin',
    pathParams: ['id'],
  },

  // Cart
  {
    method: 'get',
    path: '/cart',
    summary: 'Get my cart',
    tags: ['Cart'],
    auth: 'bearer',
    roles: 'retail, wholesale',
  },
  {
    method: 'post',
    path: '/cart',
    summary: 'Add item to cart',
    tags: ['Cart'],
    auth: 'bearer',
    roles: 'retail, wholesale',
    body: {
      productId: { type: 'string' },
      quantity: { type: 'integer', minimum: 1 },
    },
  },
  {
    method: 'patch',
    path: '/cart/{id}',
    summary: 'Update cart item quantity',
    tags: ['Cart'],
    auth: 'bearer',
    roles: 'retail, wholesale',
    pathParams: ['id'],
    body: { quantity: { type: 'integer', minimum: 1 } },
  },
  {
    method: 'delete',
    path: '/cart/{id}',
    summary: 'Remove cart item',
    tags: ['Cart'],
    auth: 'bearer',
    roles: 'retail, wholesale',
    pathParams: ['id'],
  },

  // Wishlist
  {
    method: 'get',
    path: '/wishlist',
    summary: 'Get my wishlist',
    tags: ['Wishlist'],
    auth: 'bearer',
    roles: 'retail, wholesale',
  },
  {
    method: 'post',
    path: '/wishlist',
    summary: 'Add product to wishlist',
    tags: ['Wishlist'],
    auth: 'bearer',
    roles: 'retail, wholesale',
    body: { productId: { type: 'string' } },
  },
  {
    method: 'delete',
    path: '/wishlist/{id}',
    summary: 'Remove wishlist item',
    tags: ['Wishlist'],
    auth: 'bearer',
    roles: 'retail, wholesale',
    pathParams: ['id'],
  },

  // Orders
  {
    method: 'post',
    path: '/orders/checkout',
    summary: 'Checkout cart into an order',
    tags: ['Orders'],
    auth: 'bearer',
    roles: 'retail, wholesale',
    description:
      'Creates an order from the authenticated user cart. When `promoCode` is provided it is validated and applied; the resulting discount is stored on the order and a redemption is recorded. Manual `discount` is only used when no promo code is sent.',
    body: {
      addressId: { type: 'string' },
      notes: { type: 'string' },
      shippingFee: { type: 'number' },
      tax: { type: 'number' },
      discount: {
        type: 'number',
        description: 'Manual discount fallback when promoCode is omitted',
      },
      promoCode: {
        type: 'string',
        example: 'WELCOME10',
        description: 'Optional promo code applied at checkout',
      },
    },
  },
  {
    method: 'get',
    path: '/orders/my-orders',
    summary: 'List my orders',
    tags: ['Orders'],
    auth: 'bearer',
    roles: 'retail, wholesale',
    query: paginationQuery,
  },
  {
    method: 'get',
    path: '/orders',
    summary: 'List all orders (admin)',
    tags: ['Orders'],
    auth: 'bearer',
    roles: 'admin, supper_admin',
    query: {
      ...paginationQuery,
      status: {
        type: 'string',
        enum: ['pending', 'processing', 'completed', 'cancelled'],
      },
      customerType: { type: 'string', enum: ['retail', 'wholesale'] },
    },
  },
  {
    method: 'get',
    path: '/orders/{id}',
    summary: 'Get order by id',
    tags: ['Orders'],
    auth: 'bearer',
    pathParams: ['id'],
  },
  {
    method: 'patch',
    path: '/orders/{id}/status',
    summary: 'Update order fulfillment status (admin)',
    tags: ['Orders'],
    auth: 'bearer',
    roles: 'admin, supper_admin',
    pathParams: ['id'],
    body: {
      status: {
        type: 'string',
        enum: ['pending', 'processing', 'completed', 'cancelled'],
      },
    },
  },

  // Payments
  {
    method: 'post',
    path: '/payments/create',
    summary: 'Create Stripe payment intent for order',
    tags: ['Payments'],
    auth: 'bearer',
    roles: 'retail, wholesale',
    body: {
      orderId: { type: 'string' },
      paymentMethod: { type: 'string' },
    },
  },
  {
    method: 'get',
    path: '/payments/confirm-payment',
    summary: 'Confirm payment via Stripe paymentIntentId query',
    tags: ['Payments'],
    query: {
      paymentIntentId: {
        type: 'string',
        required: true,
        description: 'Stripe payment intent id',
      },
    },
  },
  {
    method: 'get',
    path: '/payments',
    summary: 'List payments (admin)',
    tags: ['Payments'],
    auth: 'bearer',
    roles: 'admin, supper_admin',
    query: paginationQuery,
  },
  {
    method: 'get',
    path: '/payments/{id}',
    summary: 'Get payment by id (admin)',
    tags: ['Payments'],
    auth: 'bearer',
    roles: 'admin, supper_admin',
    pathParams: ['id'],
  },

  // Stripe
  {
    method: 'get',
    path: '/stripe/get-customer',
    summary: 'Get or create Stripe customer id for current user',
    tags: ['Stripe'],
    auth: 'bearer',
    roles: 'retail, wholesale',
  },

  // Deals
  {
    method: 'get',
    path: '/deals',
    summary: 'List deals',
    tags: ['Deals'],
    auth: 'optional',
    query: paginationQuery,
  },
  {
    method: 'get',
    path: '/deals/{id}',
    summary: 'Get deal by id',
    tags: ['Deals'],
    auth: 'optional',
    pathParams: ['id'],
  },
  {
    method: 'post',
    path: '/deals',
    summary: 'Create deal (admin)',
    tags: ['Deals'],
    auth: 'bearer',
    roles: 'admin, supper_admin',
    multipart: true,
  },
  {
    method: 'patch',
    path: '/deals/{id}',
    summary: 'Update deal (admin)',
    tags: ['Deals'],
    auth: 'bearer',
    roles: 'admin, supper_admin',
    pathParams: ['id'],
    multipart: true,
  },
  {
    method: 'delete',
    path: '/deals/{id}',
    summary: 'Delete deal (admin)',
    tags: ['Deals'],
    auth: 'bearer',
    roles: 'admin, supper_admin',
    pathParams: ['id'],
  },

  // Promo Codes
  {
    method: 'post',
    path: '/promo-codes/validate',
    summary: 'Validate a promo code against a cart subtotal',
    description:
      'Checks active window, usage limits, customer type, and min order amount. Pass Bearer token when available so per-user limits are enforced. Returns computed discount for the given subtotal.',
    tags: ['Promo Codes'],
    auth: 'optional',
    body: {
      code: {
        type: 'string',
        example: 'WELCOME10',
        description: 'Promo code (case-insensitive)',
      },
      subtotal: {
        type: 'number',
        example: 120,
        description: 'Cart subtotal used to compute discount',
      },
    },
  },
  {
    method: 'get',
    path: '/promo-codes',
    summary: 'List promo codes (admin)',
    tags: ['Promo Codes'],
    auth: 'bearer',
    roles: 'admin, supper_admin',
    query: {
      ...paginationQuery,
      isActive: {
        type: 'boolean',
        description: 'Filter by active flag',
      },
      customerType: {
        type: 'string',
        enum: ['retail', 'wholesale'],
        description: 'Filter by audience',
      },
      sort: {
        type: 'string',
        description: 'Comma-separated fields; prefix with - for desc (e.g. -createdAt)',
        example: '-createdAt',
      },
    },
  },
  {
    method: 'get',
    path: '/promo-codes/{id}',
    summary: 'Get promo code by id (admin)',
    tags: ['Promo Codes'],
    auth: 'bearer',
    roles: 'admin, supper_admin',
    pathParams: ['id'],
  },
  {
    method: 'post',
    path: '/promo-codes',
    summary: 'Create promo code (admin)',
    description:
      'Codes are stored uppercase. Percentage discountValue must be 1–100. Soft-deleted codes with the same code can be reactivated by creating again.',
    tags: ['Promo Codes'],
    auth: 'bearer',
    roles: 'admin, supper_admin',
    body: {
      code: { type: 'string', example: 'WELCOME10' },
      description: {
        type: 'string',
        example: '10% off your first eligible order',
      },
      discountType: { type: 'string', enum: ['percentage', 'fixed'] },
      discountValue: { type: 'number', example: 10 },
      minOrderAmount: { type: 'number', example: 50 },
      maxDiscount: {
        type: 'number',
        example: 100,
        description: 'Cap for percentage discounts (optional)',
      },
      usageLimit: {
        type: 'integer',
        example: 1000,
        description: 'Global redemption cap (null = unlimited)',
      },
      perUserLimit: { type: 'integer', example: 1 },
      startsAt: { type: 'string', format: 'date-time' },
      expiresAt: { type: 'string', format: 'date-time' },
      isActive: { type: 'boolean', example: true },
      customerType: {
        type: 'string',
        enum: ['retail', 'wholesale'],
        description: 'Omit for all customers',
      },
    },
  },
  {
    method: 'patch',
    path: '/promo-codes/{id}',
    summary: 'Update promo code (admin)',
    description: 'Partial update. Same field rules as create.',
    tags: ['Promo Codes'],
    auth: 'bearer',
    roles: 'admin, supper_admin',
    pathParams: ['id'],
    body: {
      code: { type: 'string' },
      description: { type: 'string' },
      discountType: { type: 'string', enum: ['percentage', 'fixed'] },
      discountValue: { type: 'number' },
      minOrderAmount: { type: 'number' },
      maxDiscount: { type: 'number' },
      usageLimit: { type: 'integer' },
      perUserLimit: { type: 'integer' },
      startsAt: { type: 'string', format: 'date-time' },
      expiresAt: { type: 'string', format: 'date-time' },
      isActive: { type: 'boolean' },
      customerType: { type: 'string', enum: ['retail', 'wholesale'] },
    },
  },
  {
    method: 'delete',
    path: '/promo-codes/{id}',
    summary: 'Delete promo code (admin)',
    description: 'Soft delete: sets isDeleted=true and isActive=false.',
    tags: ['Promo Codes'],
    auth: 'bearer',
    roles: 'admin, supper_admin',
    pathParams: ['id'],
  },

  // Banners
  {
    method: 'get',
    path: '/banners/homepage',
    summary: 'Public homepage banners',
    tags: ['Banners'],
  },
  {
    method: 'get',
    path: '/banners',
    summary: 'List all banners (admin)',
    tags: ['Banners'],
    auth: 'bearer',
    roles: 'admin, supper_admin',
    query: paginationQuery,
  },
  {
    method: 'get',
    path: '/banners/{id}',
    summary: 'Get banner by id',
    tags: ['Banners'],
    pathParams: ['id'],
  },
  {
    method: 'post',
    path: '/banners',
    summary: 'Create banner (admin)',
    tags: ['Banners'],
    auth: 'bearer',
    roles: 'admin, supper_admin',
    multipart: true,
  },
  {
    method: 'patch',
    path: '/banners/{id}',
    summary: 'Update banner (admin)',
    tags: ['Banners'],
    auth: 'bearer',
    roles: 'admin, supper_admin',
    pathParams: ['id'],
    multipart: true,
  },
  {
    method: 'delete',
    path: '/banners/{id}',
    summary: 'Delete banner (admin)',
    tags: ['Banners'],
    auth: 'bearer',
    roles: 'admin, supper_admin',
    pathParams: ['id'],
  },

  // Prep services
  {
    method: 'post',
    path: '/prep-services',
    summary: 'Create 3PL prep request (customer, multipart attachments)',
    tags: ['Prep Services'],
    auth: 'bearer',
    roles: 'retail, wholesale',
    multipart: true,
    body: {
      serviceType: { type: 'string' },
      notes: { type: 'string' },
      attachments: { type: 'array', items: { type: 'string', format: 'binary' } },
    },
  },
  {
    method: 'get',
    path: '/prep-services/my',
    summary: 'List my prep requests',
    tags: ['Prep Services'],
    auth: 'bearer',
    roles: 'retail, wholesale',
    query: paginationQuery,
  },
  {
    method: 'get',
    path: '/prep-services',
    summary: 'List all prep requests (admin)',
    tags: ['Prep Services'],
    auth: 'bearer',
    roles: 'admin, supper_admin',
    query: {
      ...paginationQuery,
      status: {
        type: 'string',
        enum: ['under_review', 'correction_required', 'completed'],
      },
    },
  },
  {
    method: 'get',
    path: '/prep-services/{id}',
    summary: 'Get prep request by id',
    tags: ['Prep Services'],
    auth: 'bearer',
    pathParams: ['id'],
  },
  {
    method: 'patch',
    path: '/prep-services/{id}/status',
    summary: 'Update prep request status (admin)',
    tags: ['Prep Services'],
    auth: 'bearer',
    roles: 'admin, supper_admin',
    pathParams: ['id'],
    body: {
      status: {
        type: 'string',
        enum: ['under_review', 'correction_required', 'completed'],
      },
      adminNote: { type: 'string' },
    },
  },

  // Reviews
  {
    method: 'get',
    path: '/reviews',
    summary: 'List reviews',
    tags: ['Reviews'],
    query: { ...paginationQuery, productId: { type: 'string' } },
  },
  {
    method: 'get',
    path: '/reviews/{id}',
    summary: 'Get review by id',
    tags: ['Reviews'],
    pathParams: ['id'],
  },
  {
    method: 'post',
    path: '/reviews',
    summary: 'Create review',
    tags: ['Reviews'],
    auth: 'bearer',
    roles: 'retail, wholesale',
    body: {
      productId: { type: 'string' },
      rating: { type: 'number', minimum: 1, maximum: 5 },
      comment: { type: 'string' },
    },
  },
  {
    method: 'delete',
    path: '/reviews/{id}',
    summary: 'Delete review',
    tags: ['Reviews'],
    auth: 'bearer',
    pathParams: ['id'],
  },

  // Contents
  {
    method: 'get',
    path: '/contents',
    summary: 'Get CMS contents (optional field filter)',
    tags: ['Contents'],
    query: {
      field: {
        type: 'string',
        description:
          'Optional single content field, e.g. aboutUs, termsAndCondition, privacyPolicy',
      },
    },
  },
  {
    method: 'patch',
    path: '/contents',
    summary: 'Update CMS contents (admin)',
    tags: ['Contents'],
    auth: 'bearer',
    roles: 'admin, supper_admin',
    body: {
      aboutUs: { type: 'string' },
      termsAndCondition: { type: 'string' },
      privacyPolicy: { type: 'string' },
      refundPolicy: { type: 'string' },
      shippingPolicy: { type: 'string' },
      copyRight: { type: 'string' },
      footerText: { type: 'string' },
    },
  },

  // FAQ
  {
    method: 'get',
    path: '/faq',
    summary: 'List FAQs',
    tags: ['FAQ'],
    query: paginationQuery,
  },
  {
    method: 'get',
    path: '/faq/{id}',
    summary: 'Get FAQ by id',
    tags: ['FAQ'],
    pathParams: ['id'],
  },
  {
    method: 'post',
    path: '/faq',
    summary: 'Create FAQ (admin)',
    tags: ['FAQ'],
    auth: 'bearer',
    roles: 'admin, supper_admin',
    body: {
      question: { type: 'string' },
      answer: { type: 'string' },
    },
  },
  {
    method: 'patch',
    path: '/faq/{id}',
    summary: 'Update FAQ (admin)',
    tags: ['FAQ'],
    auth: 'bearer',
    roles: 'admin, supper_admin',
    pathParams: ['id'],
    body: {
      question: { type: 'string' },
      answer: { type: 'string' },
    },
  },
  {
    method: 'delete',
    path: '/faq/{id}',
    summary: 'Delete FAQ (admin)',
    tags: ['FAQ'],
    auth: 'bearer',
    roles: 'admin, supper_admin',
    pathParams: ['id'],
  },

  // Notifications
  {
    method: 'get',
    path: '/notifications',
    summary: 'List my notifications',
    tags: ['Notifications'],
    auth: 'bearer',
  },
  {
    method: 'patch',
    path: '/notifications',
    summary: 'Mark all my notifications as read',
    tags: ['Notifications'],
    auth: 'bearer',
    description: 'No request body. Marks every notification for the authenticated user as read.',
  },
  {
    method: 'delete',
    path: '/notifications',
    summary: 'Delete all my notifications',
    tags: ['Notifications'],
    auth: 'bearer',
    description: 'No request body. Deletes every notification for the authenticated user.',
  },

  // Dashboard
  {
    method: 'get',
    path: '/dashboard/overview',
    summary: 'Admin dashboard overview (year-scoped charts)',
    tags: ['Dashboard'],
    auth: 'bearer',
    roles: 'admin, supper_admin',
    query: {
      year: {
        type: 'integer',
        description: 'Calendar year for revenue/order chart series',
        example: '2026',
      },
    },
    description:
      'Returns KPI totals, yearSales, monthlySales (retail/wholesale), yearlyRevenue, salesByCategory, orderBreakdown (year), orderCounts (all-time), latestOrders, recentActivity, availableYears.',
  },
  {
    method: 'get',
    path: '/dashboard',
    summary: 'Admin dashboard overview (alias of /overview)',
    tags: ['Dashboard'],
    auth: 'bearer',
    roles: 'admin, supper_admin',
    query: { year: { type: 'integer' } },
  },

  // Contact
  {
    method: 'post',
    path: '/contact',
    summary: 'Submit contact message',
    tags: ['Contact'],
    auth: 'optional',
    body: {
      name: { type: 'string' },
      email: { type: 'string', format: 'email' },
      subject: { type: 'string' },
      message: { type: 'string' },
    },
  },
  {
    method: 'get',
    path: '/contact',
    summary: 'List contact messages (admin)',
    tags: ['Contact'],
    auth: 'bearer',
    roles: 'admin, supper_admin',
    query: paginationQuery,
  },
  {
    method: 'get',
    path: '/contact/{id}',
    summary: 'Get support message by id (admin)',
    tags: ['Contact'],
    auth: 'bearer',
    roles: 'admin, supper_admin',
  },
  {
    method: 'patch',
    path: '/contact/{id}/reply',
    summary: 'Reply to support message (admin)',
    tags: ['Contact'],
    auth: 'bearer',
    roles: 'admin, supper_admin',
    body: {
      reply: { type: 'string' },
    },
  },

  // Address
  {
    method: 'get',
    path: '/address',
    summary: 'List my addresses',
    tags: ['Address'],
    auth: 'bearer',
    roles: 'retail, wholesale',
  },
  {
    method: 'post',
    path: '/address',
    summary: 'Create address',
    tags: ['Address'],
    auth: 'bearer',
    roles: 'retail, wholesale',
    body: {
      addressLine1: { type: 'string' },
      addressLine2: { type: 'string' },
      city: { type: 'string' },
      state: { type: 'string' },
      postalCode: { type: 'string' },
      country: { type: 'string' },
      isDefault: { type: 'boolean' },
    },
  },
  {
    method: 'get',
    path: '/address/{id}',
    summary: 'Get address by id',
    tags: ['Address'],
    auth: 'bearer',
    roles: 'retail, wholesale',
    pathParams: ['id'],
  },
  {
    method: 'patch',
    path: '/address/{id}',
    summary: 'Update address',
    tags: ['Address'],
    auth: 'bearer',
    roles: 'retail, wholesale',
    pathParams: ['id'],
  },
  {
    method: 'delete',
    path: '/address/{id}',
    summary: 'Delete address',
    tags: ['Address'],
    auth: 'bearer',
    roles: 'retail, wholesale',
    pathParams: ['id'],
  },
];

function buildParameters(op: Op) {
  const params: Record<string, unknown>[] = [];
  for (const name of op.pathParams ?? []) {
    params.push({
      name,
      in: 'path',
      required: true,
      schema: objectId,
    });
  }
  if (op.query) {
    for (const [name, schema] of Object.entries(op.query)) {
      const { required, description, ...rest } = schema;
      params.push({
        name,
        in: 'query',
        required: Boolean(required),
        description,
        schema: rest,
      });
    }
  }
  return params;
}

function buildRequestBody(op: Op) {
  if (!op.body && !op.multipart) return undefined;
  const properties = op.body ?? {};
  const contentType = op.multipart ? 'multipart/form-data' : 'application/json';
  return {
    required: Boolean(op.body),
    content: {
      [contentType]: {
        schema: {
          type: 'object',
          properties,
        },
      },
    },
  };
}

function buildSecurity(op: Op) {
  if (op.auth === 'bearer') return [{ bearerAuth: [] }];
  if (op.auth === 'optional') return [{ bearerAuth: [] }, {}];
  return undefined;
}

export function buildOpenApiDocument(options?: { publicOrigin?: string }) {
  const paths: Record<string, Record<string, unknown>> = {};
  const publicOrigin = (options?.publicOrigin || process.env.SERVER_URL || '')
    .trim()
    .replace(/\/$/, '');

  for (const op of ops) {
    const pathItem = paths[op.path] ?? (paths[op.path] = {});
    const parameters = buildParameters(op);
    const requestBody = buildRequestBody(op);
    const security = buildSecurity(op);

    pathItem[op.method] = {
      tags: op.tags,
      summary: op.summary,
      description: [
        op.description,
        op.roles ? `Roles: ${op.roles}` : null,
        op.multipart ? 'Content-Type: multipart/form-data' : null,
      ]
        .filter(Boolean)
        .join('\n\n'),
      ...(security ? { security } : {}),
      ...(parameters.length ? { parameters } : {}),
      ...(requestBody ? { requestBody } : {}),
      responses: {
        '200': {
          description: 'Success envelope',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiEnvelope' },
            },
          },
        },
        '400': { description: 'Validation or bad request' },
        '401': { description: 'Unauthorized' },
        '403': { description: 'Forbidden' },
        '404': { description: 'Not found' },
      },
    };
  }

  const tagNames = [
    'Auth',
    'OTP',
    'Users',
    'Categories',
    'Brands',
    'Products',
    'Cart',
    'Wishlist',
    'Orders',
    'Payments',
    'Stripe',
    'Deals',
    'Banners',
    'Promo Codes',
    'Prep Services',
    'Reviews',
    'Contents',
    'FAQ',
    'Notifications',
    'Dashboard',
    'Contact',
    'Address',
  ];

  return {
    openapi: '3.0.3',
    info: {
      title: 'MR International LLC Ecommerce API',
      version: '1.0.0',
      description: [
        'Express 5 + Prisma 6 (MongoDB) backend.',
        '',
        '## Conventions',
        '- Base path: `/api/v1`',
        '- Success response: `{ success, message, data, meta? }`',
        '- Auth: `Authorization: Bearer <accessToken>`',
        '- Roles: `supper_admin`, `admin`, `retail`, `wholesale`',
        '- Upload routes accept multipart form fields + files',
        '',
        '## Module coverage',
        ...tagNames.map(tag => `- **${tag}**`),
        '',
        `Total documented operations: **${ops.length}**`,
      ].join('\n'),
    },
    servers: [
      ...(publicOrigin
        ? [{ url: `${publicOrigin}/api/v1`, description: 'Public API server' }]
        : []),
      { url: '/api/v1', description: 'Current host (relative)' },
      { url: 'http://127.0.0.1:5000/api/v1', description: 'Local / port-forward' },
      { url: 'http://127.0.0.1:4000/api/v1', description: 'Local pnpm dev' },
    ],
    tags: tagNames.map(name => ({ name })),
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        ApiEnvelope: envelope,
        ObjectId: objectId,
      },
    },
    paths,
  };
}

export const documentedOperationCount = ops.length;
