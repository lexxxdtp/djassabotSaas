import { useState } from 'react';
import { Trash2, Minus, Plus, Layers, Infinity as InfinityIcon, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import type { Product, ProductVariation, VariationOption } from '../../types';
import { apiClient } from '../../utils/apiClient';

interface ProductCardProps {
    product: Product;
    onEdit: (product: Product) => void;
    onDelete: (id: string) => void;
    onUpdate: (product: Product) => void;
}

export default function ProductCard({ product, onDelete, onUpdate }: ProductCardProps) {
    const [savingStock, setSavingStock] = useState(false);
    const activeVariations = product.variations?.filter((v: ProductVariation) => v.name?.trim() && v.options?.length) || [];
    const hasVariations = activeVariations.length > 0;
    const displayStock = hasVariations ? activeVariations.reduce((total, variation) => total + variation.options.reduce((sum: number,opt: VariationOption) => sum + (opt.stock || 0),0),0) : product.stock || 0;
    const unlimited = product.manageStock === false;
    const out = !unlimited && displayStock <= 0;
    const target = `/dashboard/products/${product.id}`;

    const changeStock = async (delta: number) => {
        if (savingStock) return;
        setSavingStock(true);
        const next = Math.max(0,product.stock + delta);
        try {
            const res = await apiClient(`/products/${product.id}`, { method: 'PUT', body: JSON.stringify({stock: next}) });
            if (!res.ok) throw new Error('Stock non enregistré');
            onUpdate({...product,stock:next});
        } catch {
            toast.error('Le stock n’a pas été modifié. Réessayez.');
        } finally { setSavingStock(false); }
    };

    return <article className="product-card">
        <Link to={target} className="product-card-photo" aria-label={`Voir ${product.name}`}>
            {product.images?.[0] ? <img src={product.images[0]} alt={product.name} loading="lazy" /> : <span className="w-full h-full grid place-items-center text-[var(--color-muted)]"><Layers size={30} strokeWidth={1.25} aria-hidden="true" /></span>}
        </Link>
        <div className="product-card-body">
            <Link to={target} className="product-card-name">{product.name}</Link>
            <p className="product-card-price">{Number(product.price).toLocaleString('fr-FR')} <span className="text-[var(--color-muted)] text-xs font-normal">FCFA</span></p>
            <p className="product-card-stock" data-out={out}>{unlimited ? <><InfinityIcon size={13} aria-hidden="true" />Stock non suivi</> : out ? 'Rupture de stock' : `${displayStock} en stock`}</p>
            <div className="product-card-footer">
                {hasVariations ? <Link to={target} className="app-text-link">{activeVariations.length} variante{activeVariations.length > 1 ? 's' : ''}<ArrowUpRight size={14} aria-hidden="true" /></Link> : unlimited ? <Link to={target} className="app-text-link">Modifier<ArrowUpRight size={14} aria-hidden="true" /></Link> : <div className="product-card-stepper"><button onClick={() => changeStock(-1)} disabled={savingStock || displayStock <= 0} aria-label={`Retirer une unité de ${product.name}`}><Minus size={15} aria-hidden="true" /></button><span aria-live="polite">{savingStock ? '…' : product.stock}</span><button onClick={() => changeStock(1)} disabled={savingStock} aria-label={`Ajouter une unité de ${product.name}`}><Plus size={15} aria-hidden="true" /></button></div>}
                <button onClick={() => onDelete(product.id)} aria-label={`Supprimer ${product.name}`} className="text-[var(--color-muted)] hover:text-red-300 grid place-items-center"><Trash2 size={15} aria-hidden="true" /></button>
            </div>
        </div>
    </article>;
}
