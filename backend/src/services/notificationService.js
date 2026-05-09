import * as emailService from './emailService.js';

export function startNotificationWorker() {}

async function enqueue(type, data) {
  switch (type) {
    case 'ORDER_CONFIRMATION':       return emailService.sendOrderConfirmation(data.email, data.order);
    case 'ORDER_STATUS_UPDATE':      return emailService.sendOrderStatusUpdate(data.email, data.order, data.status);
    case 'ORDER_INVOICE':            return emailService.sendOrderInvoice(data.email, data.order);
    case 'ORDER_REMINDER':           return emailService.sendReminderEmail(data.email, data.order);
    case 'PASSWORD_RESET':           return emailService.sendPasswordResetEmail(data.email, data.resetLink);
    case 'PROMO_CODE':               return emailService.sendPromoCodeNotification(data.email, data.promoCode);
    case 'PURCHASE_ORDER_SUPPLIER':  return emailService.sendPurchaseOrderToSupplier(data.email, data.supplierName, data.order);
    case 'PURCHASE_ORDER_EMPLOYEE':  return emailService.sendPurchaseOrderToEmployee(data.email, data.userName, data.order);
    case 'ACCOUNT_DELETION_CODE':    return emailService.sendAccountDeletionCode(data.email, data.userName, data.deleteCode);
  }
}

export const notify = {
  orderConfirmation:     (email, order)               => enqueue('ORDER_CONFIRMATION',       { email, order }),
  orderStatusUpdate:     (email, order, status)        => enqueue('ORDER_STATUS_UPDATE',      { email, order, status }),
  orderInvoice:          (email, order)               => enqueue('ORDER_INVOICE',            { email, order }),
  orderReminder:         (email, order)               => enqueue('ORDER_REMINDER',           { email, order }),
  passwordReset:         (email, resetLink)           => enqueue('PASSWORD_RESET',           { email, resetLink }),
  promoCode:             (email, promoCode)           => enqueue('PROMO_CODE',               { email, promoCode }),
  purchaseOrderSupplier: (email, supplierName, order) => enqueue('PURCHASE_ORDER_SUPPLIER',  { email, supplierName, order }),
  purchaseOrderEmployee: (email, userName, order)     => enqueue('PURCHASE_ORDER_EMPLOYEE',  { email, userName, order }),
  accountDeletionCode:   (email, userName, deleteCode)=> enqueue('ACCOUNT_DELETION_CODE',    { email, userName, deleteCode }),
};

export default notify;
