import { useEffect, useRef } from 'react';

export const useInterval = (callback, delay, active = true) => {
  const savedCallback = useRef();

  useEffect(() => {
    savedCallback.current = callback;
  });

  useEffect(() => {
    if (!active || !delay) return;

    const id = setInterval(() => savedCallback.current(), delay);

    return () => clearInterval(id);
  }, [delay, active]);
};
