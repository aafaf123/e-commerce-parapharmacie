// backend/src/routes/orders.js
import express from "express";
import prisma from "../prismaClient.js";
import { authenticateToken } from "../middleware/auth.js";
import { getIo } from '../io.js';

const router = express.Router();


function generateOrderNumber() {
  return "ORD-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
}

// POST /api/orders/create-order - Créer une commande et réduire le stock
router.post("/create-order", authenticateToken, async (req, res) => {
  try {
    const { phone, isUrgent, items, total, deliveryInfo, paymentMethod } = req.body;
    const userId = req.userId;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Le panier est vide" });
    }

    // Vérifier le stock pour chaque produit avant de créer la commande
    for (const item of items) {
      if (item.variantId) {
        // Vérifier le stock de la variante
        const variant = await prisma.productVariant.findUnique({
          where: { id: item.variantId }
        });
        
        if (!variant) {
          return res.status(404).json({ error: `Variante non trouvée: ${item.name}` });
        }
        
        if (variant.stock < item.quantity) {
          return res.status(400).json({ 
            error: `Stock insuffisant pour ${item.name} (${item.variantValue}). Stock disponible: ${variant.stock}` 
          });
        }
      } else {
        // Vérifier le stock du produit principal
        const product = await prisma.product.findUnique({
          where: { id: item.id }
        });

        if (!product) {
          return res.status(404).json({ error: `Produit non trouvé: ${item.name}` });
        }

        if (product.stock < item.quantity) {
          return res.status(400).json({ 
            error: `Stock insuffisant pour ${product.name}. Stock disponible: ${product.stock}` 
          });
        }
      }
    }

    // Créer la commande avec les items et réduire le stock dans une transaction
    const order = await prisma.$transaction(async (tx) => {
      // Créer la commande
      const newOrder = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          status: "RECEIVED",
          total: total || 0,
          phone: phone || null,
          isUrgent: isUrgent || false,
          userId: userId || null,
          deliveryInfo: deliveryInfo ? JSON.stringify(deliveryInfo) : null,
          paymentMethod: paymentMethod || null,
        },
      });

      // Créer les order items et réduire le stock
      for (const item of items) {
        // Créer l'item de commande
        await tx.orderItem.create({
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
        });

        // Réduire le stock
        if (item.variantId) {
          // Réduire le stock de la variante
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: {
              stock: {
                decrement: item.quantity
              },
            },
          });
        }
        
        // Toujours réduire le stock du produit principal (même avec variante)
        await tx.product.update({
          where: { id: item.id },
          data: {
            stock: {
              decrement: item.quantity
            },
          },
        });

        // Créer un mouvement de stock pour tracer la vente
        await tx.stockMovement.create({
          data: {
            productId: item.id,
            type: "SALE",
            quantity: -item.quantity,
            reason: `Commande ${newOrder.orderNumber}`,
            orderId: newOrder.id,
          },
        });
      }

      return newOrder;
    });

    res.status(201).json({
      message: req.t("order_created") || "Commande créée avec succès",
      order,
    });

  } catch (error) {
    console.error("Erreur création commande:", error);
    res.status(500).json({ error: error.message || "Une erreur s'est produite" });
  }
});

// NOTE: POST /api/orders/create is handled by the inline route in server.js
// This router only handles /create-order and GET routes

// GET /api/orders/my-orders - Récupérer les commandes de l'utilisateur connecté
// IMPORTANT: Must be BEFORE /:id route to avoid matching "my-orders" as an ID
router.get("/my-orders", authenticateToken, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.userId },
      include: {
        items: {
          include: {
            product: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ orders });
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
      include: { user: true, items: true }
    });

    if (!order) return res.status(404).json({ error: "Commande non trouvée" });
    if (order.userId !== req.userId) return res.status(403).json({ error: "Accès refusé" });
    if (!['RECEIVED', 'PENDING'].includes(order.status)) return res.status(400).json({ error: "Commande ne peut plus être modifiée" });

    const { items, timeSlotDate, timeSlotStart, timeSlotEnd, deliveryInfo } = req.body;
    const updates = {};

    if (items !== undefined) updates.items = { deleteMany: {}, create: items.map(item => ({ ...item })) };
    if (timeSlotDate !== undefined) updates.timeSlotDate = new Date(timeSlotDate);
    if (timeSlotStart !== undefined) updates.timeSlotStart = timeSlotStart;
    if (timeSlotEnd !== undefined) updates.timeSlotEnd = timeSlotEnd;
    if (deliveryInfo !== undefined) updates.deliveryInfo = deliveryInfo;

    await prisma.order.update({ where: { id }, data: updates });

    // Create notification
    await prisma.notification.create({
      data: {
        type: 'ORDER_MODIFIED',
        title: 'Commande modifiée',
        message: `La commande ${order.orderNumber} a été modifiée par le client ${order.user.firstName} ${order.user.lastName}`,
        data: { orderId: id, userId: req.userId }
      }
    });

    // Emit to admin
    const io = getIo();
    if (io) io.to('admin_room').emit('notification', {
      type: 'ORDER_MODIFIED',
      title: 'Commande modifiée',
      message: `La commande ${order.orderNumber} a été modifiée`,
      data: { orderId: id }
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
      include: { user: true }
    });

    if (!order) return res.status(404).json({ error: "Commande non trouvée" });
    if (order.userId !== req.userId) return res.status(403).json({ error: "Accès refusé" });
    if (!['RECEIVED', 'PENDING', 'PREPARING'].includes(order.status)) return res.status(400).json({ error: "Commande ne peut plus être annulée" });

    await prisma.order.update({ where: { id }, data: { status: 'CANCELLED' } });

    // Create notification
    await prisma.notification.create({
      data: {
        type: 'ORDER_CANCELLED',
        title: 'Commande annulée',
        message: `La commande ${order.orderNumber} a été annulée par le client ${order.user.firstName} ${order.user.lastName}`,
        data: { orderId: id, userId: req.userId }
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

// POST /api/orders/send-confirmation - Renvoyer l'email de confirmation (client)
router.post("/send-confirmation", authenticateToken, async (req, res) => {
  try {
    const { orderNumber, timeSlot, qrCode } = req.body;
    if (!orderNumber) return res.status(400).json({ error: "Numéro de commande requis" });

    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: { user: true, items: { include: { product: true } } }
    });

    if (!order) return res.status(404).json({ error: "Commande non trouvée" });
    if (order.userId !== req.userId) return res.status(403).json({ error: "Accès refusé" });

    // Envoyer l'email de confirmation (pour l'instant sans QR, peut être étendu)
    const { sendOrderConfirmation } = await import("../services/emailService.js");
    await sendOrderConfirmation(order.user.email, order);

    res.json({ message: "Email de confirmation envoyé" });
  } catch (error) {
    console.error("Erreur envoi email confirmation:", error);
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
      include: { user: true }
    });

    if (!order) return res.status(404).json({ error: "Commande non trouvée" });
    if (order.userId !== req.userId) return res.status(403).json({ error: "Accès refusé" });
    if (!['RECEIVED', 'PENDING'].includes(order.status)) return res.status(400).json({ error: "Commande ne peut plus être modifiée" });

    // Update items
    await prisma.orderItem.deleteMany({ where: { orderId: id } });
    if (items && items.length > 0) {
      await prisma.orderItem.createMany({
        data: items.map(item => ({
          orderId: id,
          productId: item.id || item.productId,
          quantity: item.quantity,
          price: item.price
        }))
      });
    }

    // Update total
    await prisma.order.update({
      where: { id },
      data: { total: total || 0 }
    });

    // Create notification
    await prisma.notification.create({
      data: {
        type: 'ORDER_MODIFIED',
        title: 'Commande modifiée',
        message: `La commande ${order.orderNumber} a été modifiée par le client ${order.user.firstName} ${order.user.lastName}`,
        data: { orderId: id, userId: req.userId }
      }
    });

    // Emit to admin
    const io = getIo();
    if (io) io.to('admin_room').emit('notification', {
      type: 'ORDER_MODIFIED',
      title: 'Commande modifiée',
      message: `La commande ${order.orderNumber} a été modifiée`,
      data: { orderId: id }
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
      include: { user: true }
    });

    if (!order) return res.status(404).json({ error: "Commande non trouvée" });
    if (order.userId !== req.userId) return res.status(403).json({ error: "Accès refusé" });
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

    // Créer une notification
    await prisma.notification.create({
      data: {
        type: 'ORDER_MODIFIED',
        title: 'Créneau modifié',
        message: `Le créneau de la commande ${order.orderNumber} a été modifié par ${order.user.firstName} ${order.user.lastName}`,
        data: { 
          orderId: id, 
          userId: req.userId,
          oldTimeSlot: {
            date: order.timeSlotDate,
            start: order.timeSlotStart,
            end: order.timeSlotEnd
          },
          newTimeSlot: {
            date: timeSlotDate,
            start: timeSlotStart,
            end: timeSlotEnd
          }
        }
      }
    });

    // Envoyer notification temps réel
    const io = getIo();
    if (io) io.to('admin_room').emit('notification', {
      type: 'ORDER_MODIFIED',
      title: 'Créneau modifié',
      message: `Créneau de la commande ${order.orderNumber} modifié`,
      data: { orderId: id }
    });

    res.json({ message: "Créneau mis à jour" });
  } catch (error) {
    console.error("Erreur modification créneau:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
