import React from 'react';

// Authentic Social Media Brand Icons
export const InstagramIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="ig-grad" x1="2" y1="21" x2="22" y2="3" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#f09433" />
        <stop offset="25%" stopColor="#e6683c" />
        <stop offset="50%" stopColor="#dc2743" />
        <stop offset="75%" stopColor="#cc2366" />
        <stop offset="100%" stopColor="#bc1888" />
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" fill="url(#ig-grad)" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <circle cx="17.5" cy="6.5" r="1.2" fill="white" />
  </svg>
);

export const FacebookIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="24" height="24" rx="5" fill="#1877F2" />
    <path d="M14.5 12.5H12V20H9V12.5H7.5V9.5H9V7.8C9 6.2 9.9 5 12.2 5H14.5V8H13C12.4 8 12 8.4 12 9V9.5H14.8L14.5 12.5Z" fill="white" />
  </svg>
);

export const WhatsAppIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="24" height="24" rx="5" fill="#25D366" />
    <path d="M18 11.9c0 3.3-2.7 6-6 6-1 0-2-.3-2.9-.8L6 18l.9-3c-.6-.9-.9-2-.9-3.1 0-3.3 2.7-6 6-6s6 2.7 6 6z" fill="white" />
    <path d="M15.2 13.7c-.2-.1-1.1-.5-1.3-.6-.2-.1-.3-.1-.4.1-.1.2-.5.6-.6.8-.1.1-.2.2-.4.1-.2-.1-.8-.3-1.6-1-.6-.5-1-1.2-1.1-1.4-.1-.2 0-.3.1-.4.1-.1.2-.2.3-.4.1-.1.1-.2.2-.3 0-.1 0-.2-.1-.3-.1-.1-.4-1-.6-1.4-.2-.4-.3-.3-.4-.3h-.4c-.1 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2.9 2.4c.1.1 1.6 2.5 3.9 3.5.5.2 1 .4 1.3.5.6.2 1.1.2 1.5.1.5-.1 1.4-.6 1.6-1.1.2-.5.2-1 .1-1.1-.1-.1-.3-.2-.5-.3z" fill="#25D366" />
  </svg>
);

export const TelegramIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="24" height="24" rx="5" fill="#229ED9" />
    <path d="M18.5 6.5L4.8 11.8C3.9 12.2 3.9 12.7 4.6 12.9L8.1 14L16.2 8.9C16.6 8.6 17 8.8 16.7 9.1L10.1 15.1H10.1L9.9 18.2C10.2 18.2 10.4 18.1 10.6 17.9L12.5 16.1L16.4 19C17.1 19.4 17.6 19.2 17.8 18.3L20.3 7.5C20.6 6.3 19.8 5.7 18.5 6.5Z" fill="white" />
  </svg>
);
