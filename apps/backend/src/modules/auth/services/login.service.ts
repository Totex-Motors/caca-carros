import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { prisma } from '../../../infra/database/prisma/client';

export class LoginService {
  async execute(input: { email: string; password: string }): Promise<{ token: string }> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) throw new Error('Invalid credentials');

    const ok = await bcrypt.compare(input.password, user.password);
    if (!ok) throw new Error('Invalid credentials');

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is required');

    const expiresIn = (process.env.JWT_EXPIRES_IN ?? '8h') as SignOptions['expiresIn'];

    const options: SignOptions = {
      subject: user.id,
      expiresIn
    };

    const token = jwt.sign({ email: user.email }, secret, options);

    return { token };
  }
}
