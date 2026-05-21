
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../utils/apiConfig';
import {
    MessageSquare, Send, Bot, MoreVertical,
    Search, ArrowLeft, RefreshCw, Zap, ZapOff
} from 'lucide-react';

interface Chat {
    id: string; // JID
    name: string;
    lastMessage: string;
    lastInteraction: string;
    autopilotEnabled: boolean;
    state: string;
    unreadCount: number;
}

interface Message {
    role: 'user' | 'model';
    parts: { text: string }[];
}

const Inbox: React.FC = () => {
    const { token } = useAuth();
    const API_URL = getApiUrl();
    const [chats, setChats] = useState<Chat[]>([]);
    const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loadingChats, setLoadingChats] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Fetch Chats
    const fetchChats = React.useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/chats`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setChats(data);
            }
        } catch (error) {
            console.error('Error fetching chats', error);
        } finally {
            setLoadingChats(false);
        }
    }, [API_URL, token]);

    // Fetch Messages for Selected Chat
    const fetchMessages = React.useCallback(async (jid: string) => {
        setLoadingMessages(true);
        try {
            const res = await fetch(`${API_URL}/chats/${encodeURIComponent(jid)}/messages`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setMessages(data);
            }
        } catch (error) {
            console.error('Error fetching messages', error);
        } finally {
            setLoadingMessages(false);
        }
    }, [API_URL, token]);

    // Initial Load & Polling
    useEffect(() => {
        fetchChats();
        const interval = setInterval(fetchChats, 15000); // Poll chats every 15s (reduced from 5s)
        return () => clearInterval(interval);
    }, [fetchChats]);

    // Poll messages if chat selected
    useEffect(() => {
        if (!selectedChat) return;
        fetchMessages(selectedChat.id); // Initial fetch

        const interval = setInterval(() => {
            // Background update without loader
            fetch(`${API_URL}/chats/${encodeURIComponent(selectedChat.id)}/messages`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
                .then(res => res.json())
                .then(data => setMessages(data))
                .catch(e => console.error(e));
        }, 8000); // Poll messages every 8s (reduced from 3s)

        return () => clearInterval(interval);
    }, [selectedChat, API_URL, token, fetchMessages]);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedChat) return;

        setSending(true);
        try {
            const res = await fetch(`${API_URL}/chats/${encodeURIComponent(selectedChat.id)}/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ text: newMessage })
            });

            if (res.ok) {
                setNewMessage('');
                // Optimistic update
                setMessages(prev => [...prev, { role: 'model', parts: [{ text: newMessage }] }]);
            }
        } catch (error) {
            console.error('Failed to send', error);
        } finally {
            setSending(false);
        }
    };

    const toggleAutopilot = async () => {
        if (!selectedChat) return;

        const newState = !selectedChat.autopilotEnabled;
        // Optimistic update
        setSelectedChat(prev => prev ? { ...prev, autopilotEnabled: newState } : null);
        setChats(prev => prev.map(c => c.id === selectedChat.id ? { ...c, autopilotEnabled: newState } : c));

        try {
            await fetch(`${API_URL}/chats/${encodeURIComponent(selectedChat.id)}/toggle-autopilot`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ enabled: newState })
            });
        } catch (error) {
            console.error('Failed to toggle autopilot', error);
            // Revert on error ??
        }
    };

    const filteredChats = chats.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.id.includes(searchTerm)
    );

    return (
        <div className="flex h-[calc(100vh-6rem)] border border-[#1a1a1a] rounded-xl overflow-hidden bg-[#111] shadow-2xl animate-in zoom-in duration-300">
            {/* Sidebar List */}
            <div className={`w-full md:w-80 border-r border-[#1a1a1a] flex flex-col ${selectedChat ? 'hidden md:flex' : 'flex'}`}>
                {/* Search Header */}
                <div className="p-4 border-b border-[#1a1a1a] bg-[#111]">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" size={16} />
                        <input
                            type="text"
                            placeholder="Rechercher un client..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-white/5 border border-[#1a1a1a] rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-[#00D97E] transition-colors"
                        />
                    </div>
                </div>

                {/* Chats List */}
                <div className="flex-1 overflow-y-auto scrollbar-hide">
                    {loadingChats ? (
                        <div className="flex flex-col items-center justify-center h-40 space-y-2">
                            <RefreshCw className="animate-spin text-[#555]" size={20} />
                            <span className="text-[#555] text-xs">Chargement...</span>
                        </div>
                    ) : filteredChats.length === 0 ? (
                        <div className="p-8 text-center text-[#888] text-sm">
                            Aucune discussion trouvée.
                        </div>
                    ) : (
                        filteredChats.map(chat => (
                            <button
                                key={chat.id}
                                onClick={() => setSelectedChat(chat)}
                                className={`w-full p-4 flex items-start gap-3 hover:bg-[#111] transition-colors text-left border-b border-[#1a1a1a] ${selectedChat?.id === chat.id ? 'bg-[#00D97E]/10 border-l-2 border-l-[#00D97E]' : 'border-l-2 border-l-transparent'}`}
                            >
                                <div className="w-10 h-10 rounded-full bg-[#00D97E]/10 border border-[#00D97E]/20 flex items-center justify-center text-[#00D97E] font-bold shrink-0">
                                    {chat.name.substring(0, 2).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <h3 className="font-semibold text-white truncate text-sm">{chat.name}</h3>
                                        <span className="text-[10px] text-[#888] font-mono">
                                            {new Date(chat.lastInteraction).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className="text-xs text-[#888] truncate pr-2">
                                        {chat.lastMessage || <span className="italic opacity-50">Pas de messages</span>}
                                    </p>
                                    <div className="flex items-center gap-2 mt-2">
                                        {chat.autopilotEnabled ? (
                                            <span className="flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                                <Zap size={10} fill="currentColor" /> AUTO
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-[10px] bg-zinc-500/10 text-[#888] px-1.5 py-0.5 rounded border border-zinc-500/20">
                                                <ZapOff size={10} /> MANUEL
                                            </span>
                                        )}
                                        {chat.state !== 'IDLE' && (
                                            <span className="text-[10px] bg-[#00D97E]/10 text-[#00D97E] px-1.5 py-0.5 rounded border border-[#00D97E]/20">
                                                {chat.state}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Chat View */}
            {selectedChat ? (
                <div className="flex-1 flex flex-col bg-black w-full">
                    {/* Header */}
                    <div className="h-16 border-b border-[#1a1a1a] flex justify-between items-center px-6 bg-[#111]">
                        <div className="flex items-center gap-3">
                            <button onClick={() => setSelectedChat(null)} className="md:hidden text-[#888] hover:text-white">
                                <ArrowLeft size={20} />
                            </button>
                            <div className="w-8 h-8 rounded-full bg-[#00D97E]/10 flex items-center justify-center text-[#00D97E] font-bold text-xs">
                                {selectedChat.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <h2 className="font-bold text-white text-sm">{selectedChat.name}</h2>
                                <p className="text-[10px] text-[#888] font-mono">{selectedChat.id}</p>
                            </div>
                        </div>

                        {/* Autopilot Checkbox/Button */}
                        <div className="flex items-center gap-4">
                            <button
                                onClick={toggleAutopilot}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${selectedChat.autopilotEnabled
                                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20'
                                    : 'bg-zinc-800 text-[#888] border-zinc-700 hover:bg-zinc-700'
                                    }`}
                            >
                                {selectedChat.autopilotEnabled ? <Zap size={14} fill="currentColor" /> : <ZapOff size={14} />}
                                {selectedChat.autopilotEnabled ? 'AUTOPILOTE ACTIVÉ' : 'MODE MANUEL'}
                            </button>
                            <button className="text-[#888] hover:text-white">
                                <MoreVertical size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-black">
                        {loadingMessages ? (
                            <div className="flex justify-center py-10">
                                <RefreshCw className="animate-spin text-[#00D97E]" />
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-[#555] opacity-50">
                                <MessageSquare size={48} className="mb-2" />
                                <p>Aucun message pour l'instant</p>
                            </div>
                        ) : (
                            messages.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.role === 'model' ? 'justify-start' : 'justify-end'}`}>
                                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-md ${msg.role === 'model'
                                        ? 'bg-[#111] text-white rounded-tl-sm border border-[#1a1a1a]'
                                        : 'bg-[#00D97E] text-black rounded-tr-sm'
                                        }`}>
                                        {msg.role === 'model' && (
                                            <div className="flex items-center gap-1.5 mb-1 text-[10px] text-[#888]">
                                                <Bot size={10} /> <span>Assistant</span>
                                            </div>
                                        )}
                                        <p className="whitespace-pre-wrap leading-relaxed">{msg.parts.map(p => p.text).join('')}</p>
                                    </div>
                                </div>
                            ))
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-4 border-t border-[#1a1a1a] bg-[#111]">
                        <form onSubmit={handleSendMessage} className="flex gap-2">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={e => setNewMessage(e.target.value)}
                                placeholder={selectedChat.autopilotEnabled ? "Désactivez l'autopilote pour répondre manuellement..." : "Écrivez votre message..."}
                                className="flex-1 bg-white/5 text-white border border-[#1a1a1a] rounded-lg px-4 py-3 focus:outline-none focus:border-[#00D97E] focus:ring-1 focus:ring-[#00D97E] transition-all placeholder:text-[#555] font-light"
                                disabled={sending /* || selectedChat.autopilotEnabled */} // Allow manual intervention even if autopilot is on? Maybe, but usually better to disable validation first.
                            />
                            <button
                                type="submit"
                                disabled={sending || !newMessage.trim()}
                                className="bg-[#00D97E] hover:bg-[#00D97E]/90 disabled:opacity-50 disabled:cursor-not-allowed text-black rounded-lg p-3 transition-colors shadow-lg shadow-[#00D97E]/20"
                            >
                                <Send size={20} />
                            </button>
                        </form>
                        {selectedChat.autopilotEnabled && (
                            <p className="text-[10px] text-emerald-500/70 mt-2 flex items-center gap-1">
                                <Zap size={10} fill="currentColor" /> L'IA répondra automatiquement aux nouveaux messages.
                            </p>
                        )}
                    </div>
                </div>
            ) : (
                <div className="hidden md:flex flex-1 flex-col items-center justify-center text-[#888] space-y-4 bg-black">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center animate-pulse">
                        <MessageSquare size={40} className="text-[#00D97E]/50" />
                    </div>
                    <p className="text-sm font-medium">Sélectionnez une conversation pour commencer</p>
                </div>
            )}
        </div>
    );
};

export default Inbox;
