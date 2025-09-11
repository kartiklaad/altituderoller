import axios from 'axios';

// Simple notification service for sending payment links
export async function sendPaymentLink({ method, to, link, name, hold_id }) {
  // Check if we're in mock mode
  if (process.env.ROLLER_MOCK === '1') {
    // Mock implementation
    const message_id = `msg_${Math.random().toString(36).slice(2, 8)}`;
    return {
      sent: true,
      method,
      to,
      message_id
    };
  }
  
  // Live implementation - you can integrate with Twilio, SendGrid, etc.
  try {
    if (method === 'sms') {
      // Example: Twilio SMS integration
      // const twilioClient = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      // const message = await twilioClient.messages.create({
      //   body: `Hi ${name || 'there'}! Your payment link: ${link}`,
      //   from: process.env.TWILIO_PHONE_NUMBER,
      //   to: to
      // });
      // return { sent: true, method, to, message_id: message.sid };
      
      // For now, return mock response until Twilio is configured
      const message_id = `msg_${Math.random().toString(36).slice(2, 8)}`;
      return {
        sent: true,
        method,
        to,
        message_id
      };
    } else if (method === 'email') {
      // Example: SendGrid email integration
      // const sgMail = require('@sendgrid/mail');
      // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      // const msg = {
      //   to: to,
      //   from: process.env.SENDGRID_FROM_EMAIL,
      //   subject: 'Your Payment Link',
      //   text: `Hi ${name || 'there'}! Your payment link: ${link}`,
      //   html: `<p>Hi ${name || 'there'}!</p><p>Your payment link: <a href="${link}">${link}</a></p>`
      // };
      // await sgMail.send(msg);
      // return { sent: true, method, to, message_id: 'email_sent' };
      
      // For now, return mock response until SendGrid is configured
      const message_id = `msg_${Math.random().toString(36).slice(2, 8)}`;
      return {
        sent: true,
        method,
        to,
        message_id
      };
    }
    
    throw new Error(`Unsupported notification method: ${method}`);
  } catch (error) {
    console.error('Notification service error:', error);
    throw new Error(`Failed to send ${method}: ${error.message}`);
  }
}
