import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html: string;
}

// Create reusable transporter object using Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

/**
 * Send an email using Gmail SMTP
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
      console.error('GMAIL_USER or GMAIL_PASS is not set in environment variables');
      return false;
    }

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: options.to,
      subject: options.subject,
      text: options.text || '',
      html: options.html,
    };

    console.log(`Attempting to send email to: ${options.to}`);
    console.log(`From: ${mailOptions.from}`);
    console.log(`Subject: ${options.subject}`);
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`Email sent successfully to ${options.to}`);
      console.log('Nodemailer Response:', info.response);
      return true;
    } catch (sendError: any) {
      console.error('Nodemailer sendMail Error:', sendError);
      if (sendError && sendError.response) {
        console.error('SMTP Response:', sendError.response);
      }
      return false;
    }
  } catch (error: any) {
    console.error('Nodemailer Error Details:', error);
    return false;
  }
}

/**
 * Generate a random verification code
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send a verification code email
 */
export async function sendVerificationEmail(email: string, code: string): Promise<boolean> {
  console.log(`Sending verification email to: ${email} with code: ${code}`);

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Verify Your Email</title>
    <style>
      body { background: #f7f7f7; margin: 0; padding: 0; }
      .container { max-width: 480px; margin: 40px auto; background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); overflow: hidden; font-family: 'Segoe UI', Arial, sans-serif; }
      .header { background: linear-gradient(90deg, #ff69b4 0%, #ffb347 100%); padding: 32px 0 16px 0; text-align: center; }
      .header img { max-width: 80px; margin-bottom: 8px; }
      .header h1 { color: #fff; margin: 0; font-size: 2.2rem; letter-spacing: 2px; }
      .content { padding: 32px 24px 24px 24px; text-align: center; }
      .content h2 { color: #ff69b4; margin-bottom: 8px; font-size: 1.5rem; }
      .content p { color: #555; margin: 12px 0; }
      .code-box { background: #f8d7da; color: #721c24; font-size: 2rem; font-weight: bold; letter-spacing: 8px; border-radius: 8px; padding: 18px 0; margin: 24px 0 12px 0; box-shadow: 0 2px 8px rgba(255,105,180,0.08); }
      .footer { background: #f1f1f1; color: #888; text-align: center; padding: 18px 0; font-size: 13px; border-top: 1px solid #eee; }
      @media (max-width: 600px) { .container { margin: 0; border-radius: 0; } .content { padding: 18px 8px; } }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <img src="https://images.unsplash.com/photo-1559620192-032c4bc4674e?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=1000" alt="Sweet Treats Logo" />
        <h1>Sweet Treats</h1>
      </div>
      <div class="content">
        <h2>Verify Your Email</h2>
        <p>Thank you for signing up! Please copy the code below and paste it in the app to verify your account:</p>
        <div class="code-box" id="code-box">${code}</div>
        <p style="color: #888; font-size: 0.95rem; margin-top: 10px;">Copy the code above and paste it in the app to verify your email.</p>
        <p style="color: #666; margin-top: 32px;">This code will expire in 30 minutes. If you didn't request this, just ignore this email.</p>
        <p style="color: #666; margin-top: 32px;">Happy Shopping!<br/><span style="color: #ff69b4; font-weight: bold;">The Sweet Treats Team</span></p>
      </div>
      <div class="footer">
        © 2025 Sweet Treats Inc. · <a href="mailto:support@sweettreats.com" style="color: #888;">support@sweettreats.com</a>
      </div>
    </div>
  </body>
  </html>
  `;

  const text = `
Sweet Treats - Verify Your Email

Thank you for registering with Sweet Treats! 
Please use the verification code below to complete your registration:

Verification Code: ${code}

This code will expire in 30 minutes. If you didn't request this verification, please ignore this email.

Happy Shopping!
Sweet Treats Team
`;

  const result = await sendEmail({
    to: email,
    subject: 'Sweet Treats - Verify Your Email',
    text,
    html,
  });

  if (result) {
    console.log(`Verification email sent successfully to ${email}`);
  } else {
    console.error(`Failed to send verification email to ${email}`);
  }

  return result;
}

/**
 * Send a password reset email
 */
export async function sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
  console.log(`Sending password reset email to: ${email}`);

  const resetLink = `http://localhost:5000/reset-password?token=${token}`; // Replace with env variable in production

  const html = `
  <!DOCTYPE html>
  <html>
  <body style="margin: 0; padding: 0; background-color: #f7f7f7;">
    <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; background-color: #ffffff; box-shadow: 0 2px 10px rgba(0,0,0,0.05); border-radius: 8px;">
      <div style="background-color: #f8d7da; padding: 20px; text-align: center;">
        <img src="https://yourdomain.com/logo.png" alt="Sweet Treats Logo" style="max-width: 100px;" />
        <h1 style="color: #721c24; margin: 10px 0 0;">Sweet Treats</h1>
      </div>
      <div style="padding: 30px;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p style="color: #666;">You are receiving this email because a password reset request was made for your account.</p>
        <p style="color: #666;">Click the button below to reset your password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="
            background-color: #721c24;
            color: #fff;
            padding: 15px 25px;
            text-decoration: none;
            border-radius: 4px;
            font-weight: bold;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
          ">
            Reset Password
          </a>
        </div>
        <p style="color: #666;">If you did not request a password reset, please ignore this email. This link will expire in 1 hour.</p>
        <p style="color: #666; margin-top: 40px;">Thanks,<br/>The Sweet Treats Team</p>
      </div>
      <div style="background-color: #f1f1f1; text-align: center; padding: 15px; font-size: 12px; color: #888;">
        © 2025 Sweet Treats Inc. · <a href="mailto:support@sweettreats.com" style="color: #888;">support@sweettreats.com</a>
      </div>
    </div>
  </body>
  </html>
  `;

  const text = `
Sweet Treats - Password Reset

You are receiving this email because a password reset request was made for your account.

Please click the following link to reset your password:
${resetLink}

If you did not request a password reset, please ignore this email. This link will expire in 1 hour.

Thanks,
The Sweet Treats Team
`;

  const result = await sendEmail({
    to: email,
    subject: 'Sweet Treats - Password Reset',
    text,
    html,
  });

  if (result) {
    console.log(`Password reset email sent successfully to ${email}`);
  } else {
    console.error(`Failed to send password reset email to ${email}`);
  }

  return result;
}

/**
 * Send a password change confirmation email
 */
export async function sendPasswordChangeConfirmationEmail(email: string): Promise<boolean> {
  console.log(`Sending password change confirmation email to: ${email}`);

  const html = `
  <!DOCTYPE html>
  <html>
  <body style="margin: 0; padding: 0; background-color: #f7f7f7;">
    <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; background-color: #ffffff; box-shadow: 0 2px 10px rgba(0,0,0,0.05); border-radius: 8px;">
      <div style="background-color: #d4edda; padding: 20px; text-align: center;">
        <img src="https://yourdomain.com/logo.png" alt="Sweet Treats Logo" style="max-width: 100px;" />
        <h1 style="color: #155724; margin: 10px 0 0;">Sweet Treats</h1>
      </div>
      <div style="padding: 30px;">
        <h2 style="color: #333;">Your Password Has Been Changed</h2>
        <p style="color: #666;">This is a confirmation that the password for your Sweet Treats account has just been changed.</p>
        <p style="color: #666;">If you did not make this change, please reset your password immediately or contact support.</p>
        <p style="color: #666; margin-top: 40px;">Thanks,<br/>The Sweet Treats Team</p>
      </div>
      <div style="background-color: #f1f1f1; text-align: center; padding: 15px; font-size: 12px; color: #888;">
        © 2025 Sweet Treats Inc. · <a href="mailto:support@sweettreats.com" style="color: #888;">support@sweettreats.com</a>
      </div>
    </div>
  </body>
  </html>
  `;

  const text = `
Sweet Treats - Password Changed

This is a confirmation that the password for your Sweet Treats account has just been changed.

If you did not make this change, please reset your password immediately or contact support.

Thanks,
The Sweet Treats Team
`;

  const result = await sendEmail({
    to: email,
    subject: 'Sweet Treats - Password Changed',
    text,
    html,
  });

  if (result) {
    console.log(`Password change confirmation email sent successfully to ${email}`);
  } else {
    console.error(`Failed to send password change confirmation email to ${email}`);
  }

  return result;
}

export async function sendUsernameEmail(email: string, username: string): Promise<boolean> {
  try {
    const result = await sendEmail({
      to: email,
      subject: 'Your Sweet Treats Username',
      html: `<p>Hello,</p><p>Your username is: <strong>${username}</strong></p><p>If you did not request this, you can ignore this email.</p>`
    });
    if (!result) {
      console.error(`sendUsernameEmail: Failed to send username email to ${email}`);
    } else {
      console.log(`sendUsernameEmail: Username email sent successfully to ${email}`);
    }
    return result;
  } catch (error) {
    console.error('Error sending username email:', error);
    return false;
  }
}

export async function sendOrderNotificationToAdmin(order: any): Promise<boolean> {
  try {
    const itemsHtml = order.items?.map((item: any) => `<li>${item.productName} (x${item.quantity}) - Ksh ${(item.price / 100).toFixed(2)}</li>`).join('') || '';
    await sendEmail({
      to: 'ssweat.treat@gmail.com', // updated admin email
      subject: 'New Customer Order',
      html: `<h2>New Order Received</h2>
        <p><strong>Customer Name:</strong> ${order.customerName || order.name || ''}</p>
        <p><strong>Email:</strong> ${order.email || ''}</p>
        <p><strong>Phone:</strong> ${order.phone || ''}</p>
        <p><strong>Address:</strong> ${order.address || ''}</p>
        <p><strong>Items:</strong></p><ul>${itemsHtml}</ul>
        <p><strong>Total:</strong> Ksh ${(order.total ? (order.total / 100).toFixed(2) : '')}</p>`
    });
    return true;
  } catch (error) {
    console.error('Error sending order notification to admin:', error);
    return false;
  }
}
