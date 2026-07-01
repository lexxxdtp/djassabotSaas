import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../utils/apiClient';
import {
    MessageSquare, Send, Bot, Search, ArrowLeft, RefreshCw, Zap
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

function ChatSkeleton() {
    return (
        <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4 animate-pulse flex gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#222] shrink-0"></div>
            <div className="flex-1 space-y-2">
                <div className="flex justify-between">
                    <div className="h-4 w-24 bg-[#222] rounded"></div>
                    <div className="h-3 w-8 bg-[#222] rounded"></div>
                </div>
                <div className="h-3 w-40 bg-[#222] rounded"></div>
            </div>
        </div>
    );
}

const getStateMeta = (state: string) => {
    switch (state) {
        case 'WAITING_FOR_ADDRESS':
            return { label: 'Attente Adresse', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
        case 'WAITING_FOR_VARIATION':
            return { label: 'Choix Options', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' };
        case 'IDLE':
            return { label: 'Libre', color: 'bg-zinc-500/10 text-[#888] border-zinc-500/20' };
        default:
            return { label: state, color: 'bg-[#00D97E]/10 text-[#00D97E] border-[#00D97E]/20' };
    }
};

const Inbox: React.FC = () => {
    const { token } = useAuth();
    const [chats, setChats] = useState<Chat[]>([]);
    const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loadingChats, setLoadingChats] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState<'all' | 'auto' | 'manual'>('all');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Fetch Chats
    const fetchChats = React.useCallback(async () => {
        try {
            const res = await apiClient('/chats');
            if (res.ok) {
                const data = await res.json();
                setChats(data);
            }
        } catch (error) {
            console.error('Error fetching chats', error);
        } finally {
            setLoadingChats(false);
        }
    }, []);

    // Fetch Messages for Selected Chat
    const fetchMessages = React.useCallback(async (jid: string) => {
        setLoadingMessages(true);
        try {
            const res = await apiClient(`/chats/${encodeURIComponent(jid)}/messages`);
            if (res.ok) {
                const data = await res.json();
                setMessages(data);
            }
        } catch (error) {
            console.error('Error fetching messages', error);
        } finally {
            setLoadingMessages(false);
        }
    }, []);

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
            apiClient(`/chats/${encodeURIComponent(selectedChat.id)}/messages`)
                .then(res => res.json())
                .then(data => setMessages(data))
                .catch(e => console.error(e));
        }, 8000); // Poll messages every 8s (reduced from 3s)

        return () => clearInterval(interval);
    }, [selectedChat, token, fetchMessages]);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedChat) return;

        setSending(true);
        try {
            const res = await apiClient(`/chats/${encodeURIComponent(selectedChat.id)}/send`, {
                method: 'POST',
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
            await apiClient(`/chats/${encodeURIComponent(selectedChat.id)}/toggle-autopilot`, {
                method: 'POST',
                body: JSON.stringify({ enabled: newState })
            });
        } catch (error) {
            console.error('Failed to toggle autopilot', error);
            // Revert on error ??
        }
    };

    const filteredChats = useMemo(() => {
        return chats.filter(c => {
            const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.id.includes(searchTerm);
            const matchesFilter =
                activeFilter === 'all' ||
                (activeFilter === 'auto' && c.autopilotEnabled) ||
                (activeFilter === 'manual' && !c.autopilotEnabled);
            return matchesSearch && matchesFilter;
        });
    }, [chats, searchTerm, activeFilter]);

    return (
        <div className="flex h-[calc(100vh-8.5rem)] md:h-[calc(100vh-10rem)] border border-[#1a1a1a] rounded-2xl overflow-hidden bg-black shadow-2xl animate-in fade-in duration-300">
            {/* Chats list panel: visible on desktop, or on mobile when no chat is selected */}
            <div className={`w-full md:w-80 border-r border-[#1a1a1a] flex flex-col bg-black ${selectedChat ? 'hidden md:flex' : 'flex'}`}>
                {/* Header */}
                <div className="p-4 border-b border-[#1a1a1a] space-y-3 shrink-0">
                    <div className="flex justify-between items-center">
                        <h1 className="text-xl font-bold text-white tracking-tight">Discussions</h1>
                        <span className="text-[10px] text-[#888] font-mono bg-[#111] border border-[#1a1a1a] px-2.5 py-1 rounded-lg uppercase tracking-wider">
                            {filteredChats.length} conv
                        </span>
                    </div>

                    {/* Filter segmented buttons */}
                    <div className="flex bg-[#111] p-1 rounded-xl border border-[#1a1a1a] w-full">
                        {[
                            { key: 'all' as const, label: 'Tout' },
                            { key: 'auto' as const, label: 'IA active' },
                            { key: 'manual' as const, label: 'Manuel' },
                        ].map(b => {
                            const isActive = activeFilter === b.key;
                            return (
                                <button
                                    key={b.key}
                                    onClick={() => setActiveFilter(b.key)}
                                    className={`flex-1 py-1.5 text-center text-xs font-semibold rounded-lg transition-[transform,background-color,color] active:scale-95 duration-100 ${
                                        isActive ? 'bg-[#1a1a1a] text-white border border-white/5 shadow-sm' : 'text-[#888] hover:text-white'
                                    }`}
                                >
                                    {b.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" size={15} />
                        <input
                            type="text"
                            placeholder="Rechercher par nom ou numéro…"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-[#111] border border-[#1a1a1a] rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-[#00D97E]/40 transition-colors placeholder:text-[#555] outline-none"
                        />
                    </div>
                </div>

                {/* Chats list */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-hide bg-black">
                    {loadingChats ? (
                        <div className="space-y-2 p-2">
                            <ChatSkeleton />
                            <ChatSkeleton />
                            <ChatSkeleton />
                        </div>
                    ) : filteredChats.length === 0 ? (
                        <div className="p-8 text-center text-[#555] text-xs">
                            Aucune discussion trouvée.
                        </div>
                    ) : (
                        filteredChats.map((chat, i) => {
                            const isSelected = selectedChat?.id === chat.id;
                            const initials = chat.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                            const meta = getStateMeta(chat.state);
                            return (
                                <div key={chat.id} className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both" style={{ animationDuration: '400ms', animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                                    <button
                                        onClick={() => {
                                            setSelectedChat(chat);
                                            // Reset unread count locally for smooth UX
                                            setChats(prev => prev.map(c => c.id === chat.id ? { ...c, unreadCount: 0 } : c));
                                        }}
                                        className={`w-full text-left rounded-2xl p-4 flex gap-3 border transition-[transform,border-color,background-color] active:scale-[0.99] duration-100 cursor-pointer ${
                                            isSelected 
                                            ? 'bg-[#00D97E]/10 border-[#00D97E]/20' 
                                            : 'bg-[#111] border-[#1a1a1a] hover:border-[#00D97E]/20'
                                        }`}
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-[#00D97E]/10 border border-[#00D97E]/20 text-[#00D97E] font-bold flex items-center justify-center shrink-0 text-sm">
                                            {initials}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-baseline mb-1">
                                                <h3 className="font-bold text-white text-sm truncate">{chat.name}</h3>
                                                <span className="text-[10px] text-[#555] font-mono">
                                                    {new Date(chat.lastInteraction).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <p className="text-xs text-[#888] truncate pr-2 leading-relaxed">
                                                {chat.lastMessage || <span className="italic opacity-50">Pas de message</span>}
                                            </p>
                                            <div className="flex items-center gap-2 mt-2">
                                                {chat.autopilotEnabled ? (
                                                    <span className="flex items-center gap-1 text-[9px] bg-emerald-500/10 text-emerald-500 font-bold px-2 py-0.5 rounded border border-emerald-500/20 uppercase tracking-wider">
                                                        <Zap size={9} fill="currentColor" /> IA active
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-[9px] bg-zinc-500/10 text-[#888] font-bold px-2 py-0.5 rounded border border-zinc-500/20 uppercase tracking-wider">
                                                        Manuel
                                                    </span>
                                                )}
                                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${meta.color}`}>
                                                    {meta.label}
                                                </span>
                                                {chat.unreadCount > 0 && (
                                                    <span className="w-2.5 h-2.5 rounded-full bg-[#00D97E] ml-auto shrink-0 animate-pulse"></span>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Chat detail view panel */}
            {selectedChat ? (
                <div className="flex-1 flex flex-col bg-black w-full min-w-0 animate-in fade-in duration-200">
                    {/* Header */}
                    <div className="h-16 border-b border-[#1a1a1a] flex justify-between items-center px-4 md:px-6 bg-[#111] shrink-0">
                        <div className="flex items-center gap-3 min-w-0">
                            <button onClick={() => setSelectedChat(null)} aria-label="Retourner à la liste" className="md:hidden text-[#888] hover:text-white p-1 rounded-lg hover:bg-white/5 active:scale-90 transition-transform shrink-0">
                                <ArrowLeft size={20} aria-hidden="true" />
                            </button>
                            <div className="w-8 h-8 rounded-lg bg-[#00D97E]/10 flex items-center justify-center text-[#00D97E] font-bold text-xs shrink-0">
                                {selectedChat.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                                <h2 className="font-bold text-white text-sm truncate leading-none">{selectedChat.name}</h2>
                                <p className="text-[10px] text-[#555] font-mono mt-1 truncate">{selectedChat.id.split('@')[0]}</p>
                            </div>
                        </div>

                        {/* Autopilot toggle button/switch */}
                        <div className="flex items-center gap-3 shrink-0">
                            <button
                                onClick={toggleAutopilot}
                                className={`flex items-center gap-2 px-3 py-2 rounded-2xl border text-xs font-bold transition-[transform,background-color,border-color] active:scale-95 duration-100 ${
                                    selectedChat.autopilotEnabled
                                        ? 'bg-[#00D97E]/10 text-[#00D97E] border-[#00D97E]/20'
                                        : 'bg-zinc-800 text-[#888] border-zinc-700 hover:bg-zinc-700'
                                }`}
                            >
                                <Zap size={13} fill={selectedChat.autopilotEnabled ? 'currentColor' : 'none'} className={selectedChat.autopilotEnabled ? 'animate-pulse' : ''} />
                                <span className="text-[10px] tracking-wider uppercase font-bold hidden sm:inline">
                                    {selectedChat.autopilotEnabled ? 'IA Active' : 'Mode Manuel'}
                                </span>
                                <span className="text-[10px] tracking-wider uppercase font-bold sm:hidden">
                                    {selectedChat.autopilotEnabled ? 'IA' : 'Manuel'}
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* State banner */}
                    {(() => {
                        const meta = getStateMeta(selectedChat.state);
                        return (
                            <div className="py-2 px-4 bg-[#111]/40 border-b border-[#1a1a1a] flex items-center gap-2 shrink-0">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#00D97E] animate-ping shrink-0"></div>
                                <span className="text-[10px] text-[#555] font-medium">État du client :</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${meta.color}`}>
                                    {meta.label}
                                </span>
                            </div>
                        );
                    })()}

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-black scrollbar-hide">
                        {loadingMessages ? (
                            <div className="flex justify-center py-10">
                                <RefreshCw className="animate-spin text-[#00D97E]" />
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-[#555] opacity-50 space-y-2">
                                <MessageSquare size={40} className="text-[#333]" />
                                <p className="text-xs">Aucun message pour l'instant</p>
                            </div>
                        ) : (
                            messages.map((msg, idx) => {
                                const isBot = msg.role === 'model';
                                return (
                                    <div key={idx} className={`flex ${isBot ? 'justify-start' : 'justify-end'} items-end gap-1.5`}>
                                        {isBot && (
                                            <div className="w-6 h-6 rounded-lg bg-[#00D97E]/10 border border-[#00D97E]/20 text-[#00D97E] flex items-center justify-center shrink-0">
                                                <Bot size={12} />
                                            </div>
                                        )}
                                        <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                                            isBot
                                                ? 'bg-[#111] text-white border border-[#1a1a1a] rounded-tl-sm'
                                                : 'bg-[#00D97E] text-black font-medium rounded-tr-sm'
                                        }`}>
                                            <p className="whitespace-pre-wrap">{msg.parts.map(p => p.text).join('')}</p>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-4 border-t border-[#1a1a1a] bg-[#111] shrink-0">
                        <form onSubmit={handleSendMessage} className="flex gap-2">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={e => setNewMessage(e.target.value)}
                                placeholder={selectedChat.autopilotEnabled ? "Désactivez l'IA pour écrire manuellement…" : "Écrivez votre message…"}
                                className="flex-1 bg-black border border-[#1a1a1a] rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#00D97E]/40 focus:ring-0 transition-[border-color] placeholder:text-[#555] outline-none"
                                disabled={sending}
                            />
                            <button
                                type="submit"
                                disabled={sending || !newMessage.trim()}
                                aria-label="Envoyer le message"
                                className="bg-[#00D97E] hover:bg-[#00D97E]/90 disabled:opacity-50 disabled:cursor-not-allowed text-black rounded-2xl p-3 transition-[transform,background-color] active:scale-95 shadow-lg shadow-[#00D97E]/15 shrink-0 flex items-center justify-center w-11 h-11"
                            >
                                <Send size={16} aria-hidden="true" />
                            </button>
                        </form>
                        {selectedChat.autopilotEnabled && (
                            <p className="text-[10px] text-emerald-500/70 mt-2 flex items-center gap-1">
                                <Zap size={10} fill="currentColor" /> L'IA répondra automatiquement aux nouveaux messages de ce client.
                            </p>
                        )}
                    </div>
                </div>
            ) : (
                <div className="hidden md:flex flex-1 flex-col items-center justify-center text-[#888] space-y-4 bg-black">
                    <div className="w-16 h-16 bg-[#111] border border-[#1a1a1a] rounded-2xl flex items-center justify-center animate-pulse">
                        <MessageSquare size={30} className="text-[#00D97E]/50" />
                    </div>
                    <p className="text-xs font-semibold">Sélectionnez une discussion pour commencer</p>
                </div>
            )}
        </div>
    );
};

export default Inbox;
