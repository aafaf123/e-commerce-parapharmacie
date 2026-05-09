import { jest } from '@jest/globals';

// ── Mock emailService ────────────────────────────────────────────────────────
const mockEmail = {
  sendOrderConfirmation:      jest.fn().mockResolvedValue(true),
  sendOrderStatusUpdate:      jest.fn().mockResolvedValue(true),
  sendOrderInvoice:           jest.fn().mockResolvedValue(true),
  sendReminderEmail:          jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail:     jest.fn().mockResolvedValue(true),
  sendPromoCodeNotification:  jest.fn().mockResolvedValue(true),
  sendPurchaseOrderToSupplier:jest.fn().mockResolvedValue(true),
  sendPurchaseOrderToEmployee:jest.fn().mockResolvedValue(true),
  sendAccountDeletionCode:    jest.fn().mockResolvedValue(true),
};
jest.unstable_mockModule('../../src/services/emailService.js', () => mockEmail);

const { notify } = await import('../../src/services/notificationService.js');

const ORDER  = { id: 'ord-1', orderNumber: 'ORD-001' };
const EMAIL  = 'test@test.com';

describe('notificationService — routing enqueue', () => {
  beforeEach(() => jest.clearAllMocks());

  it('orderConfirmation → sendOrderConfirmation', async () => {
    await notify.orderConfirmation(EMAIL, ORDER);
    expect(mockEmail.sendOrderConfirmation).toHaveBeenCalledWith(EMAIL, ORDER);
  });

  it('orderStatusUpdate → sendOrderStatusUpdate', async () => {
    await notify.orderStatusUpdate(EMAIL, ORDER, 'PREPARING');
    expect(mockEmail.sendOrderStatusUpdate).toHaveBeenCalledWith(EMAIL, ORDER, 'PREPARING');
  });

  it('orderInvoice → sendOrderInvoice', async () => {
    await notify.orderInvoice(EMAIL, ORDER);
    expect(mockEmail.sendOrderInvoice).toHaveBeenCalledWith(EMAIL, ORDER);
  });

  it('orderReminder → sendReminderEmail', async () => {
    await notify.orderReminder(EMAIL, ORDER);
    expect(mockEmail.sendReminderEmail).toHaveBeenCalledWith(EMAIL, ORDER);
  });

  it('passwordReset → sendPasswordResetEmail', async () => {
    await notify.passwordReset(EMAIL, 'http://reset-link');
    expect(mockEmail.sendPasswordResetEmail).toHaveBeenCalledWith(EMAIL, 'http://reset-link');
  });

  it('promoCode → sendPromoCodeNotification', async () => {
    const promo = { code: 'PROMO10', discountValue: 10 };
    await notify.promoCode(EMAIL, promo);
    expect(mockEmail.sendPromoCodeNotification).toHaveBeenCalledWith(EMAIL, promo);
  });

  it('purchaseOrderSupplier → sendPurchaseOrderToSupplier', async () => {
    await notify.purchaseOrderSupplier(EMAIL, 'FournisseurX', ORDER);
    expect(mockEmail.sendPurchaseOrderToSupplier).toHaveBeenCalledWith(EMAIL, 'FournisseurX', ORDER);
  });

  it('purchaseOrderEmployee → sendPurchaseOrderToEmployee', async () => {
    await notify.purchaseOrderEmployee(EMAIL, 'Jean', ORDER);
    expect(mockEmail.sendPurchaseOrderToEmployee).toHaveBeenCalledWith(EMAIL, 'Jean', ORDER);
  });

  it('accountDeletionCode → sendAccountDeletionCode', async () => {
    await notify.accountDeletionCode(EMAIL, 'Jean', '123456');
    expect(mockEmail.sendAccountDeletionCode).toHaveBeenCalledWith(EMAIL, 'Jean', '123456');
  });

  it('n\'appelle qu\'un seul service par notification', async () => {
    await notify.orderConfirmation(EMAIL, ORDER);
    const totalCalls = Object.values(mockEmail).reduce((sum, fn) => sum + fn.mock.calls.length, 0);
    expect(totalCalls).toBe(1);
  });
});
