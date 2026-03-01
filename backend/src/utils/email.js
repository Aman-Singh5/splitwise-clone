import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendEmail({ to, subject, html }) {
  if (process.env.NODE_ENV === 'development' && !process.env.SMTP_USER?.includes('@')) {
    console.log(`[EMAIL] To: ${to} | Subject: ${subject}`);
    return;
  }
  try {
    await transporter.sendMail({ from: process.env.SMTP_FROM, to, subject, html });
  } catch (err) {
    console.error('Email send error:', err.message);
  }
}

export function passwordResetEmail(name, resetUrl) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1cc29f;">Reset Your Password</h2>
      <p>Hi ${name},</p>
      <p>You requested a password reset. Click the button below to reset your password:</p>
      <a href="${resetUrl}" style="display:inline-block;background:#1cc29f;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0;">Reset Password</a>
      <p>This link expires in 1 hour.</p>
      <p>If you didn't request this, ignore this email.</p>
    </div>
  `;
}

export function expenseAddedEmail(recipientName, payerName, expenseDesc, amount, currency) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1cc29f;">New Expense Added</h2>
      <p>Hi ${recipientName},</p>
      <p><strong>${payerName}</strong> added a new expense: <strong>${expenseDesc}</strong></p>
      <p>Amount: <strong>${currency} ${amount}</strong></p>
      <p>Log in to see your share and full details.</p>
    </div>
  `;
}

export function settlementEmail(recipientName, payerName, amount, currency) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1cc29f;">Payment Recorded</h2>
      <p>Hi ${recipientName},</p>
      <p><strong>${payerName}</strong> recorded a payment of <strong>${currency} ${amount}</strong> to you.</p>
      <p>Log in to view your updated balances.</p>
    </div>
  `;
}

export function friendInviteEmail(inviterName, inviteeEmail, signupUrl) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1cc29f;">You've been invited to Splitwise!</h2>
      <p>Hi there,</p>
      <p><strong>${inviterName}</strong> wants to split expenses with you on Splitwise Clone.</p>
      <p>Create a free account to start tracking shared expenses easily:</p>
      <a href="${signupUrl}" style="display:inline-block;background:#1cc29f;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0;">Accept Invitation</a>
      <p style="color:#888;font-size:13px;">Once you sign up with this email address (${inviteeEmail}), you'll automatically be connected with ${inviterName}.</p>
    </div>
  `;
}
