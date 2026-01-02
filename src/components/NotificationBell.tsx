'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ref, onValue } from 'firebase/database';
import { database } from '@/lib/firebase';
import { Notification, markAsRead } from '@/lib/notificationManager';

export default function NotificationBell() {
    const { user, userProfile } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [dropdownRef]);

    useEffect(() => {
        if (!user) return;

        // Determine correct notification key (handle staff username vs firebase uid)
        const authMethod = typeof window !== 'undefined' ? localStorage.getItem('authMethod') : null;
        const username = typeof window !== 'undefined' ? localStorage.getItem('username') : null;
        const notificationKey = (authMethod === 'username' && username) ? username : user.uid;

        const notifRef = ref(database, `notifications/${notificationKey}`);
        const unsubscribe = onValue(notifRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const list: Notification[] = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                }));

                // Filter out chat notifications (they appear on chat bubble instead)
                const nonChatNotifications = list.filter(n => n.type !== 'chat');

                // Sort by date desc
                nonChatNotifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                setNotifications(nonChatNotifications);
                setUnreadCount(nonChatNotifications.filter(n => !n.read).length);

                // Play sound if new unread notification (simple check)
                // In a real app, we'd track 'lastKnownCount' to only play on increase
                if (nonChatNotifications.filter(n => !n.read).length > unreadCount && unreadCount !== 0) {
                    // const audio = new Audio('/notification.mp3'); 
                    // audio.play().catch(e => console.log('Audio play failed', e));
                }

            } else {
                setNotifications([]);
                setUnreadCount(0);
            }
        });

        return () => unsubscribe();
    }, [user]);

    // Only show notification bell for receptionist role - CHECK AT THE END AFTER ALL HOOKS
    if (!user || (userProfile && userProfile.role !== 'receptionist')) {
        return null;
    }

    const handleNotificationClick = async (notification: Notification) => {
        if (!notification.read && notification.id && user) {
            await markAsRead(user.uid, notification.id);
        }
        // Handle navigation based on type if needed
        // e.g., router.push(`/dashboard/reports/${notification.data.reportId}`)
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'critical_alert': return 'fa-exclamation-triangle text-red-500';
            case 'report_ready': return 'fa-file-medical text-blue-500';
            case 'appointment': return 'fa-calendar-check text-green-500';
            case 'prescription': return 'fa-prescription text-purple-500';
            case 'chat': return 'fa-comments text-blue-500';
            default: return 'fa-bell text-gray-500';
        }
    };

    if (!user) return null;

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-white/80 hover:text-white transition"
            >
                <i className="fas fa-bell text-xl"></i>
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-indigo-600">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-100 z-50 overflow-hidden animate-in fade-in zoom-in duration-200">
                    <div className="p-3 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <h3 className="font-bold text-gray-700 text-sm">Notifications</h3>
                        {unreadCount > 0 && (
                            <span className="text-xs text-blue-600 font-medium">
                                {unreadCount} new
                            </span>
                        )}
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center text-gray-500 text-sm">
                                <i className="fas fa-bell-slash text-2xl mb-2 text-gray-300"></i>
                                <p>No notifications yet</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {notifications.map(notif => (
                                    <div
                                        key={notif.id}
                                        onClick={() => handleNotificationClick(notif)}
                                        className={`p-4 hover:bg-gray-50 cursor-pointer transition flex gap-3 ${!notif.read ? 'bg-blue-50/50' : ''}`}
                                    >
                                        <div className={`mt-1 flex-shrink-0 w-8 h-8 rounded-full bg-white flex items-center justify-center border border-gray-100 shadow-sm`}>
                                            <i className={`fas ${getIcon(notif.type)}`}></i>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className={`text-sm font-semibold mb-0.5 ${!notif.read ? 'text-gray-900' : 'text-gray-600'}`}>
                                                {notif.title}
                                            </h4>
                                            <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                                                {notif.message}
                                            </p>
                                            <p className="text-[10px] text-gray-400 mt-1.5">
                                                {new Date(notif.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                        {!notif.read && (
                                            <div className="mt-2 w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="p-2 border-t border-gray-100 bg-gray-50 text-center">
                        <button className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                            View All Notifications
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
