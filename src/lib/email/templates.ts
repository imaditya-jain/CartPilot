export function passwordResetEmailTemplate(resetUrl: string) {
  const text = `We received a request to reset your CartPilot AI password. Reset it here:\n${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, you can safely ignore this email — your password won't be changed.`;
  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color:#1c1c1e;">Reset your password</h2>
      <p style="color:#3a3a3c;">We received a request to reset your CartPilot AI password. Click below to choose a new one.</p>
      <p style="margin: 24px 0;">
        <a href="${resetUrl}" style="background:#141413;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Reset password</a>
      </p>
      <p style="color:#8e8e93;font-size:13px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email — your password won't be changed.</p>
    </div>
  `;
  return { text, html };
}

export function verificationEmailTemplate(verifyUrl: string) {
  const text = `Welcome to CartPilot AI. Verify your email to activate your account:\n${verifyUrl}\n\nThis link expires in 24 hours.`;
  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color:#1c1c1e;">Verify your email</h2>
      <p style="color:#3a3a3c;">Welcome to CartPilot AI. Click below to verify your email and activate your account.</p>
      <p style="margin: 24px 0;">
        <a href="${verifyUrl}" style="background:#3345db;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Verify email</a>
      </p>
      <p style="color:#8e8e93;font-size:13px;">This link expires in 24 hours. If you didn't create this account, you can ignore this email.</p>
    </div>
  `;
  return { text, html };
}
