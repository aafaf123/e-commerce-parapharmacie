import { useTranslation } from 'react-i18next'
import { useEffect } from 'react'

export default function LanguageSwitcher({ className = '' }) {
  const { i18n } = useTranslation()
  const isAr = i18n.language?.startsWith('ar')

  useEffect(() => {
    document.documentElement.dir = isAr ? 'rtl' : 'ltr'
    document.documentElement.lang = isAr ? 'ar' : 'fr'
  }, [isAr])

  return (
    <button
      onClick={() => i18n.changeLanguage(isAr ? 'fr' : 'ar')}
      className={`px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-100 transition-colors ${className}`}
      title={isAr ? 'Passer en français' : 'التبديل إلى العربية'}
    >
      {isAr ? 'FR' : 'ع'}
    </button>
  )
}
