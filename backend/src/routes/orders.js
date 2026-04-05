// backend/src/routes/orders.js
import express from "express";
import { sendSMS } from "../services/smsService.js";
import prisma from "../prismaClient.js"; // تأكد أن الملف موجود ف /src
import i18nMiddleware from "../i18n.js"; // ../ car orders.js kayn f routes/

const router = express.Router();
router.use(i18nMiddleware);

function generateOrderNumber() {
  return "ORD-" + Math.floor(Math.random() * 1000000);
}

router.post("/create-order", async (req, res) => {
  try {
    const { phone, isUrgent } = req.body;

    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        status: "RECEIVED",
        total: 0, 
      },
    });

  res.status(201).json({
  message: req.t("order_created"),  
  order,
});

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Something went wrong" });
  }
});

export default router;