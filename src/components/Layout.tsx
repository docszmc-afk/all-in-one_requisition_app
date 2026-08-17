import React, { useState, useRef, useEffect } from 'react';
import { Outlet, Navigate, useLocation, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useVouchers } from '../context/VoucherContext';
import Sidebar from './Sidebar';
import { Menu, Bell, User as UserIcon, Check, CheckCircle, Clock, XCircle, AlertCircle, Info, LayoutDashboard, List, FilePlus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function Layout() {
  const { user } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const { vouchers } = useVouchers();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const notifRef = useRef<HTMLDivElement>(null);

  const isApprover = user?.email === 'zanklihr@gmail.com' || user?.email === 'docs.zmc@gmail.com' || user?.email === 'mdzankli@gmail.com';
  const isAccounts = user?.department === 'Accounts';
  
  const unattendedApprovalsCount = isApprover ? vouchers.filter(v => v.status === 'pending' && !v.is_queried).length : 0;
  const unattendedAccountsCount = isAccounts ? vouchers.filter(v => v.status === 'approved' && !v.is_queried).length : 0;

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
          className="fixed inset-0 z-50 bg-black/50 lg:hidden" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-zinc-950 text-stone-300 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="bg-white shadow-sm z-10 relative">
          <div className="flex items-center justify-between px-4 py-3 lg:px-8">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-stone-800 tracking-tight">
                Zankli <span className="text-orange-500">Procure</span>
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative" ref={notifRef}>
                <button 
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="p-2 text-stone-400 hover:text-orange-600 transition-colors relative hidden lg:block"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-600 rounded-full"></span>
                  )}
                </button>

                {/* Desktop Dropdown & Mobile Bottom Sheet */}
                {notificationsOpen && (
                  <>
                    {/* Mobile Backdrop */}
                    <div 
                      className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                      onClick={() => setNotificationsOpen(false)}
                    />
                    
                    <div className="fixed inset-x-0 bottom-0 z-50 lg:absolute lg:inset-auto lg:right-0 lg:mt-2 lg:w-96 bg-white rounded-t-2xl lg:rounded-xl shadow-[0_-8px_30px_rgba(0,0,0,0.12)] lg:shadow-lg border-t lg:border border-stone-200 overflow-hidden flex flex-col max-h-[80vh] lg:max-h-96 transform transition-transform duration-300 ease-out">
                      <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50 rounded-t-2xl lg:rounded-t-xl">
                        <h3 className="font-semibold text-stone-900">Notifications</h3>
                        <div className="flex items-center space-x-3">
                          {unreadCount > 0 && (
                            <button 
                              onClick={markAllAsRead}
                              className="text-xs font-medium text-orange-600 hover:text-orange-700"
                            >
                              Mark all as read
                            </button>
                          )}
                          <button onClick={() => setNotificationsOpen(false)} className="lg:hidden p-1 text-stone-400">
                            <XCircle className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                      <div className="overflow-y-auto flex-1">
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
                  </>
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

        {/* Approver Voucher Banner */}
        {unattendedApprovalsCount > 0 && (
          <div className="bg-yellow-500 text-stone-900 px-4 py-3 shadow-md relative z-20 flex items-center justify-between animate-pulse">
            <div className="flex items-center mx-auto cursor-pointer" onClick={() => navigate('/vouchers')}>
              <AlertCircle className="w-6 h-6 mr-3 flex-shrink-0" />
              <span className="font-bold text-lg">You have {unattendedApprovalsCount} unattended payment voucher{unattendedApprovalsCount > 1 ? 's' : ''} pending your approval. Click here to view.</span>
            </div>
            <button 
              onClick={() => navigate('/vouchers')}
              className="p-1 hover:bg-yellow-600 rounded-full transition-colors"
            >
              <CheckCircle className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Accounts Voucher Banner */}
        {unattendedAccountsCount > 0 && (
          <div className="bg-emerald-500 text-white px-4 py-3 shadow-md relative z-20 flex items-center justify-between animate-pulse">
            <div className="flex items-center mx-auto cursor-pointer" onClick={() => navigate('/vouchers')}>
              <AlertCircle className="w-6 h-6 mr-3 flex-shrink-0" />
              <span className="font-bold text-lg">You have {unattendedAccountsCount} approved payment voucher{unattendedAccountsCount > 1 ? 's' : ''} pending processing. Click here to view.</span>
            </div>
            <button 
              onClick={() => navigate('/vouchers')}
              className="p-1 hover:bg-emerald-600 rounded-full transition-colors"
            >
              <CheckCircle className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Main scrollable area */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 pb-20 lg:pb-8">
          <div className="max-w-5xl mx-auto">
            <Outlet />
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 flex items-center justify-around z-40 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <Link to="/" className={`flex flex-col items-center justify-center w-full py-2 ${location.pathname === '/' ? 'text-orange-600' : 'text-stone-500 hover:text-stone-700'}`}>
            <LayoutDashboard className="w-6 h-6 mb-1" />
            <span className="text-[10px] font-medium">Home</span>
          </Link>
          <Link to="/requests" className={`flex flex-col items-center justify-center w-full py-2 ${location.pathname === '/requests' ? 'text-orange-600' : 'text-stone-500 hover:text-stone-700'}`}>
            <List className="w-6 h-6 mb-1" />
            <span className="text-[10px] font-medium">Requests</span>
          </Link>
          {(user?.role === 'Creator' || user?.role === 'Both') && (
            <Link to="/requests/new" className="flex flex-col items-center justify-center w-full py-2 -mt-5">
              <div className="bg-orange-500 text-white p-3 rounded-full shadow-lg hover:bg-orange-600 transition-colors">
                <FilePlus className="w-6 h-6" />
              </div>
            </Link>
          )}
          <button onClick={() => setNotificationsOpen(true)} className="flex flex-col items-center justify-center w-full py-2 text-stone-500 hover:text-stone-700 relative">
            <Bell className="w-6 h-6 mb-1" />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-[25%] w-2 h-2 bg-orange-600 rounded-full"></span>
            )}
            <span className="text-[10px] font-medium">Alerts</span>
          </button>
          <button onClick={() => setSidebarOpen(true)} className="flex flex-col items-center justify-center w-full py-2 text-stone-500 hover:text-stone-700">
            <Menu className="w-6 h-6 mb-1" />
            <span className="text-[10px] font-medium">Menu</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
