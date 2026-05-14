import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
// frontend/src/lib/utils.js
export const calculateDiscountPercentage = (oldPrice, price) => {
  if (!oldPrice || !price) return 0
  if (oldPrice <= price) return 0
  return ((oldPrice - price) / oldPrice) * 100
}

export const formatDiscountPercentage = (discount) => {
  if (!discount || discount <= 0) return 0
  return Math.round(discount)
}
export const formatPrice = (price) => {
  return `${price.toFixed(2)} DH`
}
