import { useState, useRef, useEffect } from 'react';
import { Send, Trash2, Smartphone, Bot } from 'lucide-react';

export default function AIPlayground() {
    const [messages, setMessages] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

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

        const token = localStorage.getItem('token');
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
                setMessages(prev => [...prev, { role: 'model', text: data.response || '...' }]);
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
        const token = localStorage.getItem('token');
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
        <div className="bg-black border border-zinc-800 rounded-2xl overflow-hidden flex flex-col h-[500px] shadow-2xl relative">
            {/* Header */}
            <div className="bg-zinc-900 border-b border-zinc-800 p-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg shadow-lg shadow-orange-500/20">
                        <Smartphone size={18} className="text-white" />
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-sm tracking-tight">Simulateur WhatsApp</h3>
                        <p className="text-zinc-500 text-[10px] uppercase tracking-wide">Test direct avec votre cerveau IA</p>
                    </div>
                </div>
                <button
                    onClick={handleReset}
                    className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
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
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 relative z-10 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-50">
                        <Bot size={48} className="text-zinc-600 mb-4" />
                        <p className="text-zinc-500 text-sm">Envoyez un message pour commencer à discuter avec votre vendeur IA.</p>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm ${msg.role === 'user'
                            ? 'bg-emerald-600 text-white rounded-tr-none'
                            : 'bg-zinc-800 text-zinc-200 rounded-tl-none border border-zinc-700'
                            }`}>
                            {msg.text.split('\n').map((line, j) => (
                                <p key={j} className="min-h-[1em]">{line}</p>
                            ))}
                            <span className="text-[10px] opacity-50 block text-right mt-1">
                                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    </div>
                ))}

                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-zinc-800 rounded-2xl rounded-tl-none px-4 py-3 border border-zinc-700">
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
            <form onSubmit={handleSend} className="p-3 bg-zinc-900 border-t border-zinc-800 flex gap-2 relative z-10">
                <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Tapez un message..."
                    className="flex-1 bg-black border border-zinc-700 rounded-full px-4 py-2 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none placeholder:text-zinc-600 text-sm"
                />
                <button
                    type="submit"
                    disabled={!input.trim() || loading}
                    className="w-10 h-10 flex items-center justify-center bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-black rounded-full transition-all shadow-lg shadow-emerald-500/20"
                >
                    <Send size={18} className={loading ? 'opacity-0' : 'ml-0.5'} />
                </button>
            </form>
        </div>
    );
}
