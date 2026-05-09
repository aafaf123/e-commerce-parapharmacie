// backend/src/routes/orders.js
import express from "express";
import prisma from "../prismaClient.js";
import { authenticateToken } from "../middleware/auth.js";
import { getIo } from '../io.js';
import { generateOrderQRCode } from '../services/qrCodeService.js';
import notify from '../services/notificationService.js';
import { cacheDel, CACHE_KEYS } from '../utils/redisCache.js';

const router = express.Router();


function generateOrderNumber() {
  return "ORD-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
}

// POST /api/orders/create-order et /api/orders/create - Créer une commande
router.post(["/create-order", "/create"], authenticateToken, async (req, res) => {
  try {
    const { phone, isUrgent, items, total, deliveryInfo, paymentMethod, cashAmount } = req.body;
    const userId = req.userId;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Le panier est vide" });
    }

    // Vérifier que les produits existent en parallèle
    const checks = await Promise.all(items.map(item =>
      item.variantId
        ? prisma.productVariant.findUnique({ where: { id: item.variantId }, select: { id: true } })
        : prisma.product.findUnique({ where: { id: item.id }, select: { id: true } })
    ));
    for (let i = 0; i < items.length; i++) {
      if (!checks[i]) return res.status(404).json({ error: `Produit non trouvé: ${items[i].name}` });
    }

    // Créer la commande avec les items et réduire le stock dans une transaction
    const order = await prisma.$transaction(async (tx) => {
      // Créer la commande
      const newOrder = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          status: "RECEIVED",
          total: total || 0,
          isUrgent: isUrgent || false,
          clientId: userId || null,
          cashAmount: cashAmount ? parseFloat(cashAmount) : null,
        },
      });

      // Créer les order items, réduire le stock et créer les mouvements en parallèle
      await Promise.all(items.map(item => [
        tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            productId: item.id,
            variantId: item.variantId || null,
            quantity: item.quantity,
            price: item.price,
            name: item.name,
            variantType: item.variantType || null,
            variantValue: item.variantValue || null,
          },
        }),
        item.variantId && tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { decrement: item.quantity } },
        }),
        tx.product.update({
          where: { id: item.id },
          data: { stock: { decrement: item.quantity } },
        }),
        tx.stockMovement.create({
          data: {
            productId: item.id,
            type: "SALE",
            quantity: -item.quantity,
            reason: `Commande ${newOrder.orderNumber}`,
          },
        }),
      ].filter(Boolean)).flat());

      return newOrder;
    });

    // Alertes stock négatif + QR code + notification client en parallèle (non bloquant)
    const [productsAfter, qrCode, client] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: items.map(i => i.id) } },
        select: { id: true, name: true, stock: true }
      }),
      generateOrderQRCode(order),
      prisma.client.findUnique({
        where: { id: userId },
        select: { firstName: true, email: true, notificationEmail: true }
      })
    ]);

    const io = getIo();
    const negativeStockItems = productsAfter.filter(p => p.stock < 0);
    if (negativeStockItems.length > 0) {
      await Promise.all(negativeStockItems.map(product =>
        prisma.notification.create({
          data: {
            type: 'NEGATIVE_STOCK',
            title: '⚠️ Stock négatif',
            message: `${product.name} : stock = ${product.stock} (commande ${order.orderNumber})`,
            data: { productId: product.id, stock: product.stock, orderId: order.id }
          }
        })
      ));
      if (io) negativeStockItems.forEach(product =>
        io.to('admin_room').emit('notification', {
          type: 'NEGATIVE_STOCK',
          title: '⚠️ Stock négatif',
          message: `${product.name} : stock = ${product.stock}`,
          data: { productId: product.id, stock: product.stock }
        })
      );
    }

    const orderWithQR = { ...order, qrCode };

    // Email async (fire-and-forget) + invalider cache KPIs
    cacheDel(CACHE_KEYS.ADMIN_KPIS).catch(() => {});
    if (client?.email && client.notificationEmail !== false) {
      notify.orderConfirmation(client.email, orderWithQR).catch(e =>
        console.error('Erreur notification email:', e)
      );
    }

    res.status(201).json({
      message: "Commande créée avec succès",
      order: orderWithQR,
    });

  } catch (error) {
    console.error("Erreur création commande:", error);
    res.status(500).json({ error: error.message || "Une erreur s'est produite" });
  }
});

// NOTE: POST /api/orders/create is handled by the inline route in server.js
// This router only handles /create-order and GET routes

// POST /api/orders/send-confirmation - Renvoyer l'email de confirmation (client)
router.post("/send-confirmation", authenticateToken, async (req, res) => {
  try {
    const { orderNumber, timeSlot, qrCode } = req.body;
    if (!orderNumber) return res.status(400).json({ error: "Numéro de commande requis" });

    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: { client: true, items: { include: { product: true } } }
    });

    if (!order) return res.status(404).json({ error: "Commande non trouvée" });
    if (order.clientId !== req.userId) return res.status(403).json({ error: "Accès refusé" });

    const { sendOrderConfirmation } = await import("../services/emailService.js");
    await sendOrderConfirmation(order.client.email, order);

    res.json({ message: "Email de confirmation envoyé" });
  } catch (error) {
    console.error("Erreur envoi email confirmation:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// GET /api/orders/my-orders
router.get("/my-orders", authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { clientId: req.userId },
        select: {
          id: true, orderNumber: true, status: true, total: true,
          createdAt: true, timeSlotDate: true, timeSlotStart: true,
          items: {
            select: {
              id: true, quantity: true, price: true, name: true,
              product: { select: { id: true, name: true, image: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.order.count({ where: { clientId: req.userId } })
    ]);

    res.json({ orders, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (error) {
    console.error("Get orders error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/orders - Récupérer toutes les commandes (admin)
router.get("/", async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        items: {
          include: {
            product: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(orders);
  } catch (error) {
    console.error("Erreur récupération commandes:", error);
    res.status(500).json({ error: error.message || "Une erreur s'est produite" });
  }
});

// GET /api/orders/:id - Récupérer une commande par ID
router.get("/:id", async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ error: "Commande non trouvée" });
    }

    res.json(order);
  } catch (error) {
    console.error("Erreur récupération commande:", error);
    res.status(500).json({ error: error.message || "Une erreur s'est produite" });
  }
});

// PUT /api/orders/:id - Modifier une commande (client)
router.put("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: { client: true, items: true }
    });

    if (!order) return res.status(404).json({ error: "Commande non trouvée" });
    if (order.clientId !== req.userId) return res.status(403).json({ error: "Accès refusé" });
    if (!['RECEIVED', 'PENDING'].includes(order.status)) return res.status(400).json({ error: "Commande ne peut plus être modifiée" });

    const { items, timeSlotDate, timeSlotStart, timeSlotEnd, deliveryInfo } = req.body;
    const updates = {};
    const changes = [];

    if (timeSlotDate !== undefined || timeSlotStart !== undefined || timeSlotEnd !== undefined) {
      const oldDate = order.timeSlotDate ? new Date(order.timeSlotDate).toLocaleDateString('fr-FR') : 'Non défini';
      const newDate = timeSlotDate ? new Date(timeSlotDate).toLocaleDateString('fr-FR') : oldDate;
      const oldSlot = `${order.timeSlotStart || '?'} - ${order.timeSlotEnd || '?'}`;
      const newSlot = `${timeSlotStart || order.timeSlotStart || '?'} - ${timeSlotEnd || order.timeSlotEnd || '?'}`;
      if (oldDate !== newDate || oldSlot !== newSlot)
        changes.push(`Créneau: ${oldDate} ${oldSlot} → ${newDate} ${newSlot}`);
    }

    if (items !== undefined) {
      const oldItems = order.items.map(i => `${i.name || i.productId} x${i.quantity}`).join(', ');
      const newItems = items.map(i => `${i.name || i.productId} x${i.quantity}`).join(', ');
      if (oldItems !== newItems) changes.push(`Articles: [${oldItems || 'vide'}] → [${newItems || 'vide'}]`);
      updates.items = { deleteMany: {}, create: items.map(item => ({ ...item })) };
    }
    if (timeSlotDate !== undefined) updates.timeSlotDate = new Date(timeSlotDate);
    if (timeSlotStart !== undefined) updates.timeSlotStart = timeSlotStart;
    if (timeSlotEnd !== undefined) updates.timeSlotEnd = timeSlotEnd;
    if (deliveryInfo !== undefined) updates.deliveryInfo = deliveryInfo;

    await prisma.order.update({ where: { id }, data: updates });

    const changeDetails = changes.length > 0 ? ` — ${changes.join(' | ')}` : '';
    const notifMessage = `Commande ${order.orderNumber} modifiée par ${order.client?.firstName} ${order.client?.lastName}${changeDetails}`;

    await prisma.notification.create({
      data: {
        type: 'ORDER_MODIFIED',
        title: 'Commande modifiée',
        message: notifMessage,
        data: { orderId: id, clientId: req.userId, changes }
      }
    });

    const io = getIo();
    if (io) io.to('admin_room').emit('notification', {
      type: 'ORDER_MODIFIED',
      title: 'Commande modifiée',
      message: notifMessage,
      data: { orderId: id, changes }
    });

    res.json({ message: "Commande mise à jour" });
  } catch (error) {
    console.error("Erreur modification commande:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// PUT /api/orders/:id/cancel - Annuler une commande (client)
router.put("/:id/cancel", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: { client: true }
    });

    if (!order) return res.status(404).json({ error: "Commande non trouvée" });
    if (order.clientId !== req.userId) return res.status(403).json({ error: "Accès refusé" });
    if (!['RECEIVED', 'PENDING', 'PREPARING'].includes(order.status)) return res.status(400).json({ error: "Commande ne peut plus être annulée" });

    await prisma.order.update({ where: { id }, data: { status: 'CANCELLED' } });

    await prisma.notification.create({
      data: {
        type: 'ORDER_CANCELLED',
        title: 'Commande annulée',
        message: `La commande ${order.orderNumber} a été annulée par le client ${order.client?.firstName} ${order.client?.lastName}`,
        data: { orderId: id, clientId: req.userId }
      }
    });

    // Emit to admin
    const io = getIo();
    if (io) io.to('admin_room').emit('notification', {
      type: 'ORDER_CANCELLED',
      title: 'Commande annulée',
      message: `La commande ${order.orderNumber} a été annulée`,
      data: { orderId: id }
    });

    res.json({ message: "Commande annulée" });
  } catch (error) {
    console.error("Erreur annulation commande:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// PATCH /:id/items - Mettre à jour les articles d'une commande (client)
router.patch("/:id/items", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { items, total } = req.body;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { client: true, items: true }
    });

    if (!order) return res.status(404).json({ error: "Commande non trouvée" });
    if (order.clientId !== req.userId) return res.status(403).json({ error: "Accès refusé" });
    if (!['RECEIVED', 'PENDING'].includes(order.status)) return res.status(400).json({ error: "Commande ne peut plus être modifiée" });

    const oldItems = (order.items || []).map(i => `${i.name || i.productId} x${i.quantity}`).join(', ');
    const newItems = items ? items.map(i => `${i.name || i.productId} x${i.quantity}`).join(', ') : '';
    const changes = [];
    if (oldItems !== newItems) changes.push(`Articles: [${oldItems || 'vide'}] → [${newItems || 'vide'}]`);
    if (total !== undefined && total !== order.total) changes.push(`Total: ${order.total} DH → ${total} DH`);

    await prisma.orderItem.deleteMany({ where: { orderId: id } });
    if (items && items.length > 0) {
      for (const item of items) {
        await prisma.orderItem.create({
          data: {
            orderId: id,
            productId: item.id || item.productId,
            variantId: item.variantId || null,
            quantity: item.quantity,
            price: item.price,
            name: item.name || null,
            variantType: item.variantType || null,
            variantValue: item.variantValue || null
          }
        });
      }
    }

    await prisma.order.update({ where: { id }, data: { total: total || 0 } });

    const changeDetails = changes.length > 0 ? ` — ${changes.join(' | ')}` : '';
    const notifMessage = `Commande ${order.orderNumber} modifiée par ${order.client?.firstName} ${order.client?.lastName}${changeDetails}`;

    await prisma.notification.create({
      data: {
        type: 'ORDER_MODIFIED',
        title: 'Articles modifiés',
        message: notifMessage,
        data: { orderId: id, clientId: req.userId, changes }
      }
    });

    const io = getIo();
    if (io) io.to('admin_room').emit('notification', {
      type: 'ORDER_MODIFIED',
      title: 'Articles modifiés',
      message: notifMessage,
      data: { orderId: id, changes }
    });

    res.json({ message: "Articles mis à jour" });
  } catch (error) {
    console.error("Erreur mise à jour articles:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// PUT /api/orders/:id/time-slot - Modifier le créneau d'une commande (client)
router.put("/:id/time-slot", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { timeSlotDate, timeSlotStart, timeSlotEnd } = req.body;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { client: true }
    });

    if (!order) return res.status(404).json({ error: "Commande non trouvée" });
    if (order.clientId !== req.userId) return res.status(403).json({ error: "Accès refusé" });
    if (!['RECEIVED', 'PENDING'].includes(order.status)) return res.status(400).json({ error: "Commande ne peut plus être modifiée" });

    // Mettre à jour le créneau
    await prisma.order.update({
      where: { id },
      data: {
        timeSlotDate: timeSlotDate ? new Date(timeSlotDate) : undefined,
        timeSlotStart: timeSlotStart || undefined,
        timeSlotEnd: timeSlotEnd || undefined
      }
    });

    const oldDate = order.timeSlotDate ? new Date(order.timeSlotDate).toLocaleDateString('fr-FR') : 'Non défini';
    const newDate = timeSlotDate ? new Date(timeSlotDate).toLocaleDateString('fr-FR') : oldDate;
    const oldSlot = `${order.timeSlotStart || '?'} - ${order.timeSlotEnd || '?'}`;
    const newSlot = `${timeSlotStart || order.timeSlotStart || '?'} - ${timeSlotEnd || order.timeSlotEnd || '?'}`;
    const changeDetail = `Créneau: ${oldDate} ${oldSlot} → ${newDate} ${newSlot}`;
    const notifMessage = `Commande ${order.orderNumber} — ${changeDetail} (par ${order.client?.firstName} ${order.client?.lastName})`;

    await prisma.notification.create({
      data: {
        type: 'ORDER_MODIFIED',
        title: 'Créneau modifié',
        message: notifMessage,
        data: { orderId: id, userId: req.userId, changes: [changeDetail] }
      }
    });

    const io = getIo();
    if (io) io.to('admin_room').emit('notification', {
      type: 'ORDER_MODIFIED',
      title: 'Créneau modifié',
      message: notifMessage,
      data: { orderId: id, changes: [changeDetail] }
    });

    res.json({ message: "Créneau mis à jour" });
  } catch (error) {
    console.error("Erreur modification créneau:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
