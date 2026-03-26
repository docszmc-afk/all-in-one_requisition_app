import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { 
  LayoutDashboard, 
  FilePlus, 
  List, 
  LogOut, 
  Settings,
  X,
  Users,
  Package,
  Mail,
  Briefcase,
  BellRing,
  CheckCircle2,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { useEmail } from '../context/EmailContext';
import { useFacilityRequests } from '../context/FacilityRequestContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { useITSupport } from '../context/ITSupportContext';

export default function Sidebar({ onClose }: { onClose: () => void }) {
  const { user, logout } = useAuth();
  const { unreadCount } = useEmail();
  const { facilityRequests } = useFacilityRequests();
  const { tasks } = useWorkspace();
  const { tickets } = useITSupport();
  const { requestPermission } = useNotifications();
  const navigate = useNavigate();
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Calculate badges
  const facilityRequestBadge = facilityRequests.filter(r => r.status === 'Pending').length;
  const workspaceBadge = tasks.filter(t => t.status !== 'Done').length;
  const itSupportBadge = tickets.filter(t => t.status !== 'Resolved' && t.status !== 'Unfixable').length;

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // Re-check permission when settings modal opens
  useEffect(() => {
    if (isSettingsOpen && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, [isSettingsOpen]);

  const handleRequestNotification = async () => {
    await requestPermission();
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    ...(user?.role === 'Creator' || user?.role === 'Both' ? [
      { to: '/requests/new', icon: FilePlus, label: 'New Request' }
    ] : []),
    { to: '/requests', icon: List, label: 'All Requests' },
    ...(user?.role === 'Approver' || user?.role === 'Both' || user?.department === 'Facility' ? [
      { to: '/facility-requests', icon: FilePlus, label: 'Facility Requests', badge: facilityRequestBadge > 0 ? facilityRequestBadge : undefined }
    ] : []),
    ...(user?.department === 'Facility' || user?.department === 'Laboratory' || user?.department === 'Pharmacy' ? [
      { to: '/vendors', icon: Users, label: 'Vendors' }
    ] : []),
    ...(user?.department === 'Facility' ? [
      { to: '/inventory', icon: Package, label: 'Store Management' }
    ] : []),
    ...(user?.department === 'Facility' || user?.email === 'zanklihr@gmail.com' || user?.email === 'docs.zmc@gmail.com' ? [
      { to: '/workspace', icon: Briefcase, label: 'Facility Workspace', badge: workspaceBadge > 0 ? workspaceBadge : undefined }
    ] : []),
    ...(user?.department === 'Accounts' ? [
      { to: '/accounting', icon: Briefcase, label: 'Accounting Suite' }
    ] : []),
    { to: '/it-support', icon: Settings, label: 'IT Support', badge: itSupportBadge > 0 ? itSupportBadge : undefined },
    { to: '/email', icon: Mail, label: 'Internal Mail', badge: unreadCount > 0 ? unreadCount : undefined },
  ];

  return (
    <>
      <div className="flex flex-col h-full bg-zinc-950 text-stone-300 w-64">
        <div className="flex items-center justify-between h-16 px-6 bg-black">
          <span className="text-xl font-bold text-orange-500 tracking-tight">Zankli Procure</span>
          <button onClick={onClose} className="lg:hidden p-2 text-stone-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center justify-between px-4 py-3 text-sm font-medium rounded-xl transition-colors ${
                  isActive
                    ? 'bg-orange-600 text-white'
                    : 'text-stone-400 hover:bg-zinc-900 hover:text-stone-200'
                }`
              }
            >
              <div className="flex items-center">
                <item.icon className="w-5 h-5 mr-3" />
                {item.label}
              </div>
              {item.badge !== undefined && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </div>

        <div className="p-4 border-t border-zinc-800">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center w-full px-4 py-3 mb-2 text-sm font-medium text-stone-400 rounded-xl hover:bg-zinc-900 hover:text-stone-200 transition-colors"
          >
            <Settings className="w-5 h-5 mr-3" />
            Settings
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-3 text-sm font-medium text-stone-400 rounded-xl hover:bg-zinc-900 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Logout
          </button>
        </div>
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-stone-100">
              <h2 className="text-xl font-bold text-stone-800">Settings</h2>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="text-stone-400 hover:text-stone-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-stone-800 mb-4 uppercase tracking-wider">Notifications</h3>
                
                <div className="bg-stone-50 rounded-xl p-4 border border-stone-200">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className="p-2 bg-white rounded-lg shadow-sm">
                        <BellRing className="w-5 h-5 text-orange-500" />
                      </div>
                      <div>
                        <p className="font-medium text-stone-800">Desktop Notifications</p>
                        <p className="text-sm text-stone-500 mt-1">Get alerts for new requests and updates</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-stone-200">
                    {notificationPermission === 'granted' ? (
                      <div className="flex items-center text-emerald-600 text-sm font-medium">
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Notifications are enabled
                      </div>
                    ) : notificationPermission === 'denied' ? (
                      <div className="space-y-3">
                        <div className="flex items-center text-red-600 text-sm font-medium">
                          <AlertCircle className="w-4 h-4 mr-2" />
                          Notifications are blocked
                        </div>
                        <p className="text-xs text-stone-600 leading-relaxed">
                          If you have already allowed notifications in your browser settings, they might be blocked because you are viewing the app inside a preview window.
                        </p>
                        <button 
                          onClick={() => window.open(window.location.href, '_blank')}
                          className="flex items-center text-xs font-medium text-orange-600 hover:text-orange-700"
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Open app in a new tab to enable
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={handleRequestNotification}
                        className="w-full py-2 px-4 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        Enable Notifications
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
