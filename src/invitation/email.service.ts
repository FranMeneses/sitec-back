import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT'),
      secure: this.configService.get<boolean>('SMTP_SECURE'),
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  async sendInvitationEmail(
    email: string,
    inviterName: string,
    projectName: string,
    invitationToken: string,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const invitationLink = `${frontendUrl}/auth/invitation?token=${invitationToken}`;

    const mailOptions = {
      from: this.configService.get<string>('SMTP_FROM') || 'noreply@sitec.ucn.cl',
      to: email,
      subject: `Invitación a proyecto: ${projectName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Invitación a Proyecto</h2>
          <p>Hola,</p>
          <p><strong>${inviterName}</strong> te ha invitado a participar en el proyecto <strong>"${projectName}"</strong>.</p>
          <p>Para aceptar la invitación y crear tu cuenta, haz clic en el siguiente enlace:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${invitationLink}" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Aceptar Invitación
            </a>
          </div>
          <p><strong>Nota:</strong> Este enlace expirará en 7 días. Si no tienes una cuenta, se creará automáticamente al hacer clic en el enlace.</p>
          <p>Si no solicitaste esta invitación, puedes ignorar este correo.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">
            Este es un correo automático del sistema SITEC. Por favor, no respondas a este correo.
          </p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Invitación enviada a ${email}`);
    } catch (error) {
      console.error('Error enviando email de invitación:', error);
      throw new Error('Error enviando invitación por email');
    }
  }

  async sendInvitationAcceptedEmail(
    email: string,
    accepterName: string,
    projectName: string,
  ): Promise<void> {
    const mailOptions = {
      from: this.configService.get<string>('SMTP_FROM') || 'noreply@sitec.ucn.cl',
      to: email,
      subject: `Invitación aceptada: ${projectName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #28a745;">Invitación Aceptada</h2>
          <p>Hola,</p>
          <p><strong>${accepterName}</strong> ha aceptado tu invitación al proyecto <strong>"${projectName}"</strong>.</p>
          <p>El usuario ya tiene acceso al proyecto y puede comenzar a trabajar en él.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">
            Este es un correo automático del sistema SITEC.
          </p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Notificación de aceptación enviada a ${email}`);
    } catch (error) {
      console.error('Error enviando notificación de aceptación:', error);
      // No lanzamos error aquí porque es solo una notificación
    }
  }
}
