import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { HttpError } from './httpError.js';

/** @param {{to: string, subject: string, text: string}} message @returns {Promise<void>} */
export const sendEmail = async ({ to, subject, text }) => {
  if (!env.SMTP_HOST) {
    if (env.NODE_ENV === 'production')
      throw new HttpError(503, 'Email delivery is not configured');
    console.info(`Development email to ${to}: ${subject}\n${text}`);
    return;
  }

  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    ...(env.SMTP_USER && env.SMTP_PASSWORD
      ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } }
      : {}),
  });
  await transport.sendMail({ from: env.SMTP_FROM, to, subject, text });
};
