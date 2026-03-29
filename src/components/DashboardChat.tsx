'use client';

import { useState, useEffect, useRef } from 'react';
import { ref, onValue, push, serverTimestamp } from 'firebase/database';
import { database } from '@/lib/firebase';

interface Message {
    id: string;
    text: string;
    senderRole: string;
    senderName: string;
    timestamp: number;
}

interface DashboardChatProps {
    dataOwnerId: string;
    userRole: string;
    userName: string;
}

export default function DashboardChat({ dataOwnerId, userRole, userName }: DashboardChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [labUnreadCount, setLabUnreadCount] = useState(0);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const isOwner = userRole === 'owner';

    // Scroll to bottom
    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    };

    // Auto-scroll when messages change or chat opens
    useEffect(() => {
        if ((isOwner && isOpen) || !isOwner) {
            scrollToBottom();
        }
    }, [messages, isOpen, isOwner]);

    // Fetch messages
    useEffect(() => {
        if (!dataOwnerId) return;

        const chatRef = ref(database, `chats/one-to-one/${dataOwnerId}`);
        const unsubscribe = onValue(chatRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const msgs: Message[] = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                })).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
                
                setMessages(msgs);

                const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;

                if (isOwner) {
                    if (!isOpen && lastMsg && lastMsg.senderRole !== userRole) {
                        setUnreadCount(prev => prev + 1);
                    }
                } else {
                    if (lastMsg && lastMsg.senderRole !== userRole && document.activeElement?.id !== 'chat-input') {
                        setLabUnreadCount(prev => prev + 1);
                    }
                }
            } else {
                setMessages([]);
            }
        });

        return () => unsubscribe();
    }, [dataOwnerId, isOwner, isOpen, userRole]);

    // Clear unread when opened
    useEffect(() => {
        if (isOpen) setUnreadCount(0);
    }, [isOpen]);

    const handleInputFocus = () => {
        if (!isOwner) {
            setLabUnreadCount(0);
        }
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim() || !dataOwnerId) return;

        const chatRef = ref(database, `chats/one-to-one/${dataOwnerId}`);
        try {
            await push(chatRef, {
                text: inputText.trim(),
                senderRole: userRole,
                senderName: userName,
                timestamp: serverTimestamp()
            });
            setInputText('');
            // Auto focus back on input
            document.getElementById('chat-input')?.focus();
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    const handleClearChat = async (e: React.MouseEvent) => {
        e.stopPropagation(); // prevent triggering header focus/toggle
        if (!window.confirm("Are you sure you want to clear this entire chat history?")) return;
        
        try {
            const { remove } = await import('firebase/database');
            const chatRef = ref(database, `chats/one-to-one/${dataOwnerId}`);
            await remove(chatRef);
        } catch (error) {
            console.error('Error clearing chat:', error);
        }
    };

    // Reusable Message List UI (Compact)
    const renderMessageList = () => (
        <div 
            className="flex-1 overflow-y-auto p-2 space-y-2 bg-slate-50 relative flex flex-col"
            onClick={handleInputFocus}
        >
            {messages.length === 0 ? (
                <div className="m-auto text-center text-gray-400 text-[11px] italic">
                    <i className="fas fa-comment-medical text-2xl mb-1 text-gray-300 block"></i>
                    Start a conversation...
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
                                <span className="text-[9px] text-gray-400 font-bold ml-1 mb-0.5">{msg.senderName}</span>
                            )}
                            <div className={`max-w-[90%] rounded-xl px-2.5 py-1.5 text-[12px] shadow-sm relative leading-tight ${isMe 
                                ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-tr-sm' 
                                : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm'}`}>
                                <p className="whitespace-pre-wrap">{msg.text}</p>
                                <span className={`text-[8px] mt-0.5 block font-medium ${isMe ? 'text-blue-100 text-right' : 'text-gray-400 text-left'}`}>
                                    {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                                </span>
                            </div>
                        </div>
                    );
                })
            )}
            <div ref={messagesEndRef} />
        </div>
    );

    // Reusable Input Form UI (Compact)
    const renderInputArea = () => (
        <form onSubmit={handleSend} className="p-1.5 bg-white border-t border-gray-100 flex gap-1.5 items-center">
            <input
                id="chat-input"
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onFocus={handleInputFocus}
                placeholder="Type..."
                className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5 min-w-0 text-[12px] focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            <button
                type="submit"
                disabled={!inputText.trim()}
                className="w-7 h-7 flex items-center justify-center bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95 shadow-md flex-shrink-0"
            >
                <i className="fas fa-paper-plane text-[10px] relative -ml-0.5"></i>
            </button>
        </form>
    );

    // Render for LAB Role (Inline Sidebar Box - Compact)
    if (!isOwner) {
        return (
            <div className="mt-4 bg-white rounded-xl shadow-sm border border-blue-100 overflow-hidden flex flex-col h-[280px]">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2 flex items-center justify-between cursor-pointer" onClick={handleInputFocus}>
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                            <i className="fas fa-user-tie text-white text-[10px]"></i>
                        </div>
                        <div>
                            <h3 className="text-white font-bold text-[12px] leading-none flex items-center gap-1.5">
                                Owner Chat
                                {labUnreadCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"></span>}
                            </h3>
                            <p className="text-blue-100 text-[9px] mt-0.5">Connected</p>
                        </div>
                    </div>
                    <button 
                         onClick={handleClearChat} 
                         title="Clear Chat History"
                         className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
                    >
                         <i className="fas fa-trash-alt text-[10px]"></i>
                    </button>
                </div>
                {renderMessageList()}
                {renderInputArea()}
            </div>
        );
    }

    // Render for OWNER Role (Floating Bubble - Compact)
    return (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
            <div className={`transition-all duration-300 transform origin-bottom-right ${isOpen ? 'scale-100 opacity-100 mb-3' : 'scale-0 opacity-0 mb-0 h-0 w-0 overflow-hidden'}`}>
                <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-[280px] h-[360px] flex flex-col overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2 flex justify-between items-center cursor-pointer" onClick={() => setIsOpen(false)}>
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                                <i className="fas fa-microscope text-white text-[10px]"></i>
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-[12px] leading-none">Lab Staff Chat</h3>
                                <div className="flex items-center gap-1 mt-0.5">
                                    <span className="w-1 h-1 rounded-full bg-green-400 animate-pulse"></span>
                                    <p className="text-blue-100 text-[9px]">Connected</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button 
                                onClick={handleClearChat} 
                                title="Clear Chat History"
                                className="text-white/80 hover:text-white w-6 h-6 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
                            >
                                <i className="fas fa-trash-alt text-[10px]"></i>
                            </button>
                            <button className="text-white/80 hover:text-white w-6 h-6 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors">
                                <i className="fas fa-times text-[10px]"></i>
                            </button>
                        </div>
                    </div>
                    
                    {renderMessageList()}
                    {renderInputArea()}
                </div>
            </div>

            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-12 h-12 rounded-full flex items-center justify-center shadow-2xl transform transition-transform hover:scale-105 active:scale-95 ${isOpen ? 'bg-gray-800 text-white rotate-90' : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'}`}
            >
                {isOpen ? (
                    <i className="fas fa-times text-lg"></i>
                ) : (
                    <div className="relative">
                        <i className="fas fa-comment-dots text-xl mt-0.5"></i>
                        {unreadCount > 0 && (
                            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-1 min-w-[16px] h-[16px] rounded-full flex items-center justify-center shadow-lg animate-bounce">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </div>
                )}
            </button>
        </div>
    );
}
