import bcrypt from 'bcrypt';
import jwt, { type Secret, type JwtPayload } from 'jsonwebtoken';

export const isPasswordMatched = async (
  plainTextPassword: string,
  hashedPassword: string,
) => {
  return await bcrypt.compare(plainTextPassword, hashedPassword);
};

export const createToken = (
  jwtPayload: JwtPayload,
  secret: Secret,
  expiresIn: string,
): string => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  //@ts-ignore
  return jwt.sign(jwtPayload, secret, { expiresIn });
};

export const verifyToken = (token: string, secret: string) => {
  return jwt.verify(token, secret) as JwtPayload;
};

export const sanitizeUser = <T extends { password?: string | null }>(
  user: T,
) => {
  const { password: _password, ...safeUser } = user;
  void _password;
  return safeUser;
};
