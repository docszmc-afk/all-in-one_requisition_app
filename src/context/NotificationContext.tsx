import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppNotification } from '../types';
import { useAuth, MOCK_USERS } from './AuthContext';
import { supabase } from '../lib/supabase';
import { sendEmailNotification } from '../lib/emailjs';

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (notification: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  requestPermission: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const prevNotificationsRef = useRef<AppNotification[]>([]);

  useEffect(() => {
    const fetchNotifications = async () => {
      const { data } = await supabase.from('notifications').select('*');
      if (data) setNotifications(data);
    };
    fetchNotifications();

    const channel = supabase.channel('public:notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, payload => {
        fetchNotifications();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const requestPermission = async () => {
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      try {
        await Notification.requestPermission();
      } catch (error) {
        console.error('Failed to request notification permission:', error);
      }
    }
  };

  useEffect(() => {
    if (user) {
      requestPermission();
    }
  }, [user]);

  useEffect(() => {
    // Only trigger notifications if we have already loaded previous notifications
    // to avoid spamming on initial load
    if (prevNotificationsRef.current.length > 0 && notifications.length > prevNotificationsRef.current.length) {
      const newNotifs = notifications.filter(
        n => !prevNotificationsRef.current.find(pn => pn.id === n.id)
      );
      
      newNotifs.forEach(n => {
        const isForUser = n && (!n.userId || n.userId === user?.id || n.userId === user?.email || n.userId === user?.department);
        
        if (isForUser && !n.read && 'Notification' in window && Notification.permission === 'granted') {
          try {
            const notification = new Notification(n.title, {
              body: n.message,
              icon: '/vite.svg', // Fallback icon
            });
            
            notification.onclick = () => {
              window.focus();
              notification.close();
            };
          } catch (error) {
            console.error('Failed to show notification:', error);
          }
        }
      });
    }
    
    prevNotificationsRef.current = notifications;
  }, [notifications, user]);

  const userNotifications = notifications
    .filter(n => n && (n.userId === user?.id || n.userId === user?.email || n.userId === user?.department))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
  const unreadCount = userNotifications.filter(n => !n.read).length;

  const addNotification = async (notification: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => {
    const newNotification: AppNotification = {
      ...notification,
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
      read: false,
    };
    setNotifications(prev => [...prev, newNotification]);
    await supabase.from('notifications').insert(newNotification);

    // Send email notification
    const targetUserId = notification.userId;
    let targetEmails: string[] = [];
    
    // Check if targetUserId is an email
    if (targetUserId.includes('@')) {
      targetEmails.push(targetUserId);
    } else {
      // Check if it's a user ID or department
      const matchedUsers = MOCK_USERS.filter(u => u.id === targetUserId || u.department === targetUserId);
      targetEmails = matchedUsers.map(u => u.email);
    }

    // Deduplicate emails
    targetEmails = [...new Set(targetEmails)];

    // Send to all matched emails
    targetEmails.forEach(async (email) => {
      const link = notification.link 
        ? `${window.location.origin}${notification.link}`
        : `${window.location.origin}/login`;
        
      const result = await sendEmailNotification(
        email,
        email.split('@')[0], // Simple name extraction
        notification.title,
        notification.message,
        link
      );

      if (!result.success) {
        // Show an in-app error so the user knows EmailJS failed
        const errorNotification: AppNotification = {
          id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9),
          userId: user?.id || 'system',
          title: 'Email Delivery Failed',
          message: `Could not send email to ${email}. Error: ${result.error}`,
          type: 'error',
          createdAt: new Date().toISOString(),
          read: false,
        };
        setNotifications(prev => [...prev, errorNotification]);
        await supabase.from('notifications').insert(errorNotification);
      }
    });
  };

  const markAsRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    await supabase.from('notifications').update({ read: true }).eq('id', id);
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => (n.userId === user?.id || n.userId === user?.email || n.userId === user?.department) ? { ...n, read: true } : n));
    if (user) {
      await supabase.from('notifications').update({ read: true }).in('userId', [user.id, user.email, user.department]);
    }
  };

  return (
    <NotificationContext.Provider value={{ notifications: userNotifications, unreadCount, addNotification, markAsRead, markAllAsRead, requestPermission }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
