import { useState, useCallback, useRef } from 'react';
import adminApi from '../api/adminAxios';
import { useAuthNew } from '../context/AuthContextNew';

const usePinConfirm = () => {
  const { user } = useAuthNew();
  const isAdmin = user?.role === 'ADMIN';
  const resolveRef = useRef(null);
  const rejectRef = useRef(null);

  const [pinModal, setPinModal] = useState({ open: false, message: '' });

  const requirePin = useCallback((message = 'Saisissez votre code PIN pour confirmer.') => {
    if (isAdmin) return Promise.resolve(true);
    return new Promise((resolve, reject) => {
      resolveRef.current = resolve;
      rejectRef.current = reject;
      setPinModal({ open: true, message });
    });
  }, [isAdmin]);

  const handleConfirm = useCallback(async (pin) => {
    const { data } = await adminApi.post('/employees/verify-my-pin', { pin });
    if (!data?.valid) throw new Error('Code PIN incorrect.');
    setPinModal({ open: false, message: '' });
    resolveRef.current?.(true);
    resolveRef.current = null;
    rejectRef.current = null;
  }, []);

  const handleCancel = useCallback(() => {
    setPinModal({ open: false, message: '' });
    rejectRef.current?.(new Error('Annulé'));
    resolveRef.current = null;
    rejectRef.current = null;
  }, []);

  return { requirePin, pinModal, handleConfirm, handleCancel };
};

export default usePinConfirm;
