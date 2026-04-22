// backend/src/services/emailService.js
import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';

// Créer le transporteur Nodemailer
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail', // ou un autre service
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// Transporteur réutilisable
let transporter = null;
let transporterCreatedAt = 0;
const TRANSPORTER_TTL = 5 * 60 * 1000; // 5 minutes

const getTransporter = () => {
  if (!transporter || Date.now() - transporterCreatedAt > TRANSPORTER_TTL) {
    transporter = createTransporter();
    transporterCreatedAt = Date.now();
  }
  return transporter;
};

// Envoyer un email de confirmation de commande
export const sendOrderConfirmation = async (userEmail, order) => {
  try {
    const transporter = getTransporter();
    
    const mailOptions = {
      from: `"Parapharmacie" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: `Confirmation de commande - ${order.orderNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0369a1;">Confirmation de commande</h2>
          <p>Bonjour,</p>
          <p>Votre commande <strong>${order.orderNumber}</strong> a été confirmée avec succès.</p>
          
          <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #0369a1; margin-top: 0;">Détails de la commande</h3>
            <p><strong>Numéro de commande :</strong> ${order.orderNumber}</p>
            <p><strong>Date :</strong> ${new Date(order.createdAt).toLocaleDateString('fr-FR')}</p>
            <p><strong>Type :</strong> ${order.type === 'DELIVERY' ? 'Livraison' : 'Click & Collect'}</p>
            <p><strong>Statut :</strong> ${getStatusLabel(order.status)}</p>
            <p><strong>Total :</strong> ${order.total.toFixed(2)} DH</p>
          </div>
          
          ${order.timeSlotDate ? `
            <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 15px 0;">
              <p><strong>📅 Créneau de retrait :</strong></p>
              <p>${new Date(order.timeSlotDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              <p>de ${order.timeSlotStart} à ${order.timeSlotEnd}</p>
            </div>
          ` : ''}
          
          <p>Merci de votre confiance !</p>
          <p style="color: #666; font-size: 14px;">L'équipe Parapharmacie</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email de confirmation envoyé à ${userEmail} pour la commande ${order.orderNumber}`);
    return true;
  } catch (error) {
    console.error('❌ Erreur envoi email confirmation:', error);
    return false;
  }
};

// Envoyer un email de mise à jour de statut de commande
export const sendOrderStatusUpdate = async (userEmail, order, newStatus) => {
  try {
    const transporter = getTransporter();
    
    const statusMessages = {
      RECEIVED: 'reçue',
      PREPARING: 'en préparation',
      READY: 'prête',
      COMPLETED: 'récupérée',
      CANCELLED: 'annulée',
    };

    const statusEmojis = {
      RECEIVED: '📦',
      PREPARING: '🔄',
      READY: '✅',
      COMPLETED: '🎉',
      CANCELLED: '❌',
    };

    const mailOptions = {
      from: `"Parapharmacie" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: `Mise à jour de votre commande - ${order.orderNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0369a1;">${statusEmojis[newStatus] || '📢'} Votre commande est ${statusMessages[newStatus] || newStatus}</h2>
          <p>Bonjour,</p>
          <p>Nous vous informons que votre commande <strong>${order.orderNumber}</strong> a été mise à jour.</p>
          
          <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Numéro de commande :</strong> ${order.orderNumber}</p>
            <p><strong>Nouveau statut :</strong> <span style="color: #059669; font-weight: bold;">${getStatusLabel(newStatus)}</span></p>
          </div>
          
          ${newStatus === 'READY' ? `
            <div style="background: #d1fae5; padding: 15px; border-radius: 8px; margin: 15px 0;">
              <p><strong>🎉 Votre commande est prête !</strong></p>
              <p>Vous pouvez venir la récupérer selon le créneau choisi :</p>
              ${order.timeSlotDate ? `
                <p><strong>Date :</strong> ${new Date(order.timeSlotDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                <p><strong>Heure :</strong> de ${order.timeSlotStart} à ${order.timeSlotEnd}</p>
              ` : ''}
              <p style="margin-top: 15px;"><strong>N'oubliez pas d\'apporter votre numéro de commande : ${order.orderNumber}</strong></p>
            </div>
          ` : ''}
          
          <p>Merci de votre confiance !</p>
          <p style="color: #666; font-size: 14px;">L'équipe Parapharmacie</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email de statut envoyé à ${userEmail} pour la commande ${order.orderNumber} (${newStatus})`);
    return true;
  } catch (error) {
    console.error('❌ Erreur envoi email statut:', error);
    return false;
  }
};

const formatMoney = (v) => {
  const n = Number(v || 0);
  return `${n.toFixed(2)} DH`;
};

const formatDateFr = (d) => new Date(d).toLocaleDateString('fr-FR');

const buildInvoicePdfBuffer = async (order, userEmail) => {
  const doc = new PDFDocument({ size: 'A4', margin: 48 });
  const chunks = [];

  return await new Promise((resolve, reject) => {
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const customerName = `${order.user?.firstName || ''} ${order.user?.lastName || ''}`.trim() || 'Client';
    const paymentLabel = order.type === 'DELIVERY' ? 'Paiement à la livraison' : 'Paiement au comptoir';
    const invoiceDate = new Date();

    // Header
    doc
      .fontSize(20)
      .fillColor('#0369a1')
      .text('FACTURE', { align: 'left' })
      .moveDown(0.2);
    doc
      .fontSize(10)
      .fillColor('#4b5563')
      .text('Parapharmacie ParaClick', { align: 'left' });

    doc
      .moveUp(2.1)
      .fontSize(10)
      .fillColor('#111827')
      .text(`Date : ${formatDateFr(invoiceDate)}`, { align: 'right' })
      .text(`N° commande : ${order.orderNumber}`, { align: 'right' })
      .text(`Paiement : ${paymentLabel}`, { align: 'right' });

    doc
      .moveDown(1.2)
      .strokeColor('#e5e7eb')
      .lineWidth(1)
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .stroke()
      .moveDown(1);

    // Customer block
    doc
      .fontSize(12)
      .fillColor('#111827')
      .text('Client', { underline: false })
      .moveDown(0.3);
    doc
      .fontSize(10)
      .fillColor('#374151')
      .text(`Nom : ${customerName}`)
      .text(`Email : ${userEmail}`);
    if (order.user?.phone) doc.text(`Téléphone : ${order.user.phone}`);
    if (order.type === 'DELIVERY' && order.deliveryAddress) doc.text(`Adresse : ${order.deliveryAddress}`);

    doc.moveDown(0.8);

    // Order details
    doc
      .fontSize(12)
      .fillColor('#111827')
      .text('Détails commande')
      .moveDown(0.3);
    doc
      .fontSize(10)
      .fillColor('#374151')
      .text(`Type : ${order.type === 'DELIVERY' ? 'Livraison' : 'Click & Collect'}`);
    if (order.timeSlotDate) {
      const slot = `${formatDateFr(order.timeSlotDate)} ${order.timeSlotStart || ''} - ${order.timeSlotEnd || ''}`.trim();
      doc.text(`Créneau : ${slot}`);
    }

    doc.moveDown(1.2);

    // Table layout
    const tableTop = doc.y;
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colItem = doc.page.margins.left;
    const colQty = colItem + pageWidth * 0.55;
    const colUnit = colItem + pageWidth * 0.68;
    const colTotal = colItem + pageWidth * 0.82;

    const rowHeight = 18;

    const drawRow = (y, { item, qty, unit, total }, isHeader = false) => {
      doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor('#111827');
      doc.text(item, colItem, y, { width: colQty - colItem - 8, ellipsis: true });
      doc.text(String(qty), colQty, y, { width: colUnit - colQty - 8, align: 'center' });
      doc.text(unit, colUnit, y, { width: colTotal - colUnit - 8, align: 'right' });
      doc.text(total, colTotal, y, { width: doc.page.width - doc.page.margins.right - colTotal, align: 'right' });
      doc
        .strokeColor('#e5e7eb')
        .lineWidth(1)
        .moveTo(doc.page.margins.left, y + rowHeight)
        .lineTo(doc.page.width - doc.page.margins.right, y + rowHeight)
        .stroke();
    };

    // Header row
    drawRow(tableTop, { item: 'Article', qty: 'Qté', unit: 'Prix unitaire', total: 'Total' }, true);

    let y = tableTop + rowHeight + 6;
    const items = Array.isArray(order.items) ? order.items : [];

    for (const it of items) {
      if (y > doc.page.height - doc.page.margins.bottom - 80) {
        doc.addPage();
        y = doc.page.margins.top;
        drawRow(y, { item: 'Article', qty: 'Qté', unit: 'Prix unitaire', total: 'Total' }, true);
        y += rowHeight + 6;
      }
      const name = it.product?.name || it.name || 'Produit';
      const qty = Number(it.quantity || 0);
      const unit = Number(it.price || 0);
      const lineTotal = qty * unit;

      drawRow(y, { item: name, qty, unit: formatMoney(unit), total: formatMoney(lineTotal) }, false);
      y += rowHeight + 6;
    }

    // Total
    const totalValue = Number(order.total || 0);
    if (y > doc.page.height - doc.page.margins.bottom - 60) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    doc.moveTo(doc.page.margins.left, y + 10);
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor('#0369a1')
      .text(`TOTAL : ${formatMoney(totalValue)}`, doc.page.margins.left, y + 14, { align: 'right' });

    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#6b7280')
      .text('Merci pour votre confiance. Ceci est une facture électronique.', doc.page.margins.left, doc.page.height - doc.page.margins.bottom - 20, {
        align: 'left',
      });

    doc.end();
  });
};

// Envoyer la facture (commande récupérée/livrée et payée)
export const sendOrderInvoice = async (userEmail, order) => {
  try {
    const transporter = getTransporter();
    const pdfBuffer = await buildInvoicePdfBuffer(order, userEmail);
    const safeOrderNumber = String(order.orderNumber || 'commande').replace(/[^\w.-]+/g, '_');

    const mailOptions = {
      from: `"Parapharmacie" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: `Facture - ${order.orderNumber}`,
      text: `Bonjour,\n\nVeuillez trouver en pièce jointe la facture de votre commande ${order.orderNumber}.\n\nMerci pour votre confiance.\nParapharmacie ParaClick`,
      attachments: [
        {
          filename: `facture_${safeOrderNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Facture envoyée à ${userEmail} pour la commande ${order.orderNumber}`);
    return true;
  } catch (error) {
    console.error('❌ Erreur envoi facture:', error);
    return false;
  }
};

// Envoyer un email pour un nouveau code promo
export const sendPromoCodeNotification = async (userEmail, promoCode) => {
  try {
    const transporter = getTransporter();
    
    const discountText = promoCode.discountType === 'percentage' 
      ? `${promoCode.discountValue}% de réduction`
      : `${promoCode.discountValue} DH de réduction`;

    const mailOptions = {
      from: `"Parapharmacie" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: `🎉 Nouveau code promo : ${promoCode.code}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0369a1;">🎉 Code promo exclusif !</h2>
          <p>Bonjour,</p>
          <p>Nous avons le plaisir de vous offrir un code promo exclusif :</p>
          
          <div style="background: linear-gradient(135deg, #0369a1, #0ea5e9); padding: 30px; border-radius: 12px; margin: 20px 0; text-align: center;">
            <p style="color: white; font-size: 14px; margin-bottom: 10px;">Votre code promo</p>
            <p style="color: white; font-size: 32px; font-weight: bold; margin: 10px 0; letter-spacing: 2px;">${promoCode.code}</p>
            <p style="color: white; font-size: 20px; font-weight: bold; margin: 10px 0;">${discountText}</p>
          </div>
          
          <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <p><strong>Détails du code promo :</strong></p>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li>Type : ${promoCode.discountType === 'percentage' ? 'Pourcentage' : 'Montant fixe'}</li>
              <li>Valeur : ${discountText}</li>
              ${promoCode.minimumOrder ? `<li>Commande minimum : ${promoCode.minimumOrder} DH</li>` : ''}
              ${promoCode.expiresAt ? `<li>Valable jusqu'au : ${new Date(promoCode.expiresAt).toLocaleDateString('fr-FR')}</li>` : ''}
            </ul>
          </div>
          
          <div style="text-align: center; margin: 25px 0;">
            <a href="http://localhost:3000" style="background: #0369a1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Profiter de l'offre
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">L'équipe Parapharmacie</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email code promo envoyé à ${userEmail} (${promoCode.code})`);
    return true;
  } catch (error) {
    console.error('❌ Erreur envoi email code promo:', error);
    return false;
  }
};

// Helper pour obtenir le label du statut
const getStatusLabel = (status) => {
  const labels = {
    RECEIVED: 'Reçue',
    PREPARING: 'En préparation',
    READY: 'Prête',
    COMPLETED: 'Récupérée',
    CANCELLED: 'Annulée',
    REFUNDED: 'Remboursée',
    RETURNED: 'Retournée',
  };
  return labels[status] || status;
};

// Envoyer un email de réinitialisation de mot de passe
export const sendPasswordResetEmail = async (userEmail, resetLink) => {
  try {
    const transporter = getTransporter();
    
    const mailOptions = {
      from: `"Parapharmacie" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: 'Réinitialisation de votre mot de passe',
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <div style="text-align: center; padding: 20px 0; background-color: #f8fafc;">
            <h1 style="color: #0369a1; margin: 0;">Parapharmacie</h1>
          </div>
          
          <div style="padding: 40px 20px; background-color: #ffffff; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1e293b; margin-top: 0;">Demande de réinitialisation</h2>
            <p style="font-size: 16px; line-height: 1.6; color: #475569;">
              Bonjour,<br><br>
              Vous avez demandé la réinitialisation du mot de passe de votre compte Parapharmacie. 
              Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe :
            </p>
            
            <div style="text-align: center; margin: 35px 0;">
              <a href="${resetLink}" style="background-color: #0369a1; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                Réinitialiser mon mot de passe
              </a>
            </div>
            
            <p style="font-size: 14px; line-height: 1.6; color: #64748b;">
              Si le bouton ne fonctionne pas, copiez et collez le lien suivant dans votre navigateur :<br>
              <a href="${resetLink}" style="color: #0369a1; word-break: break-all;">${resetLink}</a>
            </p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
              <p style="font-size: 13px; color: #94a3b8; margin-bottom: 0;">
                <strong>Note :</strong> Ce lien expirera dans 15 minutes. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email en toute sécurité. Votre mot de passe restera inchangé.
              </p>
            </div>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
            © ${new Date().getFullYear()} Parapharmacie en ligne. Tous droits réservés.
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email de réinitialisation envoyé à ${userEmail}`);
    return true;
  } catch (error) {
    console.error('❌ ERREUR SMTP :', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response
    });
    return false;
  }
};

export const sendReminderEmail = async (userEmail, order) => {
  try {
    const transporter = getTransporter()
    
    const orderType = order.type === 'DELIVERY' ? 'livrée à domicile' : 'à récupérer en Click & Collect'
    
    const mailOptions = {
      from: `"Parapharmacie" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: `⏰ Rappel : Votre commande ${order.orderNumber} - Retrait dans 2 heures`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">⏰ Rappel - Retrait dans 2 heures</h2>
          <p>Bonjour,</p>
          <p>Nous vous rappelons que votre commande <strong>${order.orderNumber}</strong> doit être ${orderType}.</p>
          
          <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #92400e; margin-top: 0;">📦 Détails de votre commande</h3>
            <p><strong>Numéro de commande :</strong> ${order.orderNumber}</p>
            <p><strong>Type :</strong> ${order.type === 'DELIVERY' ? 'Livraison à domicile' : 'Click & Collect'}</p>
            ${order.timeSlotDate ? `
              <p><strong>Date de retrait :</strong> ${new Date(order.timeSlotDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              <p><strong>Heure :</strong> de ${order.timeSlotStart} à ${order.timeSlotEnd}</p>
            ` : ''}
          </div>
          
          ${order.type !== 'DELIVERY' ? `
          <div style="background: #d1fae5; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <p><strong>📍 Adresse de retrait :</strong></p>
            <p>ParaClick - Votre parapharmacie de proximité</p>
          </div>
          ` : ''}
          
          <p style="margin-top: 20px;"><strong>N'oubliez pas votre numéro de commande : ${order.orderNumber}</strong></p>
          
          <p>À bientôt !</p>
          <p style="color: #666; font-size: 14px;">L'équipe Parapharmacie</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions)
    console.log(`✅ Email de rappel envoyé à ${userEmail} pour la commande ${order.orderNumber}`)
    return true
  } catch (error) {
    console.error('❌ Erreur envoi email rappel:', error)
    return false
  }
}

// Envoyer le bon de commande à l'employé qui l'a envoyé
export const sendPurchaseOrderToEmployee = async (userEmail, userName, order) => {
  try {
    const transporter = getTransporter();
    
    const itemsList = order.items.map(item => 
      `<tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.product?.name || 'Produit'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatMoney(item.unitPrice)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatMoney(item.quantity * item.unitPrice)}</td>
      </tr>`
    ).join('');

    const mailOptions = {
      from: `"Parapharmacie" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: `📋 Bon de commande envoyé - ${order.orderNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0369a1;">📋 Bon de commande envoyé</h2>
          <p>Bonjour ${userName},</p>
          <p>Vous avez envoyé le bon de commande <strong>${order.orderNumber}</strong> au fournisseur <strong>${order.supplier?.name || ''}</strong>.</p>
          
          <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #0369a1; margin-top: 0;">Détails du bon de commande</h3>
            <p><strong>Numéro :</strong> ${order.orderNumber}</p>
            <p><strong>Fournisseur :</strong> ${order.supplier?.name || ''}</p>
            <p><strong>Date d'envoi :</strong> ${new Date().toLocaleDateString('fr-FR')}</p>
            <p><strong>Total :</strong> <span style="font-size: 18px; font-weight: bold; color: #059669;">${formatMoney(order.totalAmount)}</span></p>
          </div>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #d1d5db;">Produit</th>
                <th style="padding: 10px; text-align: center; border-bottom: 2px solid #d1d5db;">Qté</th>
                <th style="padding: 10px; text-align: right; border-bottom: 2px solid #d1d5db;">Prix unitaire</th>
                <th style="padding: 10px; text-align: right; border-bottom: 2px solid #d1d5db;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsList}
            </tbody>
          </table>
          
          <p style="color: #666; font-size: 14px;">Ce bon de commande a été envoyé au fournisseur.</p>
          <p style="color: #666; font-size: 14px;">L'équipe Parapharmacie</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Bon de commande envoyé à l'employé ${userEmail} (${order.orderNumber})`);
    return true;
  } catch (error) {
    console.error('❌ Erreur envoi bon de commande:', error);
    return false;
  }
};

// Envoyer le bon de commande au fournisseur
export const sendPurchaseOrderToSupplier = async (supplierEmail, supplierName, order) => {
  try {
    console.log('📧 sendPurchaseOrderToSupplier: début');
    console.log('   - to:', supplierEmail);
    console.log('   - name:', supplierName);
    console.log('   - order:', order.orderNumber);
    
    const transporter = getTransporter();
    console.log('📧 Transporteur créé');
    
    const itemsList = order.items.map(item => 
      `<tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.product?.name || 'Produit'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatMoney(item.unitPrice)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatMoney(item.quantity * item.unitPrice)}</td>
      </tr>`
    ).join('');

    console.log('📧 Génération PDF...');
    const pdfBuffer = await buildPurchaseOrderPdfBuffer(order);
    console.log('📧 PDF généré, taille:', pdfBuffer?.length || 0);
    
    const safeOrderNumber = String(order.orderNumber || 'bon-commande').replace(/[^\w.-]+/g, '_');

    const mailOptions = {
      from: `"Parapharmacie" <${process.env.EMAIL_USER}>`,
      to: supplierEmail,
      subject: `📦 Nouveau bon de commande - ${order.orderNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #059669;">📦 Nouveau bon de commande</h2>
          <p>Bonjour,</p>
          <p>Vous avez reçu un nouveau bon de commande <strong>${order.orderNumber}</strong> de la part de Parapharmacie.</p>
          
          <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #0369a1; margin-top: 0;">Détails de la commande</h3>
            <p><strong>Numéro :</strong> ${order.orderNumber}</p>
            <p><strong>Date :</strong> ${new Date(order.orderDate).toLocaleDateString('fr-FR')}</p>
            <p><strong>Total :</strong> <span style="font-size: 18px; font-weight: bold; color: #059669;">${formatMoney(order.totalAmount)}</span></p>
            <p><strong>Remise :</strong> ${formatMoney(order.discountAmount || 0)}</p>
            ${order.expectedDate ? `<p><strong>Date prévue :</strong> ${new Date(order.expectedDate).toLocaleDateString('fr-FR')}</p>` : ''}
            ${order.notes ? `<p><strong>Notes :</strong> ${order.notes}</p>` : ''}
          </div>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #d1d5db;">Produit</th>
                <th style="padding: 10px; text-align: center; border-bottom: 2px solid #d1d5db;">Qté</th>
                <th style="padding: 10px; text-align: right; border-bottom: 2px solid #d1d5db;">Prix unitaire</th>
                <th style="padding: 10px; text-align: right; border-bottom: 2px solid #d1d5db;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsList}
            </tbody>
          </table>
          
          <p style="color: #666; font-size: 14px;">Merci de traiter cette commande dans les meilleurs délais.</p>
          <p style="color: #666; font-size: 14px;">Parapharmacie ParaClick</p>
        </div>
      `,
      attachments: pdfBuffer ? [
        {
          filename: `bon_commande_${safeOrderNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ] : [],
    };

    console.log('📧 Envoi email...');
    await transporter.sendMail(mailOptions);
    console.log(`✅ Email envoyé à ${supplierEmail}`);
    return true;
  } catch (error) {
    console.error('❌ Erreur envoi bon de commande:', error.message);
    console.error('   Stack:', error.stack);
    return false;
  }
};

// Générer le PDF du bon de commande
const buildPurchaseOrderPdfBuffer = async (order) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 48 });
      const chunks = [];

      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => {
        console.log('✅ PDF généré, taille:', chunks.reduce((a, b) => a + b.length, 0));
        resolve(Buffer.concat(chunks));
      });
      doc.on('error', (err) => {
        console.error('❌ Erreur PDF:', err);
        reject(err);
      });

      const supplierName = order.supplier?.name || '';
      const orderDate = new Date(order.orderDate || order.createdAt).toLocaleDateString('fr-FR');
      const items = order.items || [];

      // Header
      doc.fontSize(20).fillColor('#059669').text('BON DE COMMANDE', { align: 'left' }).moveDown(0.2);
      doc.fontSize(10).fillColor('#4b5563').text('Parapharmacie ParaClick', { align: 'left' });
      doc.moveUp(2.1).fontSize(10).fillColor('#111827')
        .text(`Date : ${orderDate}`, { align: 'right' })
        .text(`N° Commande : ${order.orderNumber}`, { align: 'right' })
        .text(`Fournisseur : ${supplierName}`, { align: 'right' });

      doc.moveDown(1.2).strokeColor('#e5e7eb').lineWidth(1)
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .stroke().moveDown(1);

      // Table header
      const tableTop = doc.y;
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const colItem = doc.page.margins.left;
      const colQty = colItem + pageWidth * 0.55;
      const colUnit = colItem + pageWidth * 0.68;
      const colTotal = colItem + pageWidth * 0.82;
      const rowHeight = 18;

      const drawRow = (y, data, isHeader = false) => {
        doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor('#111827');
        doc.text(data.item, colItem, y, { width: colQty - colItem - 8, ellipsis: true });
        doc.text(String(data.qty), colQty, y, { width: colUnit - colQty - 8, align: 'center' });
        doc.text(data.unit, colUnit, y, { width: colTotal - colUnit - 8, align: 'right' });
        doc.text(data.total, colTotal, y, { width: doc.page.width - doc.page.margins.right - colTotal, align: 'right' });
        doc.strokeColor('#e5e7eb').lineWidth(1)
          .moveTo(doc.page.margins.left, y + rowHeight)
          .lineTo(doc.page.width - doc.page.margins.right, y + rowHeight)
          .stroke();
      };

      drawRow(tableTop, { item: 'Produit', qty: 'Qté', unit: 'Prix unitaire', total: 'Total' }, true);

      let y = tableTop + rowHeight + 6;
      for (const item of items) {
        if (y > doc.page.height - doc.page.margins.bottom - 80) {
          doc.addPage();
          y = doc.page.margins.top;
          drawRow(y, { item: 'Produit', qty: 'Qté', unit: 'Prix unitaire', total: 'Total' }, true);
          y += rowHeight + 6;
        }
        const name = item.product?.name || 'Produit';
        const qty = Number(item.quantity || 0);
        const unit = Number(item.unitPrice || 0);
        const lineTotal = qty * unit;
        drawRow(y, { item: name, qty, unit: formatMoney(unit), total: formatMoney(lineTotal) });
        y += rowHeight + 6;
      }

      // Total
      const totalValue = Number(order.totalAmount || 0);
      doc.moveTo(doc.page.margins.left, y + 10);
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#059669')
        .text(`TOTAL : ${formatMoney(totalValue)}`, doc.page.margins.left, y + 14, { align: 'right' });

      if (order.discountAmount > 0) {
        doc.font('Helvetica').fontSize(10).fillColor('#dc2626')
          .text(`Remise : ${formatMoney(order.discountAmount)}`, doc.page.margins.left, y + 30, { align: 'right' });
      }

      doc.font('Helvetica').fontSize(9).fillColor('#6b7280')
        .text(`Merci pour votre confiance. ParaClick - Parapharmacie de proximité.`, doc.page.margins.left, doc.page.height - doc.page.margins.bottom - 20, { align: 'left' });

      doc.end();
    } catch (err) {
      console.error('❌ Erreur génération PDF:', err);
      reject(err);
    }
  });
};

export default {
  sendOrderConfirmation,
  sendOrderStatusUpdate,
  sendOrderInvoice,
  sendPromoCodeNotification,
  sendPasswordResetEmail,
  sendReminderEmail,
  sendPurchaseOrderToEmployee,
  sendPurchaseOrderToSupplier,
};
