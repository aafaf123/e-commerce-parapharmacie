// backend/src/routes/orders.js
import express from "express";
import prisma from "../prismaClient.js";
import i18nMiddleware from "../i18n.js";

const router = express.Router();
router.use(i18nMiddleware);

function generateOrderNumber() {
  return "ORD-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
}

// POST /api/orders/create-order - Créer une commande et réduire le stock
router.post("/create-order", async (req, res) => {
  try {
    const { phone, isUrgent, items, total, userId, deliveryInfo, paymentMethod } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Le panier est vide" });
    }

    // Vérifier le stock pour chaque produit avant de créer la commande
    for (const item of items) {
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
            quantity: item.quantity,
            price: item.price,
            name: item.name,
          },
        });

        // Réduire le stock du produit
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
router.get("/my-orders", async (req, res) => {
  try {
    // This route expects a userId query parameter since there's no auth middleware here
    const userId = req.query.userId;
    if (!userId) {
      return res.status(400).json({ error: "userId requis" });
    }

    const orders = await prisma.order.findMany({
      where: { userId },
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

export default router;
