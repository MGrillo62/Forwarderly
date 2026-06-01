const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from server/.env
dotenv.config({ path: path.join(__dirname, '../.env') });

const smtpHost = (process.env.SMTP_HOST || '').replace(/['"]/g, '').trim();
const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT.toString().replace(/['"]/g, '')) : 587;
const smtpUser = (process.env.SMTP_USER || '').replace(/['"]/g, '').trim();
const smtpPass = (process.env.SMTP_PASS || '').replace(/['"]/g, '').trim();

console.log('Testing SMTP Connection with:', {
  smtpHost,
  smtpPort,
  smtpUser,
  smtpPassLength: smtpPass.length
});

if (!smtpHost || !smtpUser || !smtpPass) {
  console.error('Error: Missing SMTP configuration in .env');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: smtpUser,
    pass: smtpPass
  }
});

async function main() {
  try {
    console.log('Verifying SMTP connection...');
    await transporter.verify();
    console.log('SMTP Connection VERIFIED successfully!');

    console.log('Attempting to send test email...');
    const info = await transporter.sendMail({
      from: `"Test Libro de Reclamaciones" <${smtpUser}>`,
      to: 'martin.grillo@gmail.com',
      cc: 'martin.grillo@optimussp.com',
      subject: 'Test Email from SMTP Diagnostic Script',
      text: 'This is a test email to verify your SMTP configuration for Forwarderly.'
    });

    console.log('Email sent successfully!');
    console.log('Message ID:', info.messageId);
    console.log('Response:', info.response);
  } catch (error) {
    console.error('SMTP Diagnostic Failed:');
    console.error(error);
  }
}

main();
