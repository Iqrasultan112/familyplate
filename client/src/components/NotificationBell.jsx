import React, { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import api from '../lib/api';

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const { data } = await api.get('/profile/notifications');
        if (active) { setNotifications(data); setUnreadCount(data.filter(item => !item.isRead).length); }
      } catch { /* The app remains usable if notifications are unavailable. */ }
    };
    load();
    const refresh = setInterval(load, 30000);

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => { active = false; clearInterval(refresh); document.removeEventListener('mousedown', handleClickOutside); };
  }, []);

  const handleMarkAsRead = async (id) => {
    const item = notifications.find(notification => notification.id === id);
    if (!item || item.isRead) return;
    try {
      await api.patch(`/profile/notifications/${id}/read`);
      setNotifications(previous => previous.map(notification => notification.id === id ? { ...notification, isRead: true } : notification));
      setUnreadCount(previous => Math.max(0, previous - 1));
    } catch { /* Keep the item unread so the user can retry. */ }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.patch('/profile/notifications/read-all');
      setNotifications(previous => previous.map(notification => ({ ...notification, isRead: true })));
      setUnreadCount(0);
    } catch { /* Keep unread state on failure. */ }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={isOpen}
        className="p-2 rounded-full hover:bg-gray-100 relative transition-colors"
      >
        <Bell className="w-6 h-6 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-100 z-50 overflow-hidden">
          <div className="p-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
            <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button type="button" className="text-xs text-primary-600 font-medium hover:underline" onClick={handleMarkAllRead}>
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">No notifications</div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {notifications.map((notif) => (
                  <li 
                    key={notif.id}
                    className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${!notif.isRead ? 'bg-primary-50/50' : ''}`}
                    onClick={() => handleMarkAsRead(notif.id)}
                  >
                    <div className="flex items-start gap-3">
                      {!notif.isRead && <div className="w-2 h-2 rounded-full bg-primary-500 mt-1.5 shrink-0" />}
                      <p className={`text-sm ${!notif.isRead ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
                        {notif.message}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
