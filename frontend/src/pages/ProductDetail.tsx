
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Trash2, Image as ImageIcon, X, Plus } from 'lucide-react';
import { supabase } from '../supabaseClient';

const ProductDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [product, setProduct] = useState<any>({
        name: '',
        price: '',
        stock: '',
        description: '',
        images: []
    });

    useEffect(() => {
        const fetchProduct = async () => {
            try {
                // We can reuse the products API or fetch a single one. 
                // For now, let's fetch all and find (not efficient but easiest given current API)
                // OR better, let's assume/make a GET /api/products/:id endpoint.
                // The backend likely supports it if I check dbService, but let's double check route.
                // Actually, I'll fetch list and find for now to be safe, or update backend.
                // Wait, I implemented DELETE /api/products/:id and PUT /api/products/:id
                // I should check if GET /api/products/:id exists.
                // Assuming it might NOT, I'll try to fetch from /api/products and filter.

                const res = await fetch('/api/products');
                const data = await res.json();
                const found = data.find((p: any) => p.id === id);
                if (found) {
                    setProduct({
                        ...found,
                        images: found.images || []
                    });
                } else {
                    navigate('/dashboard/products');
                }
            } catch (error) {
                console.error('Failed to fetch product', error);
            } finally {
                setLoading(false);
            }
        };

        if (id) fetchProduct();
    }, [id, navigate]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await fetch(`/api/products/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...product,
                    price: Number(product.price),
                    stock: Number(product.stock)
                })
            });
            alert('Produit mis à jour !');
        } catch (error) {
            console.error('Error updating product', error);
            alert('Erreur lors de la mise à jour');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Voulez-vous vraiment supprimer ce produit ?')) return;
        try {
            await fetch(`/api/products/${id}`, { method: 'DELETE' });
            navigate('/dashboard/products');
        } catch (error) {
            console.error('Error deleting product', error);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;

        const files = Array.from(e.target.files);
        const newImages = [];

        try {
            for (const file of files) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Math.random()}.${fileExt}`;
                const { error } = await supabase.storage
                    .from('product-images')
                    .upload(fileName, file);

                if (error) throw error;

                const { data: { publicUrl } } = supabase.storage
                    .from('product-images')
                    .getPublicUrl(fileName);

                newImages.push(publicUrl);
            }

            setProduct({
                ...product,
                images: [...product.images, ...newImages]
            });
        } catch (error) {
            console.error('Upload failed', error);
            alert('Erreur upload');
        }
    };

    if (loading) return <div className="text-white p-8">Chargement...</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => navigate('/dashboard/products')}
                    className="flex items-center text-slate-400 hover:text-white transition-colors"
                >
                    <ArrowLeft className="mr-2" size={20} />
                    Retour aux produits
                </button>
                <div className="flex space-x-3">
                    <button
                        onClick={handleDelete}
                        className="flex items-center px-4 py-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors"
                    >
                        <Trash2 size={18} className="mr-2" />
                        Supprimer
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/20"
                    >
                        <Save size={18} className="mr-2" />
                        {saving ? 'Enregistrement...' : 'Enregistrer'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Left Column - Images */}
                <div className="md:col-span-1 space-y-4">
                    <div className="aspect-square bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 relative group">
                        {product.images?.[0] ? (
                            <img
                                src={product.images[0]}
                                alt={product.name}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-500">
                                <ImageIcon size={48} />
                            </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <label className="cursor-pointer bg-white/10 backdrop-blur-md text-white px-4 py-2 rounded-lg hover:bg-white/20 transition-colors">
                                Changer la couverture
                                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                            </label>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        {product.images?.slice(1).map((img: string, idx: number) => (
                            <div key={idx} className="aspect-square bg-slate-800 rounded-lg overflow-hidden relative group">
                                <img src={img} alt="" className="w-full h-full object-cover" />
                                <button
                                    onClick={() => setProduct({
                                        ...product,
                                        images: product.images.filter((_: any, i: number) => i !== idx + 1)
                                    })}
                                    className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        ))}
                        <label className="aspect-square bg-slate-800/50 border-2 border-dashed border-slate-700 rounded-lg flex items-center justify-center cursor-pointer hover:border-indigo-500 hover:bg-slate-800 transition-all text-slate-500 hover:text-white">
                            <Plus size={24} />
                            <input type="file" className="hidden" multiple accept="image/*" onChange={handleImageUpload} />
                        </label>
                    </div>
                </div>

                {/* Right Column - Details Form */}
                <div className="md:col-span-2 bg-slate-800 rounded-2xl border border-slate-700 p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Nom du produit</label>
                        <input
                            type="text"
                            value={product.name}
                            onChange={e => setProduct({ ...product, name: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:border-indigo-500 outline-none text-lg font-bold"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Prix (FCFA)</label>
                            <input
                                type="number"
                                value={product.price}
                                onChange={e => setProduct({ ...product, price: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:border-indigo-500 outline-none font-mono"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Stock disponible</label>
                            <input
                                type="number"
                                value={product.stock}
                                onChange={e => setProduct({ ...product, stock: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:border-indigo-500 outline-none font-mono"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Description détaillée</label>
                        <textarea
                            value={product.description}
                            onChange={e => setProduct({ ...product, description: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white focus:border-indigo-500 outline-none min-h-[200px] leading-relaxed"
                            placeholder="Décrivez votre produit..."
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductDetail;
