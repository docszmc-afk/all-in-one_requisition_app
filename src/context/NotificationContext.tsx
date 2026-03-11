import React, { createContext, useContext, useEffect, useRef } from 'react';
import { AppNotification } from '../types';
import { useAuth } from './AuthContext';
import { useSupabaseSync } from '../hooks/useSupabaseSync';

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
  const [notifications, setNotifications, isLoaded, forceSaveNotifications] = useSupabaseSync<AppNotification[]>('notifications', []);
  const prevNotificationsRef = useRef<AppNotification[]>([]);

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
    if (isLoaded && prevNotificationsRef.current.length > 0 && notifications.length > prevNotificationsRef.current.length) {
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
    
    if (isLoaded) {
      prevNotificationsRef.current = notifications;
    }
  }, [notifications, user, isLoaded]);

  const userNotifications = notifications
    .filter(n => n && (n.userId === user?.id || n.userId === user?.email || n.userId === user?.department))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
  const unreadCount = userNotifications.filter(n => !n.read).length;

  const addNotification = React.useCallback((notification: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => {
    const newNotification: AppNotification = {
      ...notification,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
      read: false,
    };
    setNotifications(prev => {
      const newNotifs = [...prev, newNotification];
      if (forceSaveNotifications) forceSaveNotifications(newNotifs);
      return newNotifs;
    });
  }, [setNotifications, forceSaveNotifications]);

  const markAsRead = React.useCallback((id: string) => {
    setNotifications(prev => {
      const newNotifs = prev.map(n => n.id === id ? { ...n, read: true } : n);
      if (forceSaveNotifications) forceSaveNotifications(newNotifs);
      return newNotifs;
    });
  }, [setNotifications, forceSaveNotifications]);

  const markAllAsRead = React.useCallback(() => {
    setNotifications(prev => {
      const newNotifs = prev.map(n => (n.userId === user?.id || n.userId === user?.email || n.userId === user?.department) ? { ...n, read: true } : n);
      if (forceSaveNotifications) forceSaveNotifications(newNotifs);
      return newNotifs;
    });
  }, [setNotifications, user, forceSaveNotifications]);

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
