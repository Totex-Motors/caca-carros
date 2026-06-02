import type { Request, Response } from 'express';
import { LoginService } from '../services/login.service';

export class LoginController {
  constructor(private readonly loginService = new LoginService()) {}

  async handle(req: Request, res: Response): Promise<Response> {
    const { email, password, rememberMe } = req.body as { email?: unknown; password?: unknown; rememberMe?: unknown };

    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'email and password are required' });
    }

    try {
      const result = await this.loginService.execute({ email, password, rememberMe: rememberMe === true });
      return res.json(result);
    } catch {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
  }
}
