import { useState, useCallback } from 'react';
import adminApi from '../api/adminAxios';
import { useAuthNew } from '../context/AuthContextNew';

const usePinConfirm = () => {
  const { user } = useAuthNew();
  const isAdmin = user?.role === 'ADMIN';

  const [pinModal, setPinModal] = useState({ open: false, message: '', resolve: null, reject: null });

  const requirePin = useCallback((message = 'Saisissez votre code PIN pour confirmer.') => {
    if (isAdmin) return Promise.resolve(true);
    return new Promise((resolve, reject) => {
      setPinModal({ open: true, message, resolve, reject });
    });
  }, [isAdmin]);

  const handleConfirm = useCallback(async (pin) => {
    const { data } = await adminApi.post('/employees/verify-my-pin', { pin });
    if (!data?.valid) throw new Error('Code PIN incorrect.');
    setPinModal({ open: false, message: '', resolve: null, reject: null });
    pinModal.resolve(true);
  }, [pinModal]);

  const handleCancel = useCallback(() => {
    setPinModal(prev => {
      prev.reject?.(new Error('Annulé'));
      return { open: false, message: '', resolve: null, reject: null };
    });
  }, []);

  return { requirePin, pinModal, handleConfirm, handleCancel };
};

export default usePinConfirm;
