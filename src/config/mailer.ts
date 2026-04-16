import nodemailer from "nodemailer";

// ---------------------------------------------------------------------------
// Create reusable transporter
// ---------------------------------------------------------------------------

const createTransporter = () => {
  // ── Gmail SMTP (free — use App Password, not your real password) ────
  // To set up:
  //   1. Enable 2-Step Verification on your Google account
  //   2. Go to https://myaccount.google.com/apppasswords
  //   3. Generate an App Password for "Mail"
  //   4. Use that 16-character password as SMTP_PASS in .env

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

// ---------------------------------------------------------------------------
// Send verification email
// ---------------------------------------------------------------------------

export const sendVerificationEmail = async (
  toEmail: string,
  userName: string,
  verificationToken: string
): Promise<void> => {
  const transporter = createTransporter();

  const baseUrl = process.env.CLIENT_URL || `http://localhost:${process.env.PORT || 5000}`;
  const verifyUrl = `${baseUrl}/api/auth/verify-email/${verificationToken}`;

  const mailOptions = {
    from: `"E-Learning Platform" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: "Verify your email — E-Learning Platform",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 20px">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08)">
                <!-- Header -->
                <tr>
                  <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;text-align:center">
                    <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;letter-spacing:-0.5px">
                      📚 E-Learning Platform
                    </h1>
                  </td>
                </tr>
                <!-- Body -->
                <tr>
                  <td style="padding:40px">
                    <h2 style="margin:0 0 16px;font-size:20px;color:#1a1a2e">
                      Welcome, ${userName}! 👋
                    </h2>
                    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4a4a68">
                      Thanks for signing up! Please verify your email address by clicking the button below. This link will expire in <strong>24 hours</strong>.
                    </p>
                    <!-- CTA Button -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding:8px 0 24px">
                          <a href="${verifyUrl}"
                             style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.3px">
                            Verify My Email
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0 0 12px;font-size:13px;color:#8888a4">
                      If the button doesn't work, copy and paste this link into your browser:
                    </p>
                    <p style="margin:0 0 24px;font-size:12px;color:#6366f1;word-break:break-all">
                      ${verifyUrl}
                    </p>
                    <hr style="border:none;border-top:1px solid #eeeef2;margin:24px 0" />
                    <p style="margin:0;font-size:12px;color:#8888a4;text-align:center">
                      If you didn't create an account, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
};
