import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;
  private readonly fromAddress: string;
  private readonly replyToAddress: string;

  constructor(private config: ConfigService) {
    this.resend = new Resend(this.config.getOrThrow<string>('RESEND_API_KEY'));

    this.fromAddress = this.config.get<string>(
      'EMAIL_FROM',
      'suporte@pianissima.com.br',
    );

    this.replyToAddress = this.config.get<string>(
      'EMAIL_REPLY_TO',
      'pianissimaem@gmail.com',
    );
  }

  async sendPasswordResetEmail(params: {
    to: string;
    name: string;
    code: string;
  }) {
    try {
      await this.resend.emails.send({
        from: `Pianíssima <${this.fromAddress}>`,
        to: params.to,
        replyTo: this.replyToAddress,
        subject: 'Seu código de redefinição de senha — Pianíssima',
        html: this.buildResetEmailHtml(params.name, params.code),
      });
    } catch (error) {
      // Não deixamos o erro de envio derrubar a requisição do usuário
      // — ver AuthService.forgotPassword (resposta sempre genérica).
      this.logger.error('Falha ao enviar e-mail de reset de senha', error);
    }
  }

  // aviso de segurança disparado depois que a senha é
  // efetivamente trocada, pra alertar o usuário caso não tenha sido ele.
  async sendPasswordChangedEmail(params: { to: string; name: string }) {
    try {
      await this.resend.emails.send({
        from: `Pianíssima <${this.fromAddress}>`,
        to: params.to,
        replyTo: this.replyToAddress,
        subject: 'Sua senha foi alterada — Pianíssima',
        html: this.buildPasswordChangedHtml(params.name),
      });
    } catch (error) {
      this.logger.error(
        'Falha ao enviar e-mail de aviso de senha alterada',
        error,
      );
    }
  }

  private buildResetEmailHtml(name: string, code: string): string {
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f1ea; padding: 32px;">
        <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; padding: 32px 24px;">
          <h1 style="font-size: 20px; color: #1a1a1a; margin-bottom: 8px;">Olá, ${name}!</h1>
          <p style="font-size: 14px; color: #374151; line-height: 1.6;">
            Recebemos um pedido para redefinir a senha da sua conta no Pianíssima.
            Digite o código abaixo no app para continuar:
          </p>
          <div style="text-align: center; margin: 28px 0;">
            <span style="background: #b08d57; color: white; letter-spacing: 6px; padding: 16px 24px; border-radius: 12px; font-weight: bold; font-size: 28px; display: inline-block;">
              ${code}
            </span>
          </div>
          <p style="font-size: 13px; color: #9ca3af; line-height: 1.6;">
            Este código expira em 15 minutos. Se você não pediu essa alteração, pode ignorar este e-mail com segurança — sua senha continua a mesma.
          </p>
        </div>
      </div>
    `;
  }

  private buildPasswordChangedHtml(name: string): string {
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f1ea; padding: 32px;">
        <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; padding: 32px 24px;">
          <h1 style="font-size: 20px; color: #1a1a1a; margin-bottom: 8px;">Olá, ${name}!</h1>
          <p style="font-size: 14px; color: #374151; line-height: 1.6;">
            Sua senha do Pianíssima foi alterada com sucesso agora há pouco.
          </p>
          <p style="font-size: 13px; color: #9ca3af; line-height: 1.6;">
            Se não foi você quem fez essa alteração, entre em contato com a escola imediatamente.
          </p>
        </div>
      </div>
    `;
  }
}
