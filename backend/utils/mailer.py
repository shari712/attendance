import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

def send_password_reset_email(to_email: str, reset_link: str) -> tuple[bool, Optional[str]]:
    """
    Sends an official password reset email directly via SMTP (e.g. Gmail, Resend, Brevo).
    Returns (success, message_or_error).
    """
    smtp_host = os.getenv("SMTP_HOST", "").strip()
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_pass = os.getenv("SMTP_PASSWORD", "").strip()
    smtp_from = os.getenv("SMTP_FROM", "").strip() or smtp_user

    if not smtp_host or not smtp_user or not smtp_pass:
        return False, "SMTP credentials not configured in backend/.env (SMTP_HOST, SMTP_USER, SMTP_PASSWORD required)."

    subject = "Reset Your Smart Attendance System Password"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b; }}
        .card {{ max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1); }}
        .header {{ background-color: #2563eb; color: #ffffff; padding: 28px 24px; text-align: center; }}
        .header h1 {{ margin: 0; font-size: 24px; font-weight: 700; }}
        .header p {{ margin: 6px 0 0 0; color: #bfdbfe; font-size: 14px; }}
        .body {{ padding: 32px 24px; }}
        .btn {{ display: inline-block; background-color: #2563eb; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 600; font-size: 15px; margin: 20px 0; }}
        .footer {{ font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 24px; }}
        .link-box {{ background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; font-size: 12px; word-break: break-all; color: #334155; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1>Smart Attendance System</h1>
          <p>Password Reset Request</p>
        </div>
        <div class="body">
          <p>Hello,</p>
          <p>We received a request to reset the password for your account (<strong>{to_email}</strong>).</p>
          <p>Click the button below to choose a new password:</p>
          <div style="text-align: center;">
            <a href="{reset_link}" class="btn">Reset Password</a>
          </div>
          <p style="font-size: 13px; color: #64748b;">If the button above does not work, copy and paste the following URL into your web browser:</p>
          <div class="link-box">{reset_link}</div>
          <div class="footer">
            <p>This password reset link is valid for 1 hour. If you did not request a password reset, you can safely ignore this email.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
    """

    plain_content = f"""Reset Your Smart Attendance System Password

Hello,

We received a request to reset the password for your account ({to_email}).

Please visit the following link to set your new password:
{reset_link}

This link is valid for 1 hour. If you did not request this, please ignore this email.
"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Smart Attendance System <{smtp_from}>"
    msg["To"] = to_email

    msg.attach(MIMEText(plain_content, "plain"))
    msg.attach(MIMEText(html_content, "html"))

    try:
        if smtp_port == 465:
            server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=15)
        else:
            server = smtplib.SMTP(smtp_host, smtp_port, timeout=15)
            server.starttls()

        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_from, [to_email], msg.as_string())
        server.quit()
        return True, "Email dispatched successfully via direct SMTP."
    except Exception as e:
        error_msg = str(e)
        print(f"[SMTP Error] Failed to send email to {to_email}: {error_msg}")
        return False, error_msg
