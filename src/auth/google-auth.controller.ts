import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { AuthService } from './auth/auth.service';
import { GoogleAuthGuard } from './guards/google-auth.guard';

@Controller('auth')
export class GoogleAuthController {
  constructor(private authService: AuthService) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req: Request) {
    // Este endpoint inicia el flujo de Google OAuth
    // Passport maneja automáticamente la redirección a Google
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleAuthRedirect(@Req() req: Request, @Res() res: Response) {
    try {
      // El usuario ya está autenticado por el guard
      const user = req.user;
      
      // Generar JWT token
      const accessToken = await this.authService.generateJwtToken(user);
      
      // Redirigir al frontend con el token
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const redirectUrl = `${frontendUrl}?token=${accessToken}`;
      
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('Error en Google OAuth callback:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}?error=oauth_error`);
    }
  }
}
