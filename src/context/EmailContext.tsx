import React, { createContext, useContext, useState, useEffect } from 'react';
import { EmailMessage, Attachment } from '../types';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';
import { supabase } from '../lib/supabase';

interface EmailContextType {
  emails: EmailMessage[];
  sendEmail: (email: Omit<EmailMessage, 'id' | 'createdAt' | 'readBy' | 'archivedBy' | 'deletedBy'>) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  archiveEmail: (id: string) => Promise<void>;
  deleteEmail: (id: string) => Promise<void>;
  restoreEmail: (id: string) => Promise<void>;
  unreadCount: number;
}

const EmailContext = createContext<EmailContextType | undefined>(undefined);

export function EmailProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [emails, setEmails] = useState<EmailMessage[]>([]);

  useEffect(() => {
    const fetchEmails = async () => {
      const { data } = await supabase.from('emails').select('*');
      if (data) setEmails(data);
    };
    fetchEmails();

    const channel = supabase.channel('public:emails')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emails' }, () => {
        fetchEmails();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const sendEmail = async (emailData: Omit<EmailMessage, 'id' | 'createdAt' | 'readBy' | 'archivedBy' | 'deletedBy'>) => {
    const newEmail: EmailMessage = {
      ...emailData,
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
      readBy: [],
      archivedBy: [],
      deletedBy: [],
    };
    setEmails(prev => [newEmail, ...prev]);
    const { error } = await supabase.from('emails').insert(newEmail);
    if (error) {
      console.error('Supabase Email Insert Error:', error);
    }

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

  const markAsRead = async (id: string) => {
    if (!user) return;
    let updatedEmail: EmailMessage | undefined;
    setEmails(prev => prev.map(email => {
      if (email.id === id && !email.readBy.includes(user.id)) {
        updatedEmail = { ...email, readBy: [...email.readBy, user.id] };
        return updatedEmail;
      }
      return email;
    }));

    if (updatedEmail) {
      await supabase.from('emails').update({ readBy: updatedEmail.readBy }).eq('id', id);
    }
  };

  const archiveEmail = async (id: string) => {
    if (!user) return;
    let updatedEmail: EmailMessage | undefined;
    setEmails(prev => prev.map(email => {
      if (email.id === id && !email.archivedBy.includes(user.id)) {
        updatedEmail = { ...email, archivedBy: [...email.archivedBy, user.id] };
        return updatedEmail;
      }
      return email;
    }));

    if (updatedEmail) {
      await supabase.from('emails').update({ archivedBy: updatedEmail.archivedBy }).eq('id', id);
    }
  };

  const deleteEmail = async (id: string) => {
    if (!user) return;
    let updatedEmail: EmailMessage | undefined;
    setEmails(prev => prev.map(email => {
      if (email.id === id && !email.deletedBy.includes(user.id)) {
        updatedEmail = { ...email, deletedBy: [...email.deletedBy, user.id] };
        return updatedEmail;
      }
      return email;
    }));

    if (updatedEmail) {
      await supabase.from('emails').update({ deletedBy: updatedEmail.deletedBy }).eq('id', id);
    }
  };

  const restoreEmail = async (id: string) => {
    if (!user) return;
    let updatedEmail: EmailMessage | undefined;
    setEmails(prev => prev.map(email => {
      if (email.id === id) {
        updatedEmail = {
          ...email,
          archivedBy: email.archivedBy.filter(uId => uId !== user.id),
          deletedBy: email.deletedBy.filter(uId => uId !== user.id),
        };
        return updatedEmail;
      }
      return email;
    }));

    if (updatedEmail) {
      await supabase.from('emails').update({
        archivedBy: updatedEmail.archivedBy,
        deletedBy: updatedEmail.deletedBy
      }).eq('id', id);
    }
  };

  const unreadCount = user ? emails.filter(e => 
    (e.toIds.includes(user.id) || e.ccIds.includes(user.id) || e.bccIds.includes(user.id)) && 
    !e.readBy.includes(user.id) && 
    !e.deletedBy.includes(user.id) &&
    !e.archivedBy.includes(user.id)
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
