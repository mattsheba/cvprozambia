/**
 * send-cv-email.js
 * Sends CV PDF as email attachment using Resend
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'CVPro Zambia <cv@cvprozambia.com>';
const EMAIL_ENABLED = process.env.EMAIL_ENABLED !== 'false';

// CORS headers
const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
};

exports.handler = async (event) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, error: 'Method not allowed' })
        };
    }

    // Check if email is enabled
    if (!EMAIL_ENABLED) {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, message: 'Email disabled (testing mode)' })
        };
    }

    // Check for API key
    if (!RESEND_API_KEY) {
        console.error('RESEND_API_KEY not configured');
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: 'Email service not configured' })
        };
    }

    let body;
    try {
        body = JSON.parse(event.body || '{}');
    } catch (e) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ success: false, error: 'Invalid JSON body' })
        };
    }

    const { email, pdfBase64, fileName, customerName, product } = body;

    // Validate required fields
    if (!email || !pdfBase64 || !fileName) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ 
                success: false, 
                error: 'Missing required fields: email, pdfBase64, fileName' 
            })
        };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ success: false, error: 'Invalid email format' })
        };
    }

    // Validate base64 (basic check)
    if (pdfBase64.length < 100) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ success: false, error: 'Invalid PDF data' })
        };
    }

    const name = customerName || 'Valued Customer';
    const productLabel = product === 'bundle' ? 'CV and Cover Letter' : product === 'cover' ? 'Cover Letter' : 'CV';

    // Build email HTML — brand: Navy (#060D1A–#213668) + Gold (#C9A020) + Pearl (#F8F9FC)
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CVPro Zambia</title>
</head>
<body style="margin:0; padding:0; background-color:#E8ECF5; font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#E8ECF5; padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:580px; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(6,13,26,.18);">

        <!-- ── Header ── -->
        <tr>
          <td style="background:linear-gradient(148deg,#060D1A 0%,#0B1629 30%,#0F1E38 65%,#213668 100%); padding:36px 32px 28px; text-align:center; border-bottom:3px solid #C9A020;">
            <p style="margin:0 0 6px; font-size:11px; font-weight:600; letter-spacing:3px; text-transform:uppercase; color:#C9A020;">Professional Documents</p>
            <h1 style="margin:0; font-size:28px; font-weight:700; color:#F8F9FC; font-family:Georgia,'Times New Roman',serif; letter-spacing:.5px;">CVPro Zambia</h1>
            <p style="margin:10px 0 0; font-size:14px; color:#E8C94E; letter-spacing:.3px;">Your ${productLabel} is ready</p>
          </td>
        </tr>

        <!-- ── Body ── -->
        <tr>
          <td style="background:#F8F9FC; padding:32px; border-left:1px solid #D5D9E4; border-right:1px solid #D5D9E4;">
            <p style="margin:0 0 16px; font-size:18px; font-weight:600; color:#1C1C1E;">Hi ${name},</p>
            <p style="margin:0 0 20px; font-size:15px; color:#3A3A3C; line-height:1.65;">
              Thank you for using CVPro Zambia! Your <strong>${productLabel.toLowerCase()}</strong> is attached to this email and ready to use.
            </p>

            <!-- Tips card -->
            <table role="presentation" width="100%" style="background:#F2F4F8; border:1px solid #D5DCE8; border-left:4px solid #C9A020; border-radius:8px; margin:0 0 24px;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 12px; font-size:14px; font-weight:700; color:#0B1629; text-transform:uppercase; letter-spacing:1px;">Quick Tips for Success</p>
                  <ul style="margin:0; padding-left:18px; color:#3A3A3C; font-size:14px; line-height:1.8;">
                    <li>Save a copy to your phone and computer</li>
                    <li>Update your CV regularly as you gain new skills</li>
                    <li>Tailor your CV for each job application</li>
                    <li>Keep the file name professional (e.g., FirstName_LastName_CV.pdf)</li>
                  </ul>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 20px; font-size:15px; color:#3A3A3C; line-height:1.65;">
              Need to make changes? Visit
              <a href="https://cvprozambia.com" style="color:#A68A18; text-decoration:none; font-weight:700; border-bottom:1px solid #C9A020;">cvprozambia.com</a>
              to update your CV anytime.
            </p>

            <p style="margin:0 0 4px; font-size:15px; color:#3A3A3C;">Best of luck with your job search!</p>
            <p style="margin:0; font-size:15px; font-weight:700; color:#0B1629;">The CVPro Zambia Team</p>
          </td>
        </tr>

        <!-- ── Footer ── -->
        <tr>
          <td style="background:#0B1629; padding:20px 32px; text-align:center; border-top:3px solid #C9A020; border-radius:0 0 12px 12px;">
            <p style="margin:0 0 6px; font-size:12px; color:#EDB96E; letter-spacing:.3px;">
              &copy; ${new Date().getFullYear()} CVPro Zambia &mdash; Powered by Glamified Systems
            </p>
            <p style="margin:0; font-size:11px; color:#6B6B6B;">
              This email was sent because you downloaded a ${productLabel.toLowerCase()} from our platform.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
    `.trim();

    // Plain text fallback
    const textContent = `
Hi ${name},

Thank you for using CVPro Zambia! Your ${productLabel.toLowerCase()} is attached to this email.

Quick Tips for Success:
- Save a copy to your phone and computer
- Update your CV regularly as you gain new skills
- Tailor your CV for each job application
- Keep the file name professional

Need to make changes? Visit cvprozambia.com to update your CV anytime.

Best of luck with your job search!
The CVPro Zambia Team

© ${new Date().getFullYear()} CVPro Zambia. All rights reserved.
    `.trim();

    try {
        // Call Resend API
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: FROM_EMAIL,
                to: [email],
                subject: `Your ${productLabel} from CVPro Zambia`,
                html: htmlContent,
                text: textContent,
                attachments: [
                    {
                        filename: fileName,
                        content: pdfBase64
                    }
                ]
            })
        });

        const result = await response.json();

        if (!response.ok) {
            console.error('Resend API error:', result);
            return {
                statusCode: response.status,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: result.message || 'Failed to send email' 
                })
            };
        }

        console.log(`Email sent successfully to ${email}, ID: ${result.id}`);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                message: 'Email sent successfully',
                emailId: result.id 
            })
        };

    } catch (error) {
        console.error('Email send error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                success: false, 
                error: 'Failed to send email. Please try again.' 
            })
        };
    }
};
