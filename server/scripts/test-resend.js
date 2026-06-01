const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from server/.env
dotenv.config({ path: path.join(__dirname, '../.env') });

const resendApiKey = (process.env.RESEND_API_KEY || '').replace(/['"]/g, '').trim();

console.log('Testing Resend Connection with API Key prefix:', resendApiKey.substring(0, 10) + '...');

if (!resendApiKey) {
  console.error('Error: Missing RESEND_API_KEY in .env');
  process.exit(1);
}

async function main() {
  try {
    console.log('Attempting to send test email via Resend...');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Libro de Reclamaciones <onboarding@resend.dev>',
        to: ['martin.grillo@gmail.com'],
        subject: 'Test Email from Resend Diagnostic Script',
        html: '<strong>Resend is working beautifully!</strong> This confirms the integration is 100% correct.'
      })
    });

    const data = await response.json();
    console.log('Resend Response Status:', response.status);
    console.log('Resend Response Data:', data);

    if (response.ok) {
      console.log('Email sent successfully via Resend!');
    } else {
      console.error('Failed to send email via Resend. Check the error message above.');
    }
  } catch (error) {
    console.error('Resend Diagnostic Exception:');
    console.error(error);
  }
}

main();
