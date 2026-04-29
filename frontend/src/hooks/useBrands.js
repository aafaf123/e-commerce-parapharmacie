import { useState, useEffect } from 'react';
import axios from '../api/axios';

export const useBrands = () => {
  const [brands, setBrands] = useState([]);

  useEffect(() => {
    axios.get('/brands?active=true')
      .then(({ data }) => setBrands(Array.isArray(data) ? data : []))
      .catch(() => setBrands([]));
  }, []);

  const refreshBrands = () => {
    axios.get('/brands?active=true')
      .then(({ data }) => setBrands(Array.isArray(data) ? data : []))
      .catch(() => setBrands([]));
  };

  return { brands, refreshBrands };
};
