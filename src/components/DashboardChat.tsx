'use client';

import { useState, useEffect, useRef } from 'react';
import { ref, onValue, push, serverTimestamp, update } from 'firebase/database';
import { database } from '@/lib/firebase';

interface Message {
    id: string;
    text: string;
    senderRole: string;
    senderName: string;
    timestamp: number;
    isRead?: boolean;
}

interface DashboardChatProps {
    dataOwnerId: string;
    userRole: string;
    userName: string;
    channel?: 'lab' | 'doctor' | 'pharmacy';
}

export default function DashboardChat({ dataOwnerId, userRole, userName, channel = 'lab' }: DashboardChatProps) {
    const isOwner = userRole === 'owner';
    const [activeChannel, setActiveChannel] = useState<'lab' | 'doctor' | 'pharmacy'>(isOwner ? 'lab' : channel);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    
    const [unreadCounts, setUnreadCounts] = useState<{ lab: number; doctor: number; pharmacy: number }>({ lab: 0, doctor: 0, pharmacy: 0 });
    const [staffUnreadCount, setStaffUnreadCount] = useState(0);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        }
    }, [messages, isOpen]);

    // 1. Data Listener (Only setMessages, No side-effects)
    useEffect(() => {
        if (!dataOwnerId) return;

        const currentChannel = isOwner ? activeChannel : channel;
        const chatRef = ref(database, `chats/v2/${dataOwnerId}/${currentChannel}`);
        
        const unsubscribe = onValue(chatRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const msgs: Message[] = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                })).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
                setMessages(msgs);
            } else {
                setMessages([]);
            }
        });

        return () => unsubscribe();
    }, [dataOwnerId, isOwner, activeChannel, channel]);

    // 2. Mark as Read (Separate effect, triggered by messages or opening chat)
    useEffect(() => {
        if (!isOpen || !dataOwnerId || messages.length === 0) return;

        const currentChannel = isOwner ? activeChannel : channel;
        const unreadUpdates: Record<string, any> = {};
        let hasUnread = false;

        messages.forEach(m => {
            if (m.senderRole !== userRole && !m.isRead) {
                unreadUpdates[`chats/v2/${dataOwnerId}/${currentChannel}/${m.id}/isRead`] = true;
                hasUnread = true;
            }
        });

        if (hasUnread) {
            // Only update if there are actually unread messages to prevent loops
            update(ref(database), unreadUpdates).catch(console.error);
        }
    }, [isOpen, messages, dataOwnerId, isOwner, activeChannel, channel, userRole]);

    // 3. Unread Counts for Tabs (Owner only)
    useEffect(() => {
        if (!dataOwnerId || !isOwner) return;

        const channels: ('lab' | 'doctor' | 'pharmacy')[] = ['lab', 'doctor', 'pharmacy'];
        const unsubscribes = channels.map(ch => {
            const chatRef = ref(database, `chats/v2/${dataOwnerId}/${ch}`);
            return onValue(chatRef, (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    const msgs: Message[] = Object.values(data);
                    const unread = msgs.filter((m: any) => m.senderRole !== userRole && !m.isRead).length;
                    setUnreadCounts(prev => ({ ...prev, [ch]: unread }));
                } else {
                    setUnreadCounts(prev => ({ ...prev, [ch]: 0 }));
                }
            });
        });

        return () => unsubscribes.forEach(unsub => unsub());
    }, [dataOwnerId, isOwner, userRole]);

    // 4. Staff-specific Unread Count
    useEffect(() => {
        if (!dataOwnerId || isOwner) return;

        const chatRef = ref(database, `chats/v2/${dataOwnerId}/${channel}`);
        const unsubscribe = onValue(chatRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const msgs: Message[] = Object.values(data);
                const unread = msgs.filter((m: any) => m.senderRole === 'owner' && !m.isRead).length;
                setStaffUnreadCount(unread);
            } else {
                setStaffUnreadCount(0);
            }
        });

        return () => unsubscribe();
    }, [dataOwnerId, isOwner, channel]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim() || !dataOwnerId) return;

        const currentChannel = isOwner ? activeChannel : channel;
        const chatRef = ref(database, `chats/v2/${dataOwnerId}/${currentChannel}`);
        try {
            await push(chatRef, {
                text: inputText.trim(),
                senderRole: userRole,
                senderName: userName,
                timestamp: serverTimestamp(),
                isRead: false
            });
            setInputText('');
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    const handleClearChat = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!window.confirm("Are you sure you want to clear this entire chat history?")) return;
        
        try {
            const { remove } = await import('firebase/database');
            const currentChannel = isOwner ? activeChannel : channel;
            const chatRef = ref(database, `chats/v2/${dataOwnerId}/${currentChannel}`);
            await remove(chatRef);
        } catch (error) {
            console.error('Error clearing chat:', error);
        }
    };

    const totalUnread = unreadCounts.lab + unreadCounts.doctor + unreadCounts.pharmacy;

    return (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
            <div className={`transition-all duration-300 transform origin-bottom-right ${isOpen ? 'scale-100 opacity-100 mb-3' : 'scale-0 opacity-0 mb-0 h-0 w-0 overflow-hidden'}`}>
                <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-[300px] h-[400px] flex flex-col overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <i className="fas fa-comments text-white text-sm"></i>
                            <h3 className="text-white font-bold text-xs uppercase tracking-widest">Clinic Coordination</h3>
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={handleClearChat} className="text-white/80 hover:text-white w-6 h-6 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors">
                                <i className="fas fa-trash-alt text-[10px]"></i>
                            </button>
                            <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white w-6 h-6 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors">
                                <i className="fas fa-times text-[10px]"></i>
                            </button>
                        </div>
                    </div>

                    {isOwner && (
                        <div className="bg-gray-100 p-1 flex gap-1">
                            <button 
                                onClick={() => setActiveChannel('lab')}
                                className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center relative ${activeChannel === 'lab' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                title="Laboratory Coordination"
                            >
                                <i className="fas fa-vial text-sm"></i>
                                {unreadCounts.lab > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse border-2 border-white"></span>}
                            </button>
                            <button 
                                onClick={() => setActiveChannel('doctor')}
                                className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center relative ${activeChannel === 'doctor' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                title="Doctor Coordination"
                            >
                                <i className="fas fa-user-md text-sm"></i>
                                {unreadCounts.doctor > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse border-2 border-white"></span>}
                            </button>
                            <button 
                                onClick={() => setActiveChannel('pharmacy')}
                                className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center relative ${activeChannel === 'pharmacy' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                title="Pharmacy Coordination"
                            >
                                <i className="fas fa-pills text-sm"></i>
                                {unreadCounts.pharmacy > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse border-2 border-white"></span>}
                            </button>
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50 flex flex-col">
                        {messages.length === 0 ? (
                            <div className="m-auto text-center text-gray-400 text-[11px] italic">
                                <i className={`fas ${channel === 'doctor' ? 'fa-stethoscope' : 'fa-vial'} text-2xl mb-2 text-gray-200 block`}></i>
                                Ready for coordination...
                            </div>
                        ) : (
                            messages.map((msg, index) => {
                                const isMe = msg.senderRole === userRole;
                                let showHeader = false;
                                if (index === 0 || messages[index - 1].senderRole !== msg.senderRole) {
                                    showHeader = true;
                                }

                                return (
                                    <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                        {showHeader && !isMe && (
                                            <span className="text-[9px] text-gray-400 font-bold ml-1 mb-0.5 uppercase tracking-tighter">{msg.senderName}</span>
                                        )}
                                        <div className={`max-w-[85%] rounded-xl px-3 py-2 text-[12px] shadow-sm relative leading-tight ${isMe 
                                            ? 'bg-blue-600 text-white rounded-tr-none' 
                                            : 'bg-white border text-gray-800 rounded-tl-none'}`}>
                                            <p className="whitespace-pre-wrap">{msg.text}</p>
                                            <span className={`text-[8px] mt-1 flex items-center gap-1 ${isMe ? 'text-blue-100 justify-end' : 'text-gray-400 justify-start'}`}>
                                                {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                                                {isMe && <i className={`fas fa-check-double text-[9px] ${msg.isRead ? 'text-green-400' : 'text-blue-200'}`}></i>}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <form onSubmit={handleSend} className="p-2 bg-white border-t flex gap-2 items-center">
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="Type a message..."
                            className="flex-1 bg-gray-50 border rounded-full px-4 py-2 text-[12px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <button
                            type="submit"
                            disabled={!inputText.trim()}
                            className="w-8 h-8 flex items-center justify-center bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-90 shadow-md"
                        >
                            <i className="fas fa-paper-plane text-[10px]"></i>
                        </button>
                    </form>
                </div>
            </div>

            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-12 h-12 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 ${isOpen ? 'bg-gray-800 text-white rotate-90' : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'}`}
            >
                {isOpen ? (
                    <i className="fas fa-times text-lg"></i>
                ) : (
                    <div className="relative">
                        <i className={`fas ${channel === 'doctor' && !isOwner ? 'fa-user-md' : 'fa-comments'} text-xl`}></i>
                        {(isOwner ? totalUnread : staffUnreadCount) > 0 && (
                            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white animate-bounce">
                                {(isOwner ? totalUnread : staffUnreadCount) > 9 ? '9+' : (isOwner ? totalUnread : staffUnreadCount)}
                            </span>
                        )}
                    </div>
                )}
            </button>
        </div>
    );
}
