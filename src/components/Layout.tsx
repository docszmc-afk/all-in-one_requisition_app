import React, { useState, useRef, useEffect } from 'react';
import { Outlet, Navigate, useLocation, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import Sidebar from './Sidebar';
import { Menu, Bell, User as UserIcon, Check, CheckCircle, Clock, XCircle, AlertCircle, Info } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function Layout() {
  const { user } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [notifRef]);

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case 'warning': return <AlertCircle className="w-5 h-5 text-amber-500" />;
      case 'error': return <XCircle className="w-5 h-5 text-red-500" />;
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <div className="flex h-screen bg-stone-50 overflow-hidden font-sans text-stone-900">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black/50 lg:hidden" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-30 w-64 bg-zinc-950 text-stone-300 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="bg-white shadow-sm z-10 relative">
          <div className="flex items-center justify-between px-4 py-3 lg:px-8">
            <div className="flex items-center">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 mr-3 -ml-2 text-stone-500 hover:text-stone-700 focus:outline-none lg:hidden"
              >
                <Menu className="w-6 h-6" />
              </button>
              <h1 className="text-xl font-semibold text-stone-800 hidden sm:block">
                Zankli Medical Centre
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative" ref={notifRef}>
                <button 
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="p-2 text-stone-400 hover:text-orange-600 transition-colors relative"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-600 rounded-full"></span>
                  )}
                </button>

                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-lg border border-stone-200 overflow-hidden z-50">
                    <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50">
                      <h3 className="font-semibold text-stone-900">Notifications</h3>
                      {unreadCount > 0 && (
                        <button 
                          onClick={markAllAsRead}
                          className="text-xs font-medium text-orange-600 hover:text-orange-700"
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-sm text-stone-500">
                          No notifications yet.
                        </div>
                      ) : (
                        <div className="divide-y divide-stone-100">
                          {notifications.map((notification) => (
                            <div 
                              key={notification.id} 
                              className={`p-4 flex gap-3 hover:bg-stone-50 transition-colors ${!notification.read ? 'bg-orange-50/30' : ''} ${notification.link ? 'cursor-pointer' : ''}`}
                              onClick={() => {
                                markAsRead(notification.id);
                                if (notification.link) {
                                  navigate(notification.link);
                                  setNotificationsOpen(false);
                                }
                              }}
                            >
                              <div className="flex-shrink-0 mt-0.5">
                                {getNotificationIcon(notification.type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm ${!notification.read ? 'font-medium text-stone-900' : 'text-stone-700'}`}>
                                  {notification.message}
                                </p>
                                <p className="text-xs text-stone-500 mt-1">
                                  {(() => {
                                    try {
                                      return formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true });
                                    } catch (e) {
                                      return 'Just now';
                                    }
                                  })()}
                                </p>
                              </div>
                              {!notification.read && (
                                <div className="flex-shrink-0 flex items-center">
                                  <div className="w-2 h-2 bg-orange-600 rounded-full"></div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-700">
                  <UserIcon className="w-4 h-4" />
                </div>
                <div className="hidden md:block text-sm">
                  <p className="font-medium text-stone-700">{user.department}</p>
                  <p className="text-xs text-stone-500">{user.role}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Urgent Banner */}
        {notifications.some(n => !n.read && n.title === 'Urgent Request') && (
          <div className="bg-red-600 text-white px-4 py-3 shadow-md relative z-20 flex items-center justify-between animate-pulse">
            <div className="flex items-center mx-auto cursor-pointer" onClick={() => {
              const urgentNotif = notifications.find(n => !n.read && n.title === 'Urgent Request');
              if (urgentNotif && urgentNotif.link) {
                navigate(urgentNotif.link);
                markAsRead(urgentNotif.id);
              }
            }}>
              <AlertCircle className="w-6 h-6 mr-3 flex-shrink-0" />
              <span className="font-bold text-lg">You have an urgent request to sign. Click here to view.</span>
            </div>
            <button 
              onClick={() => {
                const urgentNotif = notifications.find(n => !n.read && n.title === 'Urgent Request');
                if (urgentNotif) markAsRead(urgentNotif.id);
              }}
              className="p-1 hover:bg-red-700 rounded-full transition-colors"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Main scrollable area */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-5xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
