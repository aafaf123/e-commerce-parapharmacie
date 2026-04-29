// Reusable Price component — always LTR regardless of page direction
// Usage: <Price value={129} /> → renders "129.00 DH" always left-to-right
// Usage: <Price value={129} className="text-xl font-bold text-sky-700" />

const Price = ({ value, className = '', suffix = 'DH', decimals = 2 }) => {
  if (value === null || value === undefined) return null
  const formatted = `${Number(value).toFixed(decimals)} ${suffix}`
  return (
    <span className={`ltr ${className}`}>
      {formatted}
    </span>
  )
}

export default Price
