import { Router } from 'express';
import { authenticateTenant } from '../middleware/auth';
import { db } from '../services/dbService';

const router = Router();

// GET all variation templates for a tenant (with system defaults)
router.get('/variation-templates', authenticateTenant, async (req, res) => {
    try {
        const tenantId = req.tenantId!;

        // System default templates (always available)
        const systemDefaults = [
            {
                id: 'system-taille',
                name: 'Taille',
                default_options: [
                    { value: 'XS', stock: 0, priceModifier: 0 },
                    { value: 'S', stock: 0, priceModifier: 0 },
                    { value: 'M', stock: 0, priceModifier: 0 },
                    { value: 'L', stock: 0, priceModifier: 0 },
                    { value: 'XL', stock: 0, priceModifier: 0 },
                    { value: 'XXL', stock: 0, priceModifier: 500 }
                ],
                isSystem: true
            },
            {
                id: 'system-couleur',
                name: 'Couleur',
                default_options: [
                    { value: 'Noir', stock: 0, priceModifier: 0 },
                    { value: 'Blanc', stock: 0, priceModifier: 0 },
                    { value: 'Rouge', stock: 0, priceModifier: 0 },
                    { value: 'Bleu', stock: 0, priceModifier: 0 },
                    { value: 'Vert', stock: 0, priceModifier: 0 }
                ],
                isSystem: true
            },
            {
                id: 'system-saveur',
                name: 'Saveur',
                default_options: [
                    { value: 'Chocolat', stock: 0, priceModifier: 0 },
                    { value: 'Vanille', stock: 0, priceModifier: 0 },
                    { value: 'Fraise', stock: 0, priceModifier: 0 },
                    { value: 'Citron', stock: 0, priceModifier: 0 }
                ],
                isSystem: true
            },
            {
                id: 'system-matiere',
                name: 'Matière',
                default_options: [
                    { value: 'Coton', stock: 0, priceModifier: 0 },
                    { value: 'Polyester', stock: 0, priceModifier: 0 },
                    { value: 'Soie', stock: 0, priceModifier: 1000 },
                    { value: 'Lin', stock: 0, priceModifier: 500 }
                ],
                isSystem: true
            }
        ];

        // Get custom templates from database
        const customTemplates = await db.getVariationTemplates(tenantId);

        // Merge: Custom templates first (by usage/date), then system defaults
        const allTemplates = [...customTemplates, ...systemDefaults];

        res.json(allTemplates);
    } catch (error: any) {
        console.error('[API] Get Variation Templates Error:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch templates' });
    }
});

// POST create/update a custom variation template
router.post('/variation-templates', authenticateTenant, async (req, res) => {
    try {
        const tenantId = req.tenantId!;
        const { name, default_options } = req.body;

        if (!name || !default_options) {
            return res.status(400).json({ error: 'Name and default_options required' });
        }

        const template = await db.saveVariationTemplate(tenantId, name, default_options);
        res.json(template);
    } catch (error: any) {
        console.error('[API] Save Variation Template Error:', error);
        res.status(500).json({ error: error.message || 'Failed to save template' });
    }
});

export default router;
