// backend/src/routes/suppliers.js
import express from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { sendPurchaseOrderToEmployee, sendPurchaseOrderToSupplier } from '../services/emailService.js';

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Route de test pour vérifier l'envoi d'email
router.post('/test-email', async (req, res) => {
  try {
    const { email, name } = req.body;
    console.log('🧪 Test email vers:', email);
    
    if (!email) {
      return res.status(400).json({ message: 'Email requis' });
    }
    
    const success = await sendPurchaseOrderToSupplier(
      email, 
      name || 'Fournisseur Test', 
      { 
        orderNumber: 'TEST-001',
        orderDate: new Date(),
        totalAmount: 100,
        discountAmount: 0,
        supplier: { name: name || 'Test' },
        items: [
          { product: { name: 'Produit Test' }, quantity: 1, unitPrice: 100 }
        ]
      }
    );
    
    if (success) {
      res.json({ message: 'Email envoyé avec succès' });
    } else {
      res.status(500).json({ message: 'Échec envoi email - vérifiez les logs serveur' });
    }
  } catch (error) {
    console.error('❌ Erreur test email:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Middleware pour vérifier si l'utilisateur est admin
const verifyAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Token manquant' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { role: true, isActive: true }
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'EMPLOYE')) {
      return res.status(403).json({ message: 'Accès refusé' });
    }
    
    if (!user.isActive) {
      return res.status(403).json({ message: 'Compte désactivé' });
    }

    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token invalide' });
  }
};

// ============ ROUTES FOURNISSEURS ============

// GET /api/admin/suppliers - Récupérer tous les fournisseurs
router.get('/suppliers', verifyAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, active } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }
    if (active !== undefined) {
      where.active = active === 'true';
    }

    // Récupérer les fournisseurs avec le comptage des produits
    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        include: {
          products: {
            select: { productId: true }  // Pour compter les produits
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take
      }),
      prisma.supplier.count({ where })
    ]);

    // Ajouter le comptage des produits manuellement
    const suppliersWithCount = suppliers.map(supplier => ({
      ...supplier,
      _count: {
        products: supplier.products.length
      },
      products: undefined // Retirer la liste des produits pour la réponse
    }));

    res.json({
      suppliers: suppliersWithCount,
      pagination: {
        page: parseInt(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take)
      }
    });
  } catch (error) {
    console.error('Get suppliers error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /api/admin/suppliers/stats - Statistiques globales des fournisseurs
router.get('/suppliers/stats', verifyAdmin, async (req, res) => {
  try {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    
    const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const lastYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    const currentMonthPurchases = await prisma.supplierPurchase.findMany({
      where: { month: currentMonth, year: currentYear }
    });
    const currentMonthTotal = currentMonthPurchases.reduce((sum, p) => sum + p.amount, 0);

    const lastMonthPurchases = await prisma.supplierPurchase.findMany({
      where: { month: lastMonth, year: lastYear }
    });
    const lastMonthTotal = lastMonthPurchases.reduce((sum, p) => sum + p.amount, 0);

    const allPurchases = await prisma.supplierPurchase.findMany();
    const totalGeneral = allPurchases.reduce((sum, p) => sum + p.amount, 0);

    const pendingValidation = await prisma.purchaseOrder.findMany({
      where: { status: 'VALIDATION_ATTENTE' },
      include: { supplier: true },
      orderBy: { orderDate: 'desc' }
    });

    const suppliers = await prisma.supplier.findMany({
      where: { active: true, seuilRemise: { gt: 0 } }
    });

    const thresholdAlerts = [];
    for (const supplier of suppliers) {
      const supplierPurchases = await prisma.supplierPurchase.findMany({
        where: { supplierId: supplier.id, month: currentMonth, year: currentYear }
      });
      const supplierMonthTotal = supplierPurchases.reduce((sum, p) => sum + p.amount, 0);
      
      if (supplierMonthTotal >= supplier.seuilRemise * 0.8) {
        thresholdAlerts.push({
          supplier: supplier.name,
          currentAmount: supplierMonthTotal,
          threshold: supplier.seuilRemise,
          percentage: Math.round((supplierMonthTotal / supplier.seuilRemise) * 100),
          discountPercentage: supplier.pourcentageRemiseSeuil
        });
      }
    }

    res.json({
      summary: { currentMonthTotal, lastMonthTotal, totalGeneral },
      pendingValidation,
      thresholdAlerts
    });
  } catch (error) {
    console.error('Get suppliers stats error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /api/admin/suppliers/:id - Récupérer un fournisseur
router.get('/suppliers/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const supplier = await prisma.supplier.findUnique({
      where: { id }
    });

    if (!supplier) {
      return res.status(404).json({ message: 'Fournisseur non trouvé' });
    }

    res.json({ supplier });
  } catch (error) {
    console.error('Get supplier error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// POST /api/admin/suppliers - Créer un fournisseur
router.post('/suppliers', verifyAdmin, async (req, res) => {
  try {
    const { name, contactName, email, phone, address, website, description, active, deliveryDays, paymentTerms, autoDiscount } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Le nom du fournisseur est requis' });
    }

    const supplier = await prisma.supplier.create({
      data: {
        name,
        contactName: contactName || null,
        email: email || null,
        phone: phone || null,
        address: address || null,
        website: website || null,
        description: description || null,
        deliveryDays: deliveryDays || 3,
        paymentTerms: paymentTerms || null,
        autoDiscount: autoDiscount ? parseFloat(autoDiscount) : null,
        active: active !== undefined ? active : true
      }
    });

    res.status(201).json({ message: 'Fournisseur créé avec succès', supplier });
  } catch (error) {
    console.error('Create supplier error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Ce fournisseur existe déjà' });
    }
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// PUT /api/admin/suppliers/:id - Modifier un fournisseur
router.put('/suppliers/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, contactName, email, phone, address, website, description, active, deliveryDays, paymentTerms, autoDiscount } = req.body;

    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(contactName !== undefined && { contactName }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
        ...(website !== undefined && { website }),
        ...(description !== undefined && { description }),
        ...(deliveryDays !== undefined && { deliveryDays: parseInt(deliveryDays) }),
        ...(paymentTerms !== undefined && { paymentTerms }),
        ...(autoDiscount !== undefined && { autoDiscount: autoDiscount ? parseFloat(autoDiscount) : null }),
        ...(active !== undefined && { active })
      }
    });

    res.json({ message: 'Fournisseur modifié avec succès', supplier });
  } catch (error) {
    console.error('Update supplier error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// DELETE /api/admin/suppliers/:id - Supprimer un fournisseur
router.delete('/suppliers/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: { products: true }
    });

    if (!supplier) {
      return res.status(404).json({ message: 'Fournisseur non trouvé' });
    }

    if (supplier.products.length > 0) {
      return res.status(400).json({ 
        message: `Impossible de supprimer, ${supplier.products.length} produit(s) lié(s) à ce fournisseur` 
      });
    }

    await prisma.supplier.delete({ where: { id } });

    res.json({ message: 'Fournisseur supprimé avec succès' });
  } catch (error) {
    console.error('Delete supplier error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /api/admin/suppliers/:id/products - Produits d'un fournisseur
router.get('/suppliers/:id/products', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const products = await prisma.productSupplier.findMany({
      where: { supplierId: id },
      include: {
        product: {
          include: {
            category: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(products);
  } catch (error) {
    console.error('Get supplier products error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /api/admin/products - Liste de tous les produits (pour picker dans fournisseurs)
router.get('/products', verifyAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 1000, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where = { active: true };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          suppliers: true
        },
        orderBy: { name: 'asc' },
        skip,
        take
      }),
      prisma.product.count({ where })
    ]);

    res.json({
      products,
      pagination: {
        page: parseInt(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take)
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// POST /api/admin/suppliers/:id/link-product - Lier un produit à un fournisseur
router.post('/suppliers/:id/link-product', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { productId, price, reference } = req.body;

    if (!productId || price === undefined) {
      return res.status(400).json({ message: 'ID du produit et prix d\'achat requis' });
    }

    const productSupplier = await prisma.productSupplier.upsert({
      where: {
        productId_supplierId: {
          productId,
          supplierId: id
        }
      },
      create: {
        productId,
        supplierId: id,
        price,
        reference
      },
      update: {
        price,
        reference
      },
      include: {
        product: true,
        supplier: true
      }
    });

    res.json({ message: 'Produit lié avec succès', productSupplier });
  } catch (error) {
    console.error('Link product error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// DELETE /api/admin/suppliers/:id/unlink-product/:productId - Délier un produit
router.delete('/suppliers/:id/unlink-product/:productId', verifyAdmin, async (req, res) => {
  try {
    const { id, productId } = req.params;

    await prisma.productSupplier.delete({
      where: {
        productId_supplierId: {
          productId,
          supplierId: id
        }
      }
    });

    res.json({ message: 'Produit délié avec succès' });
  } catch (error) {
    console.error('Unlink product error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// ============ ROUTES BONS DE COMMANDE ============

// GET /api/admin/purchase-orders - Liste des bons de commande
router.get('/purchase-orders', verifyAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, supplierId, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where = {};
    if (status) where.status = status;
    if (supplierId) where.supplierId = supplierId;
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { supplier: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        include: {
          supplier: true,
          items: {
            include: {
              product: true
            }
          }
        },
        orderBy: { orderDate: 'desc' },
        skip,
        take
      }),
      prisma.purchaseOrder.count({ where })
    ]);

    res.json({
      orders,
      pagination: {
        page: parseInt(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take)
      }
    });
  } catch (error) {
    console.error('Get purchase orders error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// POST /api/admin/purchase-orders - Créer un bon de commande
router.post('/purchase-orders', verifyAdmin, async (req, res) => {
  try {
    const { supplierId, items, notes, expectedDate } = req.body;

    if (!supplierId || !items || items.length === 0) {
      return res.status(400).json({ message: 'Fournisseur et produits requis' });
    }

    const existingOrder = await prisma.purchaseOrder.findFirst({
      where: {
        supplierId,
        status: { in: ['BROUILLON', 'ENVOYÉ', 'VALIDATION_ATTENTE'] }
      }
    });

    if (existingOrder) {
      return res.status(409).json({ 
        message: 'Un bon existe déjà pour ce fournisseur. Veuillez modifier l\'existant ou annuler le précédent.' 
      });
    }

    // Générer le numéro de bon : BCOM-AAAA-MM-JJ-XXXX
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    // Compter les bons du jour pour le numéro séquentiel
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const countToday = await prisma.purchaseOrder.count({
      where: {
        orderDate: { gte: todayStart, lt: todayEnd }
      }
    });
    const seq = String(countToday + 1).padStart(4, '0');
    const orderNumber = `BCOM-${year}-${month}-${day}-${seq}`;

    // Calculer le total
    let totalAmount = 0;
    for (const item of items) {
      totalAmount += item.quantity * item.unitPrice;
    }

    // Récupérer le fournisseur pour vérifier les remises
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId }
    });

    // Appliquer la remise automatique si définie
    let discountAmount = 0;
    let finalStatus = 'BROUILLON';
    
    if (supplier?.autoDiscount && supplier.autoDiscount > 0 && totalAmount > 0) {
      discountAmount = (totalAmount * supplier.autoDiscount) / 100;
    }

    // Si montant > 1000€, passer en VALIDATION_ATTENTE
    const MONTANT_VALIDATION = 1000;
    if (totalAmount > MONTANT_VALIDATION) {
      finalStatus = 'VALIDATION_ATTENTE';
    }

    const order = await prisma.purchaseOrder.create({
      data: {
        orderNumber,
        supplierId,
        totalAmount,
        discountAmount,
        status: finalStatus,
        notes,
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        items: {
          create: items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice
          }))
        }
      },
      include: {
        supplier: true,
        items: {
          include: {
            product: true
          }
        }
      }
    });

    res.status(201).json({ message: 'Bon de commande créé', order });
  } catch (error) {
    console.error('Create purchase order error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// PUT /api/admin/purchase-orders/:id/receive - Réceptionner une commande
router.put('/purchase-orders/:id/receive', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { items } = req.body;

    const order = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        items: true,
        supplier: true
      }
    });

    if (!order) {
      return res.status(404).json({ message: 'Bon de commande non trouvé' });
    }

    const updatedItems = [];
    let allReceived = true;

    for (const orderItem of order.items) {
      const received = items?.find(i => i.itemId === orderItem.id)?.receivedQty || orderItem.quantity;
      
      if (received < orderItem.quantity) {
        allReceived = false;
      }

      updatedItems.push({
        where: { id: orderItem.id },
        data: {
          receivedQty: received,
          expiryDate: items?.find(i => i.itemId === orderItem.id)?.expiryDate 
            ? new Date(items.find(i => i.itemId === orderItem.id).expiryDate)
            : null
        }
      });

      await prisma.stockMovement.create({
        data: {
          productId: orderItem.productId,
          type: 'PURCHASE',
          quantity: received,
          reason: `Réception commande ${order.orderNumber}`
        }
      });

      await prisma.product.update({
        where: { id: orderItem.productId },
        data: {
          stock: {
            increment: received
          }
        }
      });
    }

    for (const update of updatedItems) {
      await prisma.purchaseOrderItem.update(update);
    }

    const newStatus = allReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED';

    const updatedOrder = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: newStatus,
        receivedDate: allReceived ? new Date() : null,
        paidAmount: order.totalAmount
      },
      include: {
        supplier: true,
        items: {
          include: {
            product: true
          }
        }
      }
    });

    await prisma.supplierPurchase.create({
      data: {
        supplierId: order.supplierId,
        purchaseOrderId: order.id,
        amount: order.totalAmount,
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear()
      }
    });

    res.json({ message: 'Commande réceptionnée', order: updatedOrder });
  } catch (error) {
    console.error('Receive order error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// POST /api/admin/purchase-orders/:id/send - Envoyer la commande au fournisseur
router.post('/purchase-orders/:id/send', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier le bon de commande
    const existingOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { supplier: true, items: { include: { product: true } } }
    });

    if (!existingOrder) {
      return res.status(404).json({ message: 'Bon de commande introuvable' });
    }

    if (existingOrder.status === 'ENVOYÉ') {
      return res.status(400).json({ message: 'Bon déjà envoyé' });
    }

    if (existingOrder.status === 'REÇU_TOTAL' || existingOrder.status === 'REÇU_PARTIEL') {
      return res.status(400).json({ message: 'Bon déjà réceptionné' });
    }

    if (existingOrder.status === 'ANNULÉ') {
      return res.status(400).json({ message: 'Bon annulé' });
    }

    // Vérifier si un Employé peut envoyer (montant <= 1000€)
    const MONTANT_VALIDATION = 1000;
    if (req.userRole === 'EMPLOYE' && existingOrder.totalAmount > MONTANT_VALIDATION) {
      return res.status(403).json({ message: 'Montant supérieur à 1000 DH. Validation Admin requise.' });
    }

    // Mettre à jour le statut et la date d'envoi
    const order = await prisma.purchaseOrder.update({
      where: { id },
      data: { 
        status: 'ENVOYÉ',
        sentDate: new Date()
      },
      include: {
        supplier: true,
        items: {
          include: {
            product: true
          }
        }
      }
    });

    // Envoyer email à l'employé (uniquement si email valide)
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { email: true, firstName: true, lastName: true }
    });

    if (user?.email && user.email.includes('@') && !user.email.endsWith('@parapharmacie.ma')) {
      const userName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Employé';
      await sendPurchaseOrderToEmployee(user.email, userName, order);
    }

    // Envoyer email au fournisseur avec PDF
    console.log(`📧 Tentative envoi email fournisseur:`);
    console.log(`   - Email: ${order.supplier?.email}`);
    console.log(`   - Nom: ${order.supplier?.name}`);
    console.log(`   - OrderNumber: ${order.orderNumber}`);

    if (order.supplier?.email && order.supplier.email.includes('@')) {
      const emailSent = await sendPurchaseOrderToSupplier(order.supplier.email, order.supplier.name, order);
      if (emailSent) {
        console.log(`✅ Email envoyé avec succès au fournisseur`);
      } else {
        console.warn(`⚠️ Échec envoi email au fournisseur`);
      }
    } else {
      console.log(`⚠️ Email fournisseur manquant ou invalide`);
    }

    res.json({ message: 'Bon de commande envoyé', order });
  } catch (error) {
    console.error('Send order error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// DELETE /api/admin/purchase-orders/:id - Supprimer un bon de commande
router.delete('/purchase-orders/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.purchaseOrder.findUnique({
      where: { id }
    });

    if (order && order.status !== 'PENDING') {
      return res.status(400).json({ message: 'Impossible de supprimer une commande déjà envoyée ou réceptionnée' });
    }

    await prisma.purchaseOrder.delete({
      where: { id }
    });

    res.json({ message: 'Bon de commande supprimé' });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// ============ ROUTES REMISES FOURNISSEURS ============

// GET /api/admin/suppliers/:id/discounts - Liste des remises d'un fournisseur
router.get('/suppliers/:id/discounts', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const discounts = await prisma.supplierDiscount.findMany({
      where: { supplierId: id },
      orderBy: { createdAt: 'desc' }
    });

    res.json(discounts);
  } catch (error) {
    console.error('Get discounts error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// POST /api/admin/suppliers/:id/discounts - Créer une remise
router.post('/suppliers/:id/discounts', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, discountType, discountValue, minAmount, maxDiscount, endDate } = req.body;

    if (!name || discountValue === undefined) {
      return res.status(400).json({ message: 'Nom et valeur de la remise requis' });
    }

    const discount = await prisma.supplierDiscount.create({
      data: {
        supplierId: id,
        name,
        discountType: discountType || 'PERCENTAGE',
        discountValue,
        minAmount: minAmount || 0,
        maxDiscount,
        endDate: endDate ? new Date(endDate) : null
      }
    });

    res.status(201).json({ message: 'Remise créée', discount });
  } catch (error) {
    console.error('Create discount error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// PUT /api/admin/discounts/:id - Modifier une remise
router.put('/discounts/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, discountType, discountValue, minAmount, maxDiscount, endDate, active } = req.body;

    const discount = await prisma.supplierDiscount.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(discountType && { discountType }),
        ...(discountValue !== undefined && { discountValue }),
        ...(minAmount !== undefined && { minAmount }),
        ...(maxDiscount !== undefined && { maxDiscount }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(active !== undefined && { active })
      }
    });

    res.json({ message: 'Remise modifiée', discount });
  } catch (error) {
    console.error('Update discount error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// DELETE /api/admin/discounts/:id - Supprimer une remise
router.delete('/discounts/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.supplierDiscount.delete({
      where: { id }
    });

    res.json({ message: 'Remise supprimée' });
  } catch (error) {
    console.error('Delete discount error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /api/admin/suppliers/:id/purchases - Historique des achats
router.get('/suppliers/:id/purchases', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { month, year } = req.query;

    const where = { supplierId: id };
    if (month && year) {
      where.month = parseInt(month);
      where.year = parseInt(year);
    }

    const purchases = await prisma.supplierPurchase.findMany({
      where,
      include: {
        purchaseOrder: true,
        discount: true
      },
      orderBy: { purchaseDate: 'desc' }
    });

    const totalSpent = purchases.reduce((sum, p) => sum + p.amount, 0);
    const totalDiscount = purchases.reduce((sum, p) => sum + p.discountApplied, 0);

    res.json({
      purchases,
      summary: {
        totalSpent,
        totalDiscount,
        orderCount: purchases.length
      }
    });
  } catch (error) {
    console.error('Get purchases error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /api/admin/suppliers/stats - Statistiques globales des fournisseurs
router.get('/suppliers/stats', verifyAdmin, async (req, res) => {
  try {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    
    // Mois dernier
    const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const lastYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    // Achats du mois en cours
    const currentMonthPurchases = await prisma.supplierPurchase.findMany({
      where: { month: currentMonth, year: currentYear }
    });
    const currentMonthTotal = currentMonthPurchases.reduce((sum, p) => sum + p.amount, 0);

    // Achats du mois dernier
    const lastMonthPurchases = await prisma.supplierPurchase.findMany({
      where: { month: lastMonth, year: lastYear }
    });
    const lastMonthTotal = lastMonthPurchases.reduce((sum, p) => sum + p.amount, 0);

    // Total général
    const allPurchases = await prisma.supplierPurchase.findMany();
    const totalGeneral = allPurchases.reduce((sum, p) => sum + p.amount, 0);

    // Bons en attente de validation
    const pendingValidation = await prisma.purchaseOrder.findMany({
      where: { status: 'VALIDATION_ATTENTE' },
      include: { supplier: true },
      orderBy: { orderDate: 'desc' }
    });

    // Alertes : seuils de remise bientôt atteints
    const suppliers = await prisma.supplier.findMany({
      where: { 
        active: true,
        seuilRemise: { gt: 0 }
      }
    });

    const thresholdAlerts = [];
    for (const supplier of suppliers) {
      // Calculer le total des achats du mois en cours pour ce fournisseur
      const supplierPurchases = await prisma.supplierPurchase.findMany({
        where: { 
          supplierId: supplier.id,
          month: currentMonth,
          year: currentYear
        }
      });
      const supplierMonthTotal = supplierPurchases.reduce((sum, p) => sum + p.amount, 0);
      
      // Si proche du seuil (80% ou plus)
      if (supplierMonthTotal >= supplier.seuilRemise * 0.8) {
        thresholdAlerts.push({
          supplier: supplier.name,
          currentAmount: supplierMonthTotal,
          threshold: supplier.seuilRemise,
          percentage: Math.round((supplierMonthTotal / supplier.seuilRemise) * 100),
          discountPercentage: supplier.pourcentageRemiseSeuil
        });
      }
    }

    res.json({
      summary: {
        currentMonthTotal,
        lastMonthTotal,
        totalGeneral
      },
      pendingValidation,
      thresholdAlerts
    });
  } catch (error) {
    console.error('Get suppliers stats error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /api/admin/suppliers/:id/stats - Statistiques d'un fournisseur
router.get('/suppliers/:id/stats', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    
    const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const lastYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    // Achats du mois en cours
    const currentMonthPurchases = await prisma.supplierPurchase.findMany({
      where: { supplierId: id, month: currentMonth, year: currentYear }
    });
    const currentMonthTotal = currentMonthPurchases.reduce((sum, p) => sum + p.amount, 0);

    // Achats du mois dernier
    const lastMonthPurchases = await prisma.supplierPurchase.findMany({
      where: { supplierId: id, month: lastMonth, year: lastYear }
    });
    const lastMonthTotal = lastMonthPurchases.reduce((sum, p) => sum + p.amount, 0);

    // Total général
    const allPurchases = await prisma.supplierPurchase.findMany({
      where: { supplierId: id }
    });
    const totalGeneral = allPurchases.reduce((sum, p) => sum + p.amount, 0);

    // Bons en attente
    const pendingOrders = await prisma.purchaseOrder.findMany({
      where: { 
        supplierId: id,
        status: { in: ['BROUILLON', 'VALIDATION_ATTENTE'] }
      },
      orderBy: { orderDate: 'desc' }
    });

    // Infos fournisseur pour alerte seuil
    const supplier = await prisma.supplier.findUnique({
      where: { id }
    });

    let thresholdAlert = null;
    if (supplier?.seuilRemise && supplier.seuilRemise > 0) {
      const percentage = Math.round((currentMonthTotal / supplier.seuilRemise) * 100);
      if (percentage >= 80) {
        thresholdAlert = {
          currentAmount: currentMonthTotal,
          threshold: supplier.seuilRemise,
          percentage,
          discountPercentage: supplier.pourcentageRemiseSeuil,
          typeRemise: supplier.typeRemise
        };
      }
    }

    res.json({
      summary: {
        currentMonthTotal,
        lastMonthTotal,
        totalGeneral,
        orderCount: allPurchases.length
      },
      pendingOrders,
      thresholdAlert
    });
  } catch (error) {
    console.error('Get supplier stats error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /api/admin/purchase-orders/pending-validation - Bons en attente de validation
router.get('/purchase-orders/pending-validation', verifyAdmin, async (req, res) => {
  try {
    const orders = await prisma.purchaseOrder.findMany({
      where: { status: 'VALIDATION_ATTENTE' },
      include: {
        supplier: true,
        items: {
          include: { product: true }
        }
      },
      orderBy: { orderDate: 'desc' }
    });

    res.json(orders);
  } catch (error) {
    console.error('Get pending validation error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// PUT /api/admin/purchase-orders/:id/validate - Valider un bon de commande (Admin uniquement)
router.put('/purchase-orders/:id/validate', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que seul Admin peut valider
    if (req.userRole !== 'ADMIN') {
      return res.status(403).json({ message: 'Seul l\'administrateur peut valider ce bon.' });
    }

    const order = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'BROUILLON' },
      include: {
        supplier: true,
        items: { include: { product: true } }
      }
    });

    res.json({ message: 'Bon validé', order });
  } catch (error) {
    console.error('Validate order error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// ============ ROUTES AVOIRS FOURNISSEURS ============

// GET /api/admin/suppliers/:id/credits - Liste des avoirs d'un fournisseur
router.get('/suppliers/:id/credits', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const credits = await prisma.supplierCredit.findMany({
      where: { supplierId: id },
      orderBy: { createdAt: 'desc' }
    });

    const availableCredits = credits.filter(c => !c.used && new Date(c.expiresAt) > new Date());
    const totalAvailable = availableCredits.reduce((sum, c) => sum + c.amount, 0);

    res.json({
      credits,
      summary: {
        total: credits.length,
        available: availableCredits.length,
        totalAvailable
      }
    });
  } catch (error) {
    console.error('Get credits error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// POST /api/admin/suppliers/:id/credits - Créer un avoir manuellement
router.post('/suppliers/:id/credits', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, reason, expiresAt } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Montant invalide' });
    }

    if (!expiresAt) {
      return res.status(400).json({ message: 'Date d\'expiration requise' });
    }

    const credit = await prisma.supplierCredit.create({
      data: {
        supplierId: id,
        amount: parseFloat(amount),
        reason: reason || null,
        expiresAt: new Date(expiresAt)
      }
    });

    res.status(201).json({ message: 'Avoir créé', credit });
  } catch (error) {
    console.error('Create credit error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// DELETE /api/admin/suppliers/:id/credits/:creditId - Supprimer un avoir
router.delete('/suppliers/:id/credits/:creditId', verifyAdmin, async (req, res) => {
  try {
    const { id, creditId } = req.params;

    await prisma.supplierCredit.delete({
      where: { id: creditId, supplierId: id }
    });

    res.json({ message: 'Avoir supprimé' });
  } catch (error) {
    console.error('Delete credit error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

export default router;