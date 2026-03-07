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

    // Build email HTML
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #1e40af 0%, #7c3aed 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">CVPro Zambia</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Your Professional ${productLabel}</p>
    </div>
    
    <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
        <p style="font-size: 18px; margin-top: 0;">Hi ${name},</p>
        
        <p>Thank you for using CVPro Zambia! Your ${productLabel.toLowerCase()} is attached to this email.</p>
        
        <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1e40af;">Quick Tips for Success:</h3>
            <ul style="padding-left: 20px; margin-bottom: 0;">
                <li>Save a copy to your phone and computer</li>
                <li>Update your CV regularly as you gain new skills</li>
                <li>Tailor your CV for each job application</li>
                <li>Keep the file name professional (e.g., FirstName_LastName_CV.pdf)</li>
            </ul>
        </div>
        
        <p>Need to make changes? Visit <a href="https://cvprozambia.com" style="color: #1e40af; text-decoration: none; font-weight: bold;">cvprozambia.com</a> to update your CV anytime.</p>
        
        <p style="margin-bottom: 0;">Best of luck with your job search!</p>
        <p style="margin-top: 5px;"><strong>The CVPro Zambia Team</strong></p>
    </div>
    
    <div style="background: #1e293b; padding: 20px; border-radius: 0 0 10px 10px; text-align: center;">
        <p style="color: #94a3b8; margin: 0; font-size: 12px;">
            &copy; ${new Date().getFullYear()} CVPro Zambia. All rights reserved.
        </p>
        <p style="color: #64748b; margin: 10px 0 0 0; font-size: 11px;">
            This email was sent because you downloaded a ${productLabel.toLowerCase()} from our platform.
        </p>
    </div>
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
