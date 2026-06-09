import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { prisma } from '../../../infra/database/prisma/client';

export class LoginService {
  async execute(input: { email: string; password: string; rememberMe?: boolean }): Promise<{ token: string }> {
    console.log('[login] attempting login with email:', input.email);

    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      console.log('[login] user not found:', input.email);
      throw new Error('Invalid credentials');
    }

    console.log('[login] user found, comparing password');
    const ok = await bcrypt.compare(input.password, user.password);
    console.log('[login] password comparison result:', ok);
    if (!ok) throw new Error('Invalid credentials');

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is required');

    const expiresInEnv = process.env.JWT_EXPIRES_IN?.trim();
    const defaultExpiry = input.rememberMe ? '3d' : '1d';
    const options: SignOptions = {
      subject: user.id,
      expiresIn: (expiresInEnv ?? defaultExpiry) as SignOptions['expiresIn']
    };

    const token = jwt.sign({ email: user.email }, secret, options);

    return { token };
  }
}
