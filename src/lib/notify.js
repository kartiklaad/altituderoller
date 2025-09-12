import axios from 'axios';

// Simple notification service for sending payment links
export async function sendPaymentLink({ method, to, link, name, hold_id }) {
  console.log(`[NOTIFY] Sending ${method} link to ${to} (Hold: ${hold_id || 'N/A'})`);
  
  // Live implementation - integrate with Twilio, SendGrid, etc.
  try {
    if (method === 'sms') {
      // TODO: Integrate with Twilio SMS
      // const twilioClient = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      // const message = await twilioClient.messages.create({
      //   body: `Hi ${name || 'there'}! Your payment link: ${link}`,
      //   from: process.env.TWILIO_PHONE_NUMBER,
      //   to: to
      // });
      // return { sent: true, method, to, message_id: message.sid };
      
      throw new Error('SMS notifications not yet implemented - integrate with Twilio');
    } else if (method === 'email') {
      // TODO: Integrate with SendGrid email
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
      
      throw new Error('Email notifications not yet implemented - integrate with SendGrid');
    }
    
    throw new Error(`Unsupported notification method: ${method}`);
  } catch (error) {
    console.error('Notification service error:', error);
    throw new Error(`Failed to send ${method}: ${error.message}`);
  }
}
