import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

const CACHE_KEY = 'auto_tr'

const getCache = () => {
  try { 
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
    // Clear corrupted translations
    const corruptedKeys = ['fr_ar_Complémentaires', 'fr_ar_Hydrataion']
    corruptedKeys.forEach(key => {
      if (cache[key]) delete cache[key]
    })
    return cache
  } catch { return {} }
}

const saveToCache = (key, value) => {
  try {
    const c = getCache()
    c[key] = value
    localStorage.setItem(CACHE_KEY, JSON.stringify(c))
  } catch {}
}

const doTranslate = async (text) => {
  if (!text || typeof text !== 'string' || !text.trim()) return text
  // Skip translation for proper nouns (all caps brand names like BEAUTÉ EXPRESS)
  // and very short texts
  if (text.trim().length < 2) return text
  
  const normalizeText = (value) => value.trim()
  const manualWordReplacements = {
    hydrataion: 'الترطيب',
    hydratant: 'مرطب',
    complémentaire: 'مكمل',
    complémentaires: 'مكملات',
    beauté: 'جمال',
    limited: 'محدود'
  }

  const applyManualReplacements = (value) => {
    let replaced = value
    Object.entries(manualWordReplacements).forEach(([french, arabic]) => {
      const regex = new RegExp(`\\b${french}\\b`, 'gi')
      replaced = replaced.replace(regex, arabic)
    })
    return replaced
  }

  const cleanedText = normalizeText(text)
  const replacedText = applyManualReplacements(cleanedText)
  if (replacedText !== cleanedText) {
    saveToCache('fr_ar_' + cleanedText, replacedText)
    return replacedText
  }

  const cacheKey = 'fr_ar_' + cleanedText
  const cached = getCache()[cacheKey]
  if (cached) return cached
  try {
    const r = await fetch('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) + '&langpair=fr|ar')
    const d = await r.json()
    let result = d?.responseData?.translatedText
    if (result && result !== text) {
      // Clean XML/HTML tags injected by MyMemory (e.g. <x id="1"/>)
      result = result.replace(/<[^>]+>/g, '').trim()
      if (result) {
        saveToCache(cacheKey, result)
        return result
      }
    }
  } catch {}
  return text
}

export const useAutoTranslate = (text) => {
  const { i18n } = useTranslation()
  const isAr = i18n.language?.startsWith('ar')
  const [out, setOut] = useState(text || '')
  const lastText = useRef(null)
  const lastLang = useRef(null)

  useEffect(() => {
    if (lastText.current === text && lastLang.current === isAr) return
    lastText.current = text
    lastLang.current = isAr

    if (!isAr || !text) {
      setOut(text || '')
      return
    }
    const cacheKey = 'fr_ar_' + text.trim()
    const cached = getCache()[cacheKey]
    if (cached) { setOut(cached); return }
    doTranslate(text).then(t => setOut(t || text))
  }, [text, isAr])

  return isAr ? out : (text || '')
}

export const useAutoTranslateObject = (obj, fields) => {
  const { i18n } = useTranslation()
  const isAr = i18n.language?.startsWith('ar')
  const [overrides, setOverrides] = useState({})
  const lastKey = useRef(null)

  useEffect(() => {
    if (!isAr || !obj) { setOverrides({}); return }
    const key = fields.map(f => {
      const value = obj[f]
      return Array.isArray(value)
        ? value.map(item => (typeof item === 'string' ? item : '')).join('|')
        : (obj[f] || '')
    }).join('§')
    if (lastKey.current === key) return
    lastKey.current = key

    const cache = getCache()
    const result = {}
    const pending = []

    fields.forEach(f => {
      const v = obj[f]
      if (!v) return

      if (Array.isArray(v)) {
        const cachedArray = v.map(item => typeof item === 'string' ? cache['fr_ar_' + item.trim()] : item)
        if (cachedArray.every((item, idx) => item !== undefined || typeof v[idx] !== 'string')) {
          result[f] = cachedArray.map((item, idx) => item !== undefined ? item : v[idx])
        } else {
          pending.push(f)
        }
      } else if (typeof v === 'string') {
        const ck = 'fr_ar_' + v.trim()
        if (cache[ck]) result[f] = cache[ck]
        else pending.push(f)
      }
    })

    if (!pending.length) { setOverrides(result); return }

    Promise.all(pending.map(async f => {
      const v = obj[f]
      if (Array.isArray(v)) {
        result[f] = await Promise.all(v.map(async item => typeof item === 'string' ? doTranslate(item) : item))
      } else {
        result[f] = await doTranslate(v)
      }
    })).then(() => setOverrides({ ...result }))
  }, [isAr, obj ? fields.map(f => Array.isArray(obj[f]) ? obj[f].join('|') : obj[f] || '').join('§') : ''])

  if (!isAr || !obj || !Object.keys(overrides).length) return obj
  return { ...obj, ...overrides }
}

export const useAutoTranslateArray = (arr, fields) => {
  const { i18n } = useTranslation()
  const isAr = i18n.language?.startsWith('ar')
  const [out, setOut] = useState(arr || [])
  const lastKey = useRef(null)

  useEffect(() => {
    if (!isAr || !arr?.length) { setOut(arr || []); return }
    const key = arr.map(item => fields.map(f => {
      const value = item[f]
      return Array.isArray(value) ? value.join('|') : (value || '')
    }).join(':')).join('|')
    if (lastKey.current === key) return
    lastKey.current = key

    Promise.all(
      arr.map(async item => {
        const r = { ...item }
        await Promise.all(fields.map(async f => {
          const v = item[f]
          if (!v) return
          if (Array.isArray(v)) {
            const translated = await Promise.all(v.map(async sub => typeof sub === 'string' ? doTranslate(sub) : sub))
            r[f] = translated
            return
          }
          if (typeof v !== 'string') return
          const ck = 'fr_ar_' + v.trim()
          const cached = getCache()[ck]
          r[f] = cached || await doTranslate(v)
        }))
        return r
      })
    ).then(setOut)
  }, [isAr, arr ? arr.map(item => fields.map(f => {
    const value = item[f]
    return Array.isArray(value) ? value.join('|') : (value || '')
  }).join(':')).join('|') : ''])

  return isAr ? out : (arr || [])
}
