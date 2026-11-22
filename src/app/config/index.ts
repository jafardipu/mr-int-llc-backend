import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env') });

const aws = {
  accessKeyId: process.env.S3_BUCKET_ACCESS_KEY,
  secretAccessKey: process.env.S3_BUCKET_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
  bucket: process.env.AWS_BUCKET_NAME,
};

const stripe = {
  stripe_api_key: process.env.STRIPE_API_KEY,
  stripe_api_secret: process.env.STRIPE_API_SECRET,
  webhook_secret: process.env.STRIPE_WEBHOOK_SECRET,
};

const toNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const checkout = {
  // Flat shipping fee in USD added to every order.
  shipping_fee: toNumber(process.env.SHIPPING_FEE, 0),
  // Tax percentage applied to (subtotal - discount), e.g. 8.25.
  tax_rate: toNumber(process.env.TAX_RATE, 0),
  // Unpaid orders older than this are cancelled automatically. 0 disables it.
  unpaid_order_expiry_hours: toNumber(process.env.UNPAID_ORDER_EXPIRY_HOURS, 0),
};

const admin_credentials = {
  email: process.env.ADMIN_MAIL,
};

export default {
  NODE_ENV: process.env.NODE_ENV,
  redis_port: process.env.REDIS_PORT,
  redis_host: process.env.REDIS_HOST,
  port: process.env.PORT,
  ip: process.env.IP,
  database_url: process.env.DATABASE_URL,
  server_url: process.env.SERVER_URL,
  client_Url: process.env.CLIENT_URL,
  admin_Url: process.env.ADMIN_URL,
  bcrypt_salt_rounds: process.env.BCRYPT_SALT_ROUNDS,
  jwt_access_secret: process.env.JWT_ACCESS_SECRET,
  jwt_refresh_secret: process.env.JWT_REFRESH_SECRET,
  jwt_access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN,
  jwt_refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN,
  nodemailer_host_email: process.env.NODEMAILER_HOST_EMAIL,
  nodemailer_host_pass: process.env.NODEMAILER_HOST_PASS,
  socket_port: process.env.SOCKET_PORT,
  aws,
  stripe,
  checkout,
  admin_credentials,
};
