
import { useState, useRef, useEffect } from 'react';
import { Send, Trash2, Smartphone, Bot } from 'lucide-react';
import { getApiUrl } from '../utils/apiConfig';
import { useAuth } from '../context/AuthContext';

interface Message {
    role: 'user' | 'model';
    text: string;
    images?: string[];
}

export default function AIPlayground() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const API_URL = getApiUrl();
    const { token } = useAuth();

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || loading) return;

        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setLoading(true);

        if (!token) {
            setMessages(prev => [...prev, { role: 'model', text: '⚠️ Vous devez être connecté pour tester le bot.' }]);
            setLoading(false);
            return;
        }

        try {
            const res = await fetch(`${API_URL}/ai/simulate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ message: userMsg, sessionId: 'playground-session' })
            });

            if (res.ok) {
                const data = await res.json();
                setMessages(prev => [...prev, {
                    role: 'model',
                    text: data.response || '...',
                    images: data.images || []
                }]);
            } else {
                setMessages(prev => [...prev, { role: 'model', text: '❌ Erreur serveur' }]);
            }
        } catch (err) {
            console.error(err);
            setMessages(prev => [...prev, { role: 'model', text: '❌ Erreur connexion' }]);
        } finally {
            setLoading(false);
        }
    };

    const handleReset = async () => {
        if (!token) return;

        try {
            await fetch(`${API_URL}/ai/reset`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ sessionId: 'playground-session' })
            });
            setMessages([]);
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl overflow-hidden flex flex-col h-[500px] shadow-2xl relative">
            {/* Header */}
            <div className="bg-[#111] border-b border-[#1a1a1a] p-4 flex justify-between items-center z-20">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-[#00D97E] to-[#0EA5E9] rounded-lg shadow-lg shadow-[#00D97E]/10">
                        <Smartphone size={18} className="text-white" />
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-sm tracking-tight">Simulateur WhatsApp</h3>
                        <p className="text-[#888] text-[10px] uppercase tracking-wide">Test direct avec votre cerveau IA</p>
                    </div>
                </div>
                <button
                    onClick={handleReset}
                    className="p-2 text-[#888] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                    title="Effacer la conversation"
                >
                    <Trash2 size={16} />
                </button>
            </div>

            {/* Wallpaper pattern */}
            <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
            </div>

            {/* Chat Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 relative z-10 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-50">
                        <Bot size={48} className="text-[#555] mb-4" />
                        <p className="text-[#888] text-sm">Envoyez un message pour commencer à discuter avec votre vendeur IA.</p>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm ${msg.role === 'user'
                            ? 'bg-gradient-to-r from-[#00D97E] to-[#0EA5E9] text-white rounded-tr-none shadow-[#00D97E]/10'
                            : 'bg-[#111] text-zinc-200 rounded-tl-none border border-[#1a1a1a]'
                            }`}>
                            {/* Afficher les images si présentes */}
                            {msg.images && msg.images.length > 0 && (
                                <div className="mb-3 grid gap-2" style={{
                                    gridTemplateColumns: msg.images.length === 1 ? '1fr' : 'repeat(2, 1fr)'
                                }}>
                                    {msg.images.map((imgUrl, imgIdx) => (
                                        <img
                                            key={imgIdx}
                                            src={imgUrl}
                                            alt={`Product ${imgIdx + 1}`}
                                            className="rounded-lg w-full h-auto object-cover max-h-32 cursor-pointer hover:opacity-90 transition-opacity border border-[#1a1a1a]"
                                            onClick={() => window.open(imgUrl, '_blank')}
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none';
                                            }}
                                        />
                                    ))}
                                </div>
                            )}
                            {msg.text.split('\n').map((line, j) => (
                                <p key={j} className="min-h-[1em]">
                                    {line.replace(/\*\*/g, '')}
                                </p>
                            ))}
                            <span className="text-[10px] opacity-50 block text-right mt-1">
                                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    </div>
                ))}

                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-[#111] rounded-2xl rounded-tl-none px-4 py-3 border border-[#1a1a1a]">
                            <div className="flex gap-1.5">
                                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <form onSubmit={handleSend} className="p-3 bg-[#111] border-t border-[#1a1a1a] flex gap-2 relative z-10">
                <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Tapez un message..."
                    className="flex-1 bg-white/5 border border-[#1a1a1a] rounded-full px-4 py-2 text-white focus:border-[#00D97E] focus:ring-1 focus:ring-[#00D97E] outline-none placeholder:text-[#555] text-sm"
                />
                <button
                    type="submit"
                    disabled={!input.trim() || loading}
                    className="w-10 h-10 flex items-center justify-center bg-gradient-to-r from-[#00D97E] to-[#0EA5E9] hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 text-white rounded-full transition-all shadow-lg shadow-[#00D97E]/10"
                >
                    <Send size={18} className={loading ? 'opacity-0' : 'ml-0.5'} />
                </button>
            </form>
        </div>
    );
}
