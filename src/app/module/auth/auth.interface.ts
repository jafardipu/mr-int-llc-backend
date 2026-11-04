import type { Role } from '../../../../generated/prisma/index.js';

export type QueryObject = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

export type ILogin = {
  email: string;
  password: string;
  fcmToken?: string;
};

export type IRegister = {
  name: string;
  email: string;
  password: string;
  phoneNumber?: string;
  role: Role;
  fcmToken?: string;
};

export type IChangePassword = {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export type IResetPassword = {
  newPassword: string;
  confirmPassword: string;
};

export interface IJwtPayload {
  userId: string;
  role: string;
}

export interface JwtPayload {
  userId: string;
  role: string;
}
