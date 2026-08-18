import nodemailer from 'nodemailer';
import { env } from '../config/env';
import logger from '../utils/logger';

let cachedTransporter: nodemailer.Transporter | null = null;

const getTransporter = async (): Promise<nodemailer.Transporter> => {
  if (cachedTransporter) return cachedTransporter;

  // If explicit SMTP configured, use it
  if (env.smtpHost && env.smtpUser && env.smtpPass) {
    cachedTransporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpPort === 465,
      auth: {
        user: env.smtpUser,
        pass: env.smtpPass,
      },
    });
    return cachedTransporter;
  }

  // For staging, prefer Ethereal test account if no SMTP provided
  if (env.nodeEnv === 'staging') {
    try {
      const testAccount = await nodemailer.createTestAccount();
      cachedTransporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      logger.info('Using Ethereal test account for staging emails. Preview URLs will be logged.');
      return cachedTransporter;
    } catch (err) {
      logger.error('Failed to create Ethereal account for staging emails', err);
    }
  }

  // Fallback: create a direct transport (may fail in production)
  cachedTransporter = nodemailer.createTransport({
    host: env.smtpHost || 'localhost',
    port: env.smtpPort || 25,
    secure: false,
  });
  return cachedTransporter;
};

export class EmailService {
  static async sendEmail(to: string, subject: string, html: string): Promise<void> {
    try {
      const transporter = await getTransporter();
      const info = await transporter.sendMail({
        from: `${env.fromName} <${env.fromEmail}>`,
        to,
        subject,
        html,
      });

      // If using Ethereal, log preview URL
      // @ts-ignore - nodemailer types do not include getTestMessageUrl in typings
      const previewUrl = nodemailer.getTestMessageUrl(info as any);
      if (previewUrl) {
        logger.info(`Ethereal preview URL: ${previewUrl}`);
      }
    } catch (error) {
      logger.error('Email sending failed:', error);
      throw new Error('Failed to send email');
    }
  }

  static async sendWelcomeEmail(email: string, name: string): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #4F46E5;">Welcome to UniPulse!</h1>
        <p>Hi ${name},</p>
        <p>Welcome to UniPulse - The Heartbeat of Campus Life. We're excited to have you join our community.</p>
        <p>Start exploring your campus feed, join communities, and connect with fellow students.</p>
        <p>Best regards,<br>The UniPulse Team</p>
      </div>
    `;
    await this.sendEmail(email, 'Welcome to UniPulse!', html);
  }

  static async sendVerificationApproved(email: string, name: string): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #10B981;">Verification Approved!</h1>
        <p>Hi ${name},</p>
        <p>Great news! Your student verification has been approved. You now have access to all verified student features.</p>
        <p>Best regards,<br>The UniPulse Team</p>
      </div>
    `;
    await this.sendEmail(email, 'Your Verification Has Been Approved', html);
  }

  static async sendAnonymousPostStatus(email: string, status: 'approved' | 'rejected', postContent: string): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: ${status === 'approved' ? '#10B981' : '#EF4444'};">
          Anonymous Post ${status === 'approved' ? 'Approved' : 'Rejected'}
        </h1>
        <p>Your anonymous post has been ${status} by the admin team.</p>
        <blockquote style="border-left: 4px solid #E5E7EB; padding-left: 16px; color: #6B7280;">
          ${postContent.substring(0, 200)}${postContent.length > 200 ? '...' : ''}
        </blockquote>
        <p>Best regards,<br>The UniPulse Team</p>
      </div>
    `;
    await this.sendEmail(email, `Anonymous Post ${status === 'approved' ? 'Approved' : 'Rejected'}`, html);
  }
}
