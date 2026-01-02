'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePathname } from 'next/navigation';
import { ref, push, onValue, set, get, serverTimestamp, query, orderByChild, limitToLast } from 'firebase/database';
import { database } from '@/lib/firebase';
import { getDataOwnerId } from '@/lib/dataUtils';
import { createNotification, markAsRead } from '@/lib/notificationManager';

interface Message {
    id: string;
    senderId: string;
    senderName: string;
    senderRole: string;
    text: string;
    timestamp: number;
    read: boolean;
}

interface ChatUser {
    uid: string;
    name: string;
    role: string;
    online: boolean;
    hasUnread: boolean;
}

export default function Intercom() {
    const { user, userProfile } = useAuth();
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'staff' | 'patient'>('staff'); // Staff vs Patient Support
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [staffList, setStaffList] = useState<ChatUser[]>([]);
    const [patientChats, setPatientChats] = useState<ChatUser[]>([]);

    // selectedChatUser: UID of the PERSON I am talking to
    const [selectedChatUser, setSelectedChatUser] = useState<string | null>(null);
    const [selectedChatUserName, setSelectedChatUserName] = useState<string>('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Identify Role
    const role = userProfile?.role || 'patient';
    const isPatient = role === 'patient';
    const isReceptionist = role === 'receptionist' || !role; // Owner defaults to receptionist

    // ownerId: The ID of the Main Account (the data silo)
    const ownerId = isPatient ? (userProfile?.ownerId || 'admin') : (getDataOwnerId(userProfile, user?.uid) || user?.uid || '');

    // Unread Count Logic and Map
    const [unreadCount, setUnreadCount] = useState(0);
    const [unreadSenders, setUnreadSenders] = useState<Set<string>>(new Set());
    const [notificationIds, setNotificationIds] = useState<Record<string, string[]>>({}); // senderId -> [notifId]

    // Get Chat ID for Direct Messaging: Sort UIDs to ensure A->B and B->A share same path
    const getDirectChatId = (otherUserId: string) => {
        if (!user) return '';
        const ids = [user.uid, otherUserId].sort();
        return `${ids[0]}_${ids[1]}`;
    };

    // Listen for Unread Message Notifications
    useEffect(() => {
        if (!user) return;

        // For staff, use username as notification key. For others, use uid
        const authMethod = typeof window !== 'undefined' ? localStorage.getItem('authMethod') : null;
        const username = typeof window !== 'undefined' ? localStorage.getItem('username') : null;
        const notificationKey = (authMethod === 'username' && username) ? username : user.uid;

        const notifRef = ref(database, `notifications/${notificationKey}`);
        const unsub = onValue(notifRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                // Filter for unread chat notifications only
                const unreadMsgs = Object.entries(data).filter(([_, n]: [string, any]) =>
                    !n.read && n.type === 'chat'
                );

                setUnreadCount(unreadMsgs.length);

                // Track WHO sent them to show dots on list
                const senders = new Set<string>();
                const notifMap: Record<string, string[]> = {};

                unreadMsgs.forEach(([id, n]: [string, any]) => {
                    // Try to extract sender ID from data (preferred) or title (fallback)
                    let sender = n.data?.senderId;

                    if (sender) {
                        senders.add(sender);
                        if (!notifMap[sender]) notifMap[sender] = [];
                        notifMap[sender].push(id);
                    }
                });

                setUnreadSenders(senders);
                setNotificationIds(notifMap);

                // AUTO-CLEANUP FOR OWNER (User Request)
                // If I am the Owner (Google Auth, not Staff Username), I shouldn't see patient chat notifications
                // Mark them as read automatically to clear "stuck" notifications
                const authMethod = typeof window !== 'undefined' ? localStorage.getItem('authMethod') : null;
                const isRealOwner = !isPatient && authMethod !== 'username';

                if (isRealOwner && unreadMsgs.length > 0) {
                    console.log('🧹 Formatting Owner Dashboard: Auto-clearing patient chat notifications...');
                    unreadMsgs.forEach(([id]) => {
                        markAsRead(notificationKey, id).catch(e => console.error(e));
                    });
                }

            } else {
                setUnreadCount(0);
                setUnreadSenders(new Set());
                setNotificationIds({});
            }
        });
        return () => unsub();
    }, [user]);

    // Cleanup Notifications when opening chat
    useEffect(() => {
        if (!user) return;

        // PATIENT FIX: Clear ALL chat notifications when chat window is open
        // Patients only have 1 thread (Support), so any chat message belongs to it
        if (isPatient && isOpen) {
            Object.values(notificationIds).flat().forEach(nid => {
                markAsRead(user.uid, nid);
            });
            // State will update via listener
            return;
        }

        if (selectedChatUser && notificationIds[selectedChatUser]) {
            // Mark all notifications from this user as read
            notificationIds[selectedChatUser].forEach(nid => {
                markAsRead(user.uid, nid);
            });
            // Update local state immediately for responsiveness
            const newSenders = new Set(unreadSenders);
            newSenders.delete(selectedChatUser);
            setUnreadSenders(newSenders);
        }
    }, [selectedChatUser, notificationIds, unreadSenders, user, isOpen, isPatient]);

    useEffect(() => {
        if (!user || !isOpen || !ownerId) return;

        // 1. FETCH STAFF LIST (Only for Staff Users)
        if (!isPatient && activeTab === 'staff') {
            const usersRef = ref(database, `users/${ownerId}/auth`);
            const unsubUsers = onValue(usersRef, (snapshot) => {
                const data = snapshot.val();
                const users: ChatUser[] = [];

                // Helper to add user
                const addUser = (uid: string, name: string, r: string, isActive: boolean = true) => {
                    // Get current user's identifier (username or uid)
                    const authMethod = typeof window !== 'undefined' ? localStorage.getItem('authMethod') : null;
                    const username = typeof window !== 'undefined' ? localStorage.getItem('username') : null;
                    const myId = (authMethod === 'username' && username) ? username : user.uid;

                    if (uid !== myId && isActive) { // Don't add myself
                        users.push({
                            uid,
                            name,
                            role: r,
                            online: false,
                            hasUnread: unreadSenders.has(uid) // CHECK UNREAD STATE
                        });
                    }
                };

                // Add Owner/Admin
                if (ownerId && ownerId !== user.uid) {
                    addUser(ownerId, 'Administrator', 'admin');
                }

                if (data) {
                    if (data.receptionist?.username && data.receptionist.isActive !== false) {
                        addUser(data.receptionist.username, data.receptionist.name || 'Receptionist', 'receptionist');
                    }
                    if (data.lab?.username && data.lab.isActive !== false) {
                        addUser(data.lab.username, data.lab.name || 'Lab Technician', 'lab');
                    }
                    if (data.pharmacy?.username && data.pharmacy.isActive !== false) {
                        addUser(data.pharmacy.username, data.pharmacy.name || 'Pharmacist', 'pharmacy');
                    }
                    if (data.doctors) {
                        Object.entries(data.doctors).forEach(([dId, doc]: [string, any]) => {
                            if (doc.username && doc.isActive !== false) {
                                addUser(doc.username, doc.name || 'Doctor', 'doctor');
                            }
                        });
                    }
                }
                setStaffList(users);
            });
            return () => unsubUsers();
        }

        // 2. PATIENT VIEW: Only show receptionist
        if (isPatient) {
            // Patient can only chat with receptionist
            const users: ChatUser[] = [{
                uid: 'receptionist',
                name: 'Support Team',
                role: 'receptionist',
                online: true,
                hasUnread: false
            }];
            setStaffList(users);
            // Auto-select receptionist for patient
            if (!selectedChatUser) {
                setSelectedChatUser('receptionist');
                setSelectedChatUserName('Support Team');
            }
        }

        // 3. FETCH PATIENT CHAT LIST (Only for Receptionist)
        if (isReceptionist && activeTab === 'patient') {
            const allPatientsRef = ref(database, `chats/patients/${ownerId}`);
            const unsubPatients = onValue(allPatientsRef, (snapshot) => {
                const data = snapshot.val();
                const list: ChatUser[] = [];
                if (data) {
                    Object.keys(data).forEach(patId => {
                        const info = data[patId].info;
                        let displayName = `Patient ${patId.slice(-4)}`;

                        // Use stored info if available
                        if (info && info.mobile) {
                            displayName = `${info.name} (${info.mobile})`;
                        } else if (info && info.name) {
                            displayName = info.name;
                        }

                        list.push({
                            uid: patId,
                            name: displayName,
                            role: 'patient',
                            online: false,
                            hasUnread: unreadSenders.has(patId)
                        });
                    });
                    setPatientChats(list);
                }
            });
            return () => unsubPatients();
        }
    }, [user, isOpen, activeTab, isPatient, isReceptionist, ownerId, unreadSenders, selectedChatUser]);

    // FETCH MESSAGES
    useEffect(() => {
        if (!user || !isOpen || !ownerId) return;

        let chatRef: any = null;

        // A. Patient <-> Receptionist
        if (isPatient) {
            // Patient view: Only 1 chat
            chatRef = query(ref(database, `chats/patients/${ownerId}/${user.uid}/messages`), limitToLast(50));
        } else if (isReceptionist && activeTab === 'patient' && selectedChatUser) {
            // Receptionist looking at specific patient
            chatRef = query(ref(database, `chats/patients/${ownerId}/${selectedChatUser}/messages`), limitToLast(50));
        }
        // B. Staff <-> Staff (Direct)
        else if (!isPatient && activeTab === 'staff' && selectedChatUser) {
            const chatId = getDirectChatId(selectedChatUser);
            chatRef = query(ref(database, `chats/direct/${ownerId}/${chatId}/messages`), limitToLast(50));
        }

        if (chatRef) {
            const unsub = onValue(chatRef, (snapshot: any) => {
                const data = snapshot.val();
                if (data) {
                    const list = Object.entries(data).map(([key, val]: [string, any]) => ({
                        id: key,
                        ...val
                    }));
                    setMessages(list);
                    scrollToBottom();
                } else {
                    setMessages([]);
                }
            });
            return () => unsub();
        } else {
            setMessages([]); // Clear if no user selected
        }
    }, [user, isOpen, activeTab, selectedChatUser, isPatient, ownerId]);


    const scrollToBottom = () => {
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    };

    const handleSend = async () => {
        if (!newMessage.trim() || !user || !ownerId) return;

        // For staff, use username as senderId. For others, use uid
        const authMethod = typeof window !== 'undefined' ? localStorage.getItem('authMethod') : null;
        const username = typeof window !== 'undefined' ? localStorage.getItem('username') : null;
        const senderId = (authMethod === 'username' && username) ? username : user.uid;

        const msgPayload = {
            senderId: senderId,
            senderName: userProfile?.name || user.displayName || 'User',
            senderRole: role,
            text: newMessage,
            timestamp: serverTimestamp(),
            read: false
        };

        try {
            // 1. Patient <-> Support
            if (isPatient) {
                await push(ref(database, `chats/patients/${ownerId}/${user.uid}/messages`), msgPayload);

                // Update Chat Info (Identity persistence)
                const patMobile = localStorage.getItem('patient_mobile');
                if (patMobile) {
                    const infoRef = ref(database, `chats/patients/${ownerId}/${user.uid}/info`);
                    const { update } = await import('firebase/database');
                    update(infoRef, {
                        name: userProfile?.name || 'Patient',
                        mobile: patMobile,
                        lastUpdated: serverTimestamp()
                    });
                }

                // Notify Receptionist ONLY (as per user request)
                // We do NOT notify the ownerId (admin) anymore based on recent changes
                await createNotification(
                    'receptionist',
                    'chat',
                    'New Message from Patient',
                    newMessage.slice(0, 50),
                    { senderId: user.uid }
                );

            } else if (isReceptionist && activeTab === 'patient' && selectedChatUser) {
                await push(ref(database, `chats/patients/${ownerId}/${selectedChatUser}/messages`), msgPayload);
                // Notify Patient
                await createNotification(selectedChatUser, 'chat', 'New Message from Support', newMessage.slice(0, 50), { senderId: user.uid });
            }
            // 2. Staff <-> Staff
            else if (activeTab === 'staff' && selectedChatUser) {
                const chatId = getDirectChatId(selectedChatUser);
                await push(ref(database, `chats/direct/${ownerId}/${chatId}/messages`), msgPayload);

                // Notify Recipient (Staff)
                // IMPORTANT: Pass senderId so they can get the red dot
                await createNotification(
                    selectedChatUser,
                    'chat',
                    `New Message from ${msgPayload.senderName}`,
                    newMessage.slice(0, 50),
                    { senderId: user.uid } // <--- CRITICAL FIX
                );
            }

            setNewMessage('');
            scrollToBottom();
        } catch (e) {
            console.error(e);
        }
    };

    // Don't show chat if not logged in
    if (!user) return null;

    // Don't show on patient login page
    if (pathname === '/patient') {
        return null;
    }

    return (
        <div className="fixed bottom-6 right-6 z-[9999]">
            {/* Toggle Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="relative bg-blue-600 hover:bg-blue-700 text-white rounded-full w-14 h-14 shadow-xl flex items-center justify-center transition-transform hover:scale-110"
                >
                    <i className="fas fa-comment-dots text-2xl"></i>
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white min-w-[20px] text-center">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </button>
            )}

            {/* Chat Window */}
            {isOpen && (
                <div className="bg-white rounded-xl shadow-2xl w-80 sm:w-96 flex flex-col h-[500px] border border-gray-200 overflow-hidden animate-in slide-in-from-bottom-5">

                    {/* Header */}
                    <div className="bg-blue-600 p-4 text-white flex justify-between items-center shadow-sm">
                        <div className="font-bold flex items-center gap-2">
                            {/* Back Button for Detail Views */}
                            {selectedChatUser && !isPatient && (
                                <button onClick={() => setSelectedChatUser(null)} className="mr-1 hover:bg-blue-700 rounded-full p-1">
                                    <i className="fas fa-arrow-left"></i>
                                </button>
                            )}
                            <i className="fas fa-comments"></i>
                            {isPatient ? 'Support Chat' : (selectedChatUserName ? selectedChatUserName : 'Intercom')}
                        </div>
                        <button onClick={() => setIsOpen(false)} className="hover:text-gray-200">
                            <i className="fas fa-times"></i>
                        </button>
                    </div>

                    {/* Staff Tabs (Only for Staff + No User Selected) */}
                    {!isPatient && !selectedChatUser && (
                        <div className="flex border-b border-gray-200">
                            <button
                                onClick={() => setActiveTab('staff')}
                                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide ${activeTab === 'staff' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
                            >
                                Staff
                            </button>
                            {isReceptionist && (
                                <button
                                    onClick={() => setActiveTab('patient')}
                                    className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide ${activeTab === 'patient' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
                                >
                                    Patients
                                </button>
                            )}
                        </div>
                    )}

                    {/* Chat Body */}
                    <div className="flex-1 overflow-y-auto bg-gray-50 p-0 relative">

                        {/* LIST VIEW: Staff */}
                        {!isPatient && activeTab === 'staff' && !selectedChatUser && (
                            <div className="divide-y divide-gray-100">
                                {staffList.map(u => (
                                    <button
                                        key={u.uid}
                                        onClick={() => { setSelectedChatUser(u.uid); setSelectedChatUserName(u.name); }}
                                        className="w-full p-4 flex items-center gap-3 hover:bg-blue-50 transition text-left bg-white relative"
                                    >
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm ${u.role === 'admin' ? 'bg-indigo-500' :
                                            u.role === 'doctor' ? 'bg-purple-500' :
                                                u.role === 'pharmacy' ? 'bg-green-500' : 'bg-blue-500'
                                            }`}>
                                            {u.name[0]}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-800 text-sm">{u.name}</p>
                                            <p className="text-xs text-gray-500 capitalize">{u.role}</p>
                                        </div>
                                        {u.hasUnread && (
                                            <span className="ml-auto bg-red-500 w-3 h-3 rounded-full mr-2 shadow-sm animate-pulse"></span>
                                        )}
                                        <i className="fas fa-chevron-right text-gray-300 text-xs ml-auto" style={u.hasUnread ? { display: 'none' } : {}}></i>
                                    </button>
                                ))}
                                {staffList.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">No other staff members found.</div>}
                            </div>
                        )}

                        {/* LIST VIEW: Patients */}
                        {!isPatient && activeTab === 'patient' && !selectedChatUser && (
                            <div className="divide-y divide-gray-100">
                                {patientChats.map(p => (
                                    <button
                                        key={p.uid}
                                        onClick={() => { setSelectedChatUser(p.uid); setSelectedChatUserName(p.name); }}
                                        className="w-full p-4 flex items-center gap-3 hover:bg-blue-50 transition text-left bg-white relative"
                                    >
                                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-500">
                                            <i className="fas fa-user"></i>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-800 text-sm">{p.name}</p>
                                            <p className="text-xs text-gray-500">Support Inquiry</p>
                                        </div>
                                        {p.hasUnread && (
                                            <span className="ml-auto bg-red-500 w-3 h-3 rounded-full mr-2 shadow-sm animate-pulse"></span>
                                        )}
                                    </button>
                                ))}
                                {patientChats.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">No active patient inquiries.</div>}
                            </div>
                        )}

                        {/* MESSAGE VIEW (For Patient OR Selected User) */}
                        {(isPatient || selectedChatUser) && (
                            <div className="p-4 space-y-3 min-h-full pb-2">
                                {messages.map((msg) => {
                                    // Get current user's identifier (username for staff, uid for patients)
                                    const authMethod = typeof window !== 'undefined' ? localStorage.getItem('authMethod') : null;
                                    const username = typeof window !== 'undefined' ? localStorage.getItem('username') : null;
                                    const myId = (authMethod === 'username' && username) ? username : user.uid;

                                    const isMe = msg.senderId === myId;
                                    return (
                                        <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                            <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm ${isMe ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'
                                                }`}>
                                                {/* Only show sender name in staff group chats, not in 1-on-1 patient chats */}
                                                {msg.text}
                                            </div>
                                            <span className="text-[10px] text-gray-400 mt-1 px-1">
                                                {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                                            </span>
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>
                        )}
                    </div>

                    {/* Input Area (Only when in a chat) */}
                    {(isPatient || selectedChatUser) && (
                        <div className="p-3 bg-white border-t border-gray-200">
                            <form
                                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                                className="flex gap-2"
                            >
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Type a message..."
                                    className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                />
                                <button
                                    type="submit"
                                    disabled={!newMessage.trim()}
                                    className="bg-blue-600 text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow transition"
                                >
                                    <i className="fas fa-paper-plane text-xs"></i>
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
