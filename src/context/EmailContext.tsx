import React, { createContext, useContext } from 'react';
import { EmailMessage, Attachment } from '../types';
import { MOCK_USERS, useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';
import { useSupabaseSync } from '../hooks/useSupabaseSync';

interface EmailContextType {
  emails: EmailMessage[];
  sendEmail: (email: Omit<EmailMessage, 'id' | 'createdAt' | 'readBy' | 'archivedBy' | 'deletedBy'>) => void;
  markAsRead: (id: string) => void;
  archiveEmail: (id: string) => void;
  deleteEmail: (id: string) => void;
  restoreEmail: (id: string) => void;
  unreadCount: number;
}

const EmailContext = createContext<EmailContextType | undefined>(undefined);

export function EmailProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [emails, setEmails, , forceSaveEmails] = useSupabaseSync<EmailMessage[]>('zmc_emails', []);

  const mockUserId = user ? MOCK_USERS.find(m => m.email === user.email)?.id : undefined;

  const sendEmail = (emailData: Omit<EmailMessage, 'id' | 'createdAt' | 'readBy' | 'archivedBy' | 'deletedBy'>) => {
    const newEmail: EmailMessage = {
      ...emailData,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
      readBy: [],
      archivedBy: [],
      deletedBy: [],
    };
    setEmails(prev => {
      const newEmails = [newEmail, ...prev];
      if (forceSaveEmails) forceSaveEmails(newEmails);
      return newEmails;
    });

    // Notify recipients
    const recipients = [...new Set([...emailData.toIds, ...emailData.ccIds, ...emailData.bccIds])];
    recipients.forEach(recipientId => {
      addNotification({
        userId: recipientId,
        title: 'New Email',
        message: `You have a new email from ${user?.email || 'Unknown'}: ${emailData.subject}`,
        type: 'info',
        link: '/email'
      });
    });
  };

  const markAsRead = (id: string) => {
    if (!user) return;
    setEmails(prev => {
      const newEmails = prev.map(email => {
        if (email.id === id && !email.readBy.includes(user.id) && (!mockUserId || !email.readBy.includes(mockUserId))) {
          return { ...email, readBy: [...email.readBy, user.id, ...(mockUserId ? [mockUserId] : [])] };
        }
        return email;
      });
      if (forceSaveEmails) forceSaveEmails(newEmails);
      return newEmails;
    });
  };

  const archiveEmail = (id: string) => {
    if (!user) return;
    setEmails(prev => {
      const newEmails = prev.map(email => {
        if (email.id === id && !email.archivedBy.includes(user.id) && (!mockUserId || !email.archivedBy.includes(mockUserId))) {
          return { ...email, archivedBy: [...email.archivedBy, user.id, ...(mockUserId ? [mockUserId] : [])] };
        }
        return email;
      });
      if (forceSaveEmails) forceSaveEmails(newEmails);
      return newEmails;
    });
  };

  const deleteEmail = (id: string) => {
    if (!user) return;
    setEmails(prev => {
      const newEmails = prev.map(email => {
        if (email.id === id && !email.deletedBy.includes(user.id) && (!mockUserId || !email.deletedBy.includes(mockUserId))) {
          return { ...email, deletedBy: [...email.deletedBy, user.id, ...(mockUserId ? [mockUserId] : [])] };
        }
        return email;
      });
      if (forceSaveEmails) forceSaveEmails(newEmails);
      return newEmails;
    });
  };

  const restoreEmail = (id: string) => {
    if (!user) return;
    setEmails(prev => {
      const newEmails = prev.map(email => {
        if (email.id === id) {
          return {
            ...email,
            archivedBy: email.archivedBy.filter(uId => uId !== user.id && uId !== mockUserId),
            deletedBy: email.deletedBy.filter(uId => uId !== user.id && uId !== mockUserId),
          };
        }
        return email;
      });
      if (forceSaveEmails) forceSaveEmails(newEmails);
      return newEmails;
    });
  };

  const unreadCount = user ? emails.filter(e => 
    (e.toIds.includes(user.id) || (mockUserId && e.toIds.includes(mockUserId)) || e.ccIds.includes(user.id) || (mockUserId && e.ccIds.includes(mockUserId)) || e.bccIds.includes(user.id) || (mockUserId && e.bccIds.includes(mockUserId))) && 
    !e.readBy.includes(user.id) && (!mockUserId || !e.readBy.includes(mockUserId)) && 
    !e.deletedBy.includes(user.id) && (!mockUserId || !e.deletedBy.includes(mockUserId)) &&
    !e.archivedBy.includes(user.id) && (!mockUserId || !e.archivedBy.includes(mockUserId))
  ).length : 0;

  return (
    <EmailContext.Provider value={{ emails, sendEmail, markAsRead, archiveEmail, deleteEmail, restoreEmail, unreadCount }}>
      {children}
    </EmailContext.Provider>
  );
}

export function useEmail() {
  const context = useContext(EmailContext);
  if (context === undefined) {
    throw new Error('useEmail must be used within an EmailProvider');
  }
  return context;
}
