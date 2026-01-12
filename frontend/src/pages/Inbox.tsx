
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
    const fetchChats = async () => {
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
    };

    // Fetch Messages for Selected Chat
    const fetchMessages = async (jid: string) => {
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
    };

    // Initial Load & Polling
    useEffect(() => {
        fetchChats();
        const interval = setInterval(fetchChats, 5000); // Poll chats list
        return () => clearInterval(interval);
    }, [token]);

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
        }, 3000);

        return () => clearInterval(interval);
    }, [selectedChat, token]);

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
        <div className="flex h-[calc(100vh-6rem)] border border-white/5 rounded-xl overflow-hidden bg-[#0a0c10] shadow-2xl animate-in zoom-in duration-300">
            {/* Sidebar List */}
            <div className={`w-full md:w-80 border-r border-white/5 flex flex-col ${selectedChat ? 'hidden md:flex' : 'flex'}`}>
                {/* Search Header */}
                <div className="p-4 border-b border-white/5 bg-[#0a0c10]">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                        <input
                            type="text"
                            placeholder="Rechercher un client..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-white/5 border border-white/5 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                    </div>
                </div>

                {/* Chats List */}
                <div className="flex-1 overflow-y-auto scrollbar-hide">
                    {loadingChats ? (
                        <div className="flex flex-col items-center justify-center h-40 space-y-2">
                            <RefreshCw className="animate-spin text-zinc-600" size={20} />
                            <span className="text-zinc-600 text-xs">Chargement...</span>
                        </div>
                    ) : filteredChats.length === 0 ? (
                        <div className="p-8 text-center text-zinc-500 text-sm">
                            Aucune discussion trouvée.
                        </div>
                    ) : (
                        filteredChats.map(chat => (
                            <button
                                key={chat.id}
                                onClick={() => setSelectedChat(chat)}
                                className={`w-full p-4 flex items-start gap-3 hover:bg-white/5 transition-colors text-left border-b border-white/5 ${selectedChat?.id === chat.id ? 'bg-indigo-500/10 border-l-2 border-l-indigo-500' : 'border-l-2 border-l-transparent'}`}
                            >
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center text-indigo-400 font-bold shrink-0">
                                    {chat.name.substring(0, 2).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <h3 className="font-semibold text-white truncate text-sm">{chat.name}</h3>
                                        <span className="text-[10px] text-zinc-500 font-mono">
                                            {new Date(chat.lastInteraction).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className="text-xs text-zinc-400 truncate pr-2">
                                        {chat.lastMessage || <span className="italic opacity-50">Pas de messages</span>}
                                    </p>
                                    <div className="flex items-center gap-2 mt-2">
                                        {chat.autopilotEnabled ? (
                                            <span className="flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                                <Zap size={10} fill="currentColor" /> AUTO
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-[10px] bg-zinc-500/10 text-zinc-500 px-1.5 py-0.5 rounded border border-zinc-500/20">
                                                <ZapOff size={10} /> MANUEL
                                            </span>
                                        )}
                                        {chat.state !== 'IDLE' && (
                                            <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/20">
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
                <div className="flex-1 flex flex-col bg-[#0f111a] w-full">
                    {/* Header */}
                    <div className="h-16 border-b border-white/5 flex justify-between items-center px-6 bg-[#0a0c10]">
                        <div className="flex items-center gap-3">
                            <button onClick={() => setSelectedChat(null)} className="md:hidden text-zinc-400 hover:text-white">
                                <ArrowLeft size={20} />
                            </button>
                            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-xs">
                                {selectedChat.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <h2 className="font-bold text-white text-sm">{selectedChat.name}</h2>
                                <p className="text-[10px] text-zinc-500 font-mono">{selectedChat.id}</p>
                            </div>
                        </div>

                        {/* Autopilot Checkbox/Button */}
                        <div className="flex items-center gap-4">
                            <button
                                onClick={toggleAutopilot}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${selectedChat.autopilotEnabled
                                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20'
                                    : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700'
                                    }`}
                            >
                                {selectedChat.autopilotEnabled ? <Zap size={14} fill="currentColor" /> : <ZapOff size={14} />}
                                {selectedChat.autopilotEnabled ? 'AUTOPILOTE ACTIVÉ' : 'MODE MANUEL'}
                            </button>
                            <button className="text-zinc-500 hover:text-white">
                                <MoreVertical size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gradient-to-b from-[#0f111a] to-[#0a0c10]">
                        {loadingMessages ? (
                            <div className="flex justify-center py-10">
                                <RefreshCw className="animate-spin text-indigo-500" />
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-zinc-600 opacity-50">
                                <MessageSquare size={48} className="mb-2" />
                                <p>Aucun message pour l'instant</p>
                            </div>
                        ) : (
                            messages.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.role === 'model' ? 'justify-start' : 'justify-end'}`}>
                                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-md ${msg.role === 'model'
                                        ? 'bg-[#1a1c25] text-zinc-200 rounded-tl-sm border border-white/5'
                                        : 'bg-indigo-600 text-white rounded-tr-sm'
                                        }`}>
                                        {msg.role === 'model' && (
                                            <div className="flex items-center gap-1.5 mb-1 text-[10px] text-zinc-500">
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
                    <div className="p-4 border-t border-white/5 bg-[#0a0c10]">
                        <form onSubmit={handleSendMessage} className="flex gap-2">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={e => setNewMessage(e.target.value)}
                                placeholder={selectedChat.autopilotEnabled ? "Désactivez l'autopilote pour répondre manuellement..." : "Écrivez votre message..."}
                                className="flex-1 bg-white/5 text-white border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-zinc-600 font-light"
                                disabled={sending /* || selectedChat.autopilotEnabled */} // Allow manual intervention even if autopilot is on? Maybe, but usually better to disable validation first.
                            />
                            <button
                                type="submit"
                                disabled={sending || !newMessage.trim()}
                                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg p-3 transition-colors shadow-lg shadow-indigo-500/20"
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
                <div className="hidden md:flex flex-1 flex-col items-center justify-center text-zinc-500 space-y-4 bg-[#0f111a]">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center animate-pulse">
                        <MessageSquare size={40} className="text-indigo-500/50" />
                    </div>
                    <p className="text-sm font-medium">Sélectionnez une conversation pour commencer</p>
                </div>
            )}
        </div>
    );
};

export default Inbox;
