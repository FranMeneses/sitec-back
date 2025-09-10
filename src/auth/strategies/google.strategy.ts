import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, StrategyOptions } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET');
    const callbackURL = configService.get<string>('GOOGLE_CALLBACK_URL');

    if (!clientID || !clientSecret || !callbackURL) {
      throw new Error('Google OAuth2 configuration is missing. Please check your environment variables.');
    }

    const options: StrategyOptions = {
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
    };
    super(options);
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    try {
      const { name, emails, photos } = profile;
      
      const user = {
        email: emails[0].value,
        name: name.givenName + ' ' + name.familyName,
        picture: photos[0].value,
        accessToken,
        refreshToken,
      };

      // Validar y crear/obtener usuario usando el AuthService
      const validatedUser = await this.authService.validateGoogleUser(profile);
      
      done(null, validatedUser);
    } catch (error) {
      done(error, false);
    }
  }
}
