/// <reference types="vite/client" />
import emailjs from '@emailjs/browser';

// Initialize EmailJS with the public key
// The user needs to set these environment variables in the AI Studio Secrets panel
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || 'eZceh_HMKkBX6oO8_';
const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || 'service_cxnof9l';
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || 'template_pdr5sp9';

export const sendEmailNotification = async (
  toEmail: string,
  toName: string,
  subject: string,
  message: string,
  link: string = window.location.origin
): Promise<{ success: boolean; error?: string }> => {
  if (!PUBLIC_KEY || !SERVICE_ID || !TEMPLATE_ID) {
    console.warn('EmailJS is not configured. Skipping email notification to:', toEmail);
    return { success: false, error: 'EmailJS keys are missing' };
  }

  try {
    const templateParams = {
      to_email: toEmail,
      to_name: toName,
      subject: subject,
      message: message,
      link: link,
      app_name: 'Facility Management System'
    };

    console.log('Sending email with params:', templateParams);

    const response = await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID,
      templateParams,
      PUBLIC_KEY
    );
    
    console.log('Email sent successfully:', response.status, response.text);
    return { success: true };
  } catch (error: any) {
    console.error('Failed to send email notification:', error);
    return { success: false, error: error?.text || error?.message || 'Unknown EmailJS error' };
  }
};
