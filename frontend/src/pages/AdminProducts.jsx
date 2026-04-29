// frontend/src/pages/AdminProducts.jsx
import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, ArrowLeft, Edit, Trash2, Search, Save, X, Loader2, Package, ChevronDown, ChevronUp, FileText, Tag, Filter, Download, Upload, Percent, Eye, EyeOff } from 'lucide-react'
import adminAxios from '../api/adminAxios'
import axios from '../api/axios'
import ImageUpload from '../components/ImageUpload'
import { useBrands } from '../hooks/useBrands'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { usePermissions } from '../context/PermissionsContext'

// Helper : classe CSS selon permission
const btn = (allowed, activeClass) =>
  allowed ? activeClass : `${activeClass} opacity-40 cursor-not-allowed pointer-events-none`;

const AdminProducts = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const isAr = i18n.language?.startsWith('ar')
  const filterParam = searchParams.get('filter')
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedSubcategory, setSelectedSubcategory] = useState('')
  const [selectedItem, setSelectedItem] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [showImportModal, setShowImportModal] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const fileInputRef = useRef(null)
  const [showAllColumns, setShowAllColumns] = useState(false)
  const [isCategorySuggested, setIsCategorySuggested] = useState(false)
  const [selectedBrand, setSelectedBrand] = useState('')
  const { brands, refreshBrands } = useBrands()
  const { canCreate, canEdit, canDelete } = usePermissions()

  // Cascading data
  const [categories, setCategories] = useState([])
  // Formulaire modal : sous-catégories et items
  const [formSubcategories, setFormSubcategories] = useState([])
  const [formItems, setFormItems] = useState([])
  // Filtres de la liste : sous-catégories et items
  const [subcategories, setSubcategories] = useState([])
  const [items, setItems] = useState([])
  
  // Variants management
  const [variants, setVariants] = useState([])
  const [showVariants, setShowVariants] = useState(false)
  const [variantTypes, setVariantTypes] = useState([])
  const [variantValues, setVariantValues] = useState({}) // Stores values for each variant type

  const [formData, setFormData] = useState({
    name: '',
    priceHT: '',
    taxRate: '20',
    priceTTC: '',
    oldPriceHT: '',
    oldPriceTTC: '',
    discountPercentage: '',
    discountedPriceTTC: '',
    image: '',
    imagePublicId: '',
    stock: '',
    stockAlert: '10',
    categoryId: '',
    subcategoryId: '',
    subcategoryItemId: '',
    description: '',
    utilisation: '',
    composition: '',
    benefits: '',
    barcode: '',
    expiryDate: '',
    active: true
  })


  useEffect(() => {
    fetchProducts()
    fetchCategories()
    fetchVariantTypes()
  }, [])

   // Formulaire : quand categoryId change → mettre à jour formSubcategories
   // NE PAS reset subcategoryId/subcategoryItemId ici (géré manuellement dans handleEdit et handleInputChange)
   useEffect(() => {
    if (formData.categoryId && categories.length > 0) {
      const cat = categories.find(c => c.id === formData.categoryId)
      setFormSubcategories(cat?.subcategories || [])
    } else {
      setFormSubcategories([])
    }
  }, [formData.categoryId, categories])

  // Formulaire : quand subcategoryId change → mettre à jour formItems
  useEffect(() => {
    if (formData.subcategoryId && formSubcategories.length > 0) {
      const sub = formSubcategories.find(s => s.id === formData.subcategoryId)
      setFormItems(sub?.items || [])
    } else {
      setFormItems([])
    }
  }, [formData.subcategoryId, formSubcategories])

  // Sync filter: when selectedCategory changes → filter subcategories
  useEffect(() => {
    if (selectedCategory && categories.length > 0) {
      const cat = categories.find(c => c.id === selectedCategory)
      setSubcategories(cat?.subcategories || [])
    } else {
      setSubcategories([])
    }
    // Reset downstream filters
    setSelectedSubcategory('')
    setSelectedItem('')
    setItems([])
  }, [selectedCategory, categories])

  // Sync filter: when selectedSubcategory changes → filter items
  useEffect(() => {
    if (selectedSubcategory && subcategories.length > 0) {
      const sub = subcategories.find(s => s.id === selectedSubcategory)
      setItems(sub?.items || [])
    } else {
      setItems([])
    }
    // Reset downstream
    setSelectedItem('')
  }, [selectedSubcategory, subcategories])

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/products?limit=500&active=all&t=' + Date.now())
      const products = response.data.products || response.data || []
      // Exclure les produits de la catégorie Promotions
      const normalized = products
        .filter(p => p.category?.name !== 'Promotions')
        .map(p => ({
        ...p,
        productVariants: p.productVariants || []
      }))
      setProducts(normalized)
    } catch (error) {
      console.error('Erreur chargement produits:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      // GET /api/categories returns categories with subcategories and items nested
      const { data } = await axios.get('/categories')
      setCategories(data || [])
    } catch (error) {
      console.error('Erreur chargement catégories:', error)
      setCategories([])
    }
  }

  const fetchVariantTypes = async () => {
    try {
      const { data } = await axios.get('/variant-types')
      setVariantTypes(data.filter(vt => vt.active))
    } catch (error) {
      console.error('Erreur chargement types de variantes:', error)
    }
  }

  // Fetch values for a specific variant type
  const fetchVariantValues = async (variantTypeId) => {
    try {
      const { data } = await axios.get(`/variant-types/${variantTypeId}/values`)
      setVariantValues(prev => ({ ...prev, [variantTypeId]: data }))
    } catch (error) {
      console.error('Erreur chargement valeurs de variantes:', error)
    }
  }

  const exportProducts = async (format = 'csv') => {
    try {
      const response = await axios.get('/products?limit=1000')
      const allProducts = response.data.products || response.data || []
      
      if (!allProducts || allProducts.length === 0) {
        alert(t('admin_products.no_products_export'))
        return
      }

      const exportData = allProducts.map(p => ({
        ID: p.id,
        Nom: p.name,
        'Prix HT': p.priceHT,
        'Prix TTC': p.price || p.priceTTC,
        'Ancien prix': p.oldPrice || '',
        Stock: p.stock,
        'Alerte stock': p.stockAlert,
        Catégorie: p.category?.name || p.category?.title || '',
        'Sous-catégorie': p.subcategory?.title || '',
        Item: p.subcategoryItem?.name || '',
        Marque: p.brand || '',
        'Code-barres': p.barcode || '',
        Description: p.description || '',
        Image: p.image || '',
        Composition: p.composition || '',
        Utilisation: p.usage || '',
        Actif: p.active ? 'Oui' : 'Non',
        'Date expiration': p.expiryDate ? new Date(p.expiryDate).toLocaleDateString('fr-FR') : '',
        Variantes: p.productVariants?.map(v => 
          `${v.type}: ${v.value}`
        ).join(' | ') || '',
        'Prix Variantes': p.productVariants?.map(v => 
          `${v.value}: ${v.price || ''}dh`
        ).join(' | ') || '',
        'Stock Variantes': p.productVariants?.map(v => 
          `${v.value}: ${v.stock}`
        ).join(' | ') || '',
        'Code-barres Variantes': p.productVariants?.map(v => 
          `${v.value}: ${v.barcode || ''}`
        ).join(' | ') || '',
        'Expiration Variantes': p.productVariants?.map(v => 
          `${v.value}: ${v.expiryDate ? new Date(v.expiryDate).toLocaleDateString('fr-FR') : ''}`
        ).join(' | ') || ''
      }))
      
      if (format === 'pdf') {
        const doc = new jsPDF()
        
        const rows = []
        
        allProducts.forEach(p => {
          // Produit principal
          rows.push([
            p.name || '',
            p.category?.name || '',
            p.priceHT?.toFixed(2) || '-',
            (p.price || p.priceTTC)?.toFixed(2) || '-',
            p.stock?.toString() || '0',
            p.brand || '-',
            p.barcode || '-',
            p.expiryDate ? new Date(p.expiryDate).toLocaleDateString('fr-FR') : '-',
            p.active ? 'Oui' : 'Non'
          ])
          
          // Variantes
          if (p.productVariants && p.productVariants.length > 0) {
            p.productVariants.forEach((v, idx) => {
              rows.push([
                `  ↳ ${v.value}`,
                '',
                v.price ? v.price.toFixed(2) : '-',
                v.price ? (v.price * (1 + (p.taxRate || 20) / 100)).toFixed(2) : '-',
                v.stock.toString(),
                '',
                v.barcode || '-',
                v.expiryDate ? new Date(v.expiryDate).toLocaleDateString('fr-FR') : '-',
                ''
              ])
            })
          }
        })

        autoTable(doc, {
          head: [['Nom', 'Catégorie', 'Prix HT', 'Prix TTC', 'Stock', 'Marque', 'Code-barres', 'Expiration', 'Actif']],
          body: rows,
          theme: 'grid',
          startY: 30,
          headStyles: { 
            fillColor: [0, 115, 170], 
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 8
          },
          bodyStyles: {
            fontSize: 8
          },
          columnStyles: {
            0: { cellWidth: 40 },
            1: { cellWidth: 28 },
            2: { cellWidth: 20, halign: 'right' },
            3: { cellWidth: 20, halign: 'right' },
            4: { cellWidth: 18, halign: 'center' },
            5: { cellWidth: 25 },
            6: { cellWidth: 30 },
            7: { cellWidth: 25 },
            8: { cellWidth: 15, halign: 'center' }
          },
          didParseCell: function(data) {
            // Styliser les lignes variantes (indentées)
            if (data.section === 'body' && data.row.index > 0) {
              const row = data.row.raw
              if (row && row[0] && row[0].startsWith('  ↳')) {
                data.cell.styles.fillColor = [245, 247, 250]
                data.cell.styles.fontStyle = 'italic'
              }
            }
          },
          margin: { top: 10, left: 10, right: 10 }
        })
        
        doc.setFontSize(16)
        doc.text('Catalogue Produits', 10, 15)
        doc.setFontSize(10)
        doc.text(`Exporté le: ${new Date().toLocaleDateString('fr-FR')} | Total: ${allProducts.length} produits`, 10, 22)
        
        doc.save(`produits_${new Date().toISOString().split('T')[0]}.pdf`)
        return
      }

      // CSV export
      const csvContent = [
        Object.keys(exportData[0]).join(';'),
        ...exportData.map(row => Object.values(row).map(v => {
          const val = String(v || '')
          return val.includes(';') ? `"${val}"` : val
        }).join(';'))
      ].join('\n')

      const BOM = '\uFEFF'
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `produits_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      setTimeout(() => {
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }, 100)
    } catch (error) {
      console.error('Erreur export:', error)
      alert(t('admin_products.export_error'))
    }
  }

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setImporting(true)
    setImportResult(null)
    setShowImportModal(true)
    
    const formData = new FormData()
    formData.append('file', file)
    
    try {
      const { data } = await axios.post('/products/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      console.log('Import result:', data)
      setImportResult(data)
      fetchProducts()
    } catch (error) {
      console.error('Import error:', error)
      const errorMessage = error.response?.data?.message || error.message || 'Une erreur est survenue'
      setImportResult({ success: false, message: errorMessage })
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    const newValue = type === 'checkbox' ? checked : value
    
    setFormData(prev => {
      const updated = { ...prev, [name]: newValue }
      
      // Auto-calculate TTC if HT or Tax changes
      if (name === 'priceHT' || name === 'taxRate') {
        const ht = parseFloat(name === 'priceHT' ? value : prev.priceHT) || 0
        const tax = parseFloat(name === 'taxRate' ? value : prev.taxRate) || 0
        updated.priceTTC = (ht * (1 + tax / 100)).toFixed(2)
        
        // Recalculate discounted price if discount exists
        if (prev.discountPercentage && parseFloat(prev.discountPercentage) > 0) {
          const discount = parseFloat(prev.discountPercentage) || 0
          updated.discountedPriceTTC = (updated.priceTTC * (1 - discount / 100)).toFixed(2)
        }
      }
      
      if (name === 'oldPriceHT' || name === 'taxRate') {
        const ht = parseFloat(name === 'oldPriceHT' ? value : prev.oldPriceHT) || 0
        const tax = parseFloat(name === 'taxRate' ? value : prev.taxRate) || 0
        updated.oldPriceTTC = ht > 0 ? (ht * (1 + tax / 100)).toFixed(2) : ''
      }
      
      // Calculate discounted price when percentage changes
      if (name === 'discountPercentage') {
        const priceTTC = parseFloat(prev.priceTTC) || 0
        const discount = parseFloat(value) || 0
        if (priceTTC > 0 && discount > 0) {
          updated.discountedPriceTTC = (priceTTC * (1 - discount / 100)).toFixed(2)
        } else {
          updated.discountedPriceTTC = ''
        }
      }
      
      return updated
    })
    setFormError('')
  }


  const validateForm = () => {
    if (!formData.name.trim()) { setFormError(t('admin_products.validate_name_required')); return false }
    if (!formData.priceHT)     { setFormError(t('admin_products.validate_price_required')); return false }
    if (!formData.categoryId)  { setFormError(t('admin_products.validate_category_required')); return false }
    if (formData.stock === '')  { setFormError(t('admin_products.validate_stock_required')); return false }
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) return
    setSaving(true)
    try {
      const productData = {
        name: formData.name.trim(),
        priceHT: parseFloat(formData.priceHT),
        taxRate: parseFloat(formData.taxRate),
        oldPriceHT: formData.oldPriceHT ? parseFloat(formData.oldPriceHT) : null,
        discountPercentage: formData.discountPercentage ? parseFloat(formData.discountPercentage) : null,
        discountedPriceTTC: formData.discountedPriceTTC ? parseFloat(formData.discountedPriceTTC) : null,
        stock: parseInt(formData.stock) || 0,
        image: formData.image || null,
        stockAlert: parseInt(formData.stockAlert) || 10,
        categoryId: formData.categoryId,
        subcategoryId: formData.subcategoryId || null,
        subcategoryItemId: formData.subcategoryItemId || null,
        description: formData.description || null,
        brand: formData.brand?.trim() || null,
        usage: formData.utilisation || null,
        composition: formData.composition || null,
        benefits: formData.benefits
          ? formData.benefits.split(',').map(b => b.trim()).filter(Boolean)
          : [],
        active: formData.active,
        expiryDate: formData.expiryDate || null,
        variants: variants.map(v => ({
          variantTypeId: v.variantTypeId || null,
          variantValueId: v.variantValueId || null,
          type: v.variantTypeName || '',
          value: v.value,
          priceHT: v.priceHT,
          priceTTC: v.priceTTC,
          composition: v.composition || null,
          stock: v.stock,
          image: v.image,
          description: v.description,
          inCatalog: v.inCatalog !== false,
          barcode: v.barcode || null,
          expiryDate: v.expiryDate || null,
          categoryId: formData.categoryId || null,
          subcategoryId: formData.subcategoryId || null,
          subcategoryItemId: formData.subcategoryItemId || null,
          brand: formData.brand || null
        })),
        barcode: formData.barcode || null
      }

      // Auto-créer la marque si saisie (idempotent, case-insensitive)
      if (productData.brand) {
        await axios.post('/brands', { name: productData.brand }).catch(() => {})
        refreshBrands()
      }

      if (editingProduct) {
        await axios.put(`/products/${editingProduct.id}`, productData)
      } else {
        await axios.post('/products', productData)
      }

      setIsModalOpen(false)
      setEditingProduct(null)
      resetForm()
      fetchProducts()
    } catch (error) {
      setFormError(error.response?.data?.message || t('admin_products.save_error'))
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '', priceHT: '', taxRate: '20', priceTTC: '', oldPriceHT: '', oldPriceTTC: '', 
      discountPercentage: '', discountedPriceTTC: '',
      image: '', imagePublicId: '',
      stock: '', stockAlert: '10',
      categoryId: '', subcategoryId: '', subcategoryItemId: '',
      description: '', utilisation: '', composition: '', benefits: '',
      brand: '',
      barcode: '',
      expiryDate: '',
      active: true
    })

    setFormError('')
    setSubcategories([])
    setItems([])
    setVariants([])
    setShowVariants(false)
    setIsCategorySuggested(false)
  }

   const handleImageUpload = (url, publicId) => {
     setFormData(prev => ({
       ...prev,
       image: url,
       imagePublicId: publicId
     }))
   }

   const handleEdit = (product) => {
    setEditingProduct(product)

    // Pre-populate cascading selects BEFORE setting formData
    const cat = categories.find(c => c.id === product.categoryId)
    const subs = cat?.subcategories || []
    const sub = subs.find(s => s.id === product.subcategoryId)
    const itms = sub?.items || []
    
    // Set the cascading data first
    setSubcategories(subs)
    setItems(itms)

    // Then set the form data
    setFormData({
      name: product.name || '',
      priceHT: product.priceHT?.toString() || '',
      taxRate: product.taxRate?.toString() || '20',
      priceTTC: product.priceTTC?.toString() || product.price?.toString() || '',
      oldPriceHT: product.oldPriceHT?.toString() || '',
      oldPriceTTC: product.oldPrice?.toString() || '',
      image: product.image || '',

      stock: product.stock?.toString() || '',
      stockAlert: product.stockAlert?.toString() || '10',
      categoryId: product.categoryId || '',
      subcategoryId: product.subcategoryId || '',
      subcategoryItemId: product.subcategoryItemId || '',
      description: product.description || '',
      utilisation: product.usage || '',
      composition: product.composition || '',
      benefits: Array.isArray(product.benefits) ? product.benefits.join(', ') : '',
      brand: product.brand || '',
      barcode: product.barcode || '',
      expiryDate: product.expiryDate ? new Date(product.expiryDate).toISOString().split('T')[0] : '',
      active: product.active !== false
    })

    // Load variants
    const loadedVariants = product.productVariants || []
    const productPrice = product.priceHT || 0
    setVariants(loadedVariants.map(v => ({
      id: v.id,
      variantTypeId: v.variantTypeId || '',
      variantTypeName: v.variantType?.label || v.type || '',
      variantValueId: v.variantValueId || '',
      value: v.value,
      priceHT: v.priceHT != null ? v.priceHT : (v.priceAdjustment != null ? productPrice + v.priceAdjustment : null),
      priceTTC: v.priceTTC || (v.priceHT ? (v.priceHT * 1.2).toFixed(2) : null),
      composition: v.composition || '',
      stock: v.stock,
      image: v.image || '',
      description: v.description || '',
      inCatalog: v.inCatalog !== false,
      barcode: v.barcode || '',
      expiryDate: v.expiryDate ? new Date(v.expiryDate).toISOString().split('T')[0] : ''
    })))

    setIsModalOpen(true)
  }

  const handleDelete = async (productId) => {
    if (!window.confirm(t('admin_products.delete_confirm'))) return
    try {
      await axios.delete(`/products/${productId}`)
      fetchProducts()
    } catch (error) {
      alert('Erreur lors de la suppression')
    }
  }

  const handleDeleteVariant = async (productId, variantId) => {
    if (!window.confirm('Supprimer cette variante ?')) return
    try {
      await axios.delete(`/products/${productId}/variants/${variantId}`)
      fetchProducts()
    } catch (error) {
      alert('Erreur lors de la suppression de la variante')
    }
  }

  const handleToggleActive = async (productId, currentStatus) => {
    const action = currentStatus ? 'désactiver' : 'activer'
    if (!window.confirm(`Êtes-vous sûr de vouloir ${action} ce produit ?`)) return
    
    try {
      await axios.put(`/products/${productId}`, { active: !currentStatus })
      fetchProducts()
    } catch (error) {
      alert(`Erreur lors de la ${action === 'désactiver' ? 'désactivation' : 'activation'}`)
    }
  }

  const filteredProducts = products.filter(p => {
    const matchesSearch = !searchTerm || p.name?.toLowerCase().includes(searchTerm.toLowerCase())
    if (!matchesSearch) return false
    if (selectedCategory && p.categoryId !== selectedCategory) return false
    if (selectedSubcategory && p.subcategoryId !== selectedSubcategory) return false
    if (selectedItem && p.subcategoryItemId !== selectedItem) return false
    if (selectedBrand && p.brand?.toLowerCase() !== selectedBrand.toLowerCase()) return false
    return true
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-700 mx-auto" />
          <p className="mt-4 text-gray-600">{t('admin_products.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Filter Indicator Banner */}
        {filterParam && (
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm border-l-4 border-l-sky-500 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-3 text-sky-800">
              <div className="p-2 bg-sky-100 rounded-lg">
                <Filter size={18} className="text-sky-700" />
              </div>
              <div>
                <p className="font-bold text-sm">{t('admin_products.filter_view')}</p>
                <p className="text-xs opacity-90">
                  {
                filterParam === 'low-stock' ? t('admin_products.filter_low_stock') :
                    filterParam === 'out-of-stock' ? t('admin_products.filter_out_of_stock') :
                    filterParam === 'expiring' ? t('admin_products.filter_expiring') : filterParam
                  }
                </p>
              </div>
            </div>
            <button 
              onClick={() => {
                const newParams = new URLSearchParams(searchParams);
                newParams.delete('filter');
                setSearchParams(newParams);
                navigate('/admin/products');
              }}
              className="px-3 py-1.5 bg-white border border-sky-200 text-sky-700 font-bold rounded-lg hover:bg-sky-50 transition-all shadow-sm flex items-center gap-1 text-sm"
            >
              <X size={14} /> <span className="hidden sm:inline">{t('admin_products.filter_banner_clear')}</span>
            </button>
          </div>
        )}

        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 mb-6 border border-gray-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/admin/dashboard')}
                className="p-2 bg-gray-50 text-gray-700 hover:text-sky-700 hover:bg-sky-50 rounded-xl transition-all border border-gray-100 flex items-center gap-2 group"
                title={i18n.language?.startsWith('ar') ? 'العودة إلى لوحة التحكم' : 'Retour au Tableau de Bord'}
              >
                <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                <span className="text-sm font-semibold hidden lg:inline">{i18n.language?.startsWith('ar') ? 'لوحة التحكم' : 'Dashboard'}</span>
              </button>
              <div className="h-8 w-px bg-gray-200 hidden md:block"></div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">{t('admin_products.title')}</h1>
                <p className="text-xs text-gray-500 mt-0.5">{t('admin_products.count', { n: products.length })}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              <div className="relative group">
                <button
                  onClick={() => exportProducts('pdf')}
                  className="flex items-center gap-2 bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 px-3 py-2 rounded-lg transition-colors font-medium text-sm"
                >
                  <Download size={16} />
                  <span className="hidden sm:inline">Exporter PDF</span>
                </button>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv,.xlsx,.xls"
                onChange={handleImport}
                className="hidden"
              />
              {canCreate('products') && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing || !canCreate('products')}
                className={btn(canCreate('products'), 'flex items-center gap-2 bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 px-3 py-2 rounded-lg transition-colors font-medium text-sm disabled:opacity-50')}
              >
                {importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                <span className="hidden sm:inline">{t('admin_products.import')}</span>
              </button>
              )}
              {canCreate('products') && (
              <button
                onClick={() => { setEditingProduct(null); resetForm(); setIsModalOpen(true) }}
                className={btn(canCreate('products'), 'flex items-center gap-2 bg-sky-700 hover:bg-sky-800 text-white px-3 py-2 rounded-lg transition-colors text-sm')}
              >
                <Plus size={18} />
                <span className="hidden sm:inline">{t('admin_products.add')}</span>
              </button>
              )}
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 space-y-4">
          {/* Main Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder={t('admin_products.search_placeholder')}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 whitespace-nowrap">
              <input type="checkbox" checked={showAllColumns} onChange={e => setShowAllColumns(e.target.checked)} className="w-4 h-4 text-sky-600 rounded" />
              {t('admin_products.filter_view_label')}
            </label>
              <span className="text-sm text-gray-500 text-center sm:text-left font-semibold">{t('admin_products.results', { n: filteredProducts.length })}</span>
          </div>

          {/* Advanced Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700 text-sm"
            >
              <option value="">{t('admin_products.all_categories')}</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>

            {/* Subcategory Filter */}
            <select
              value={selectedSubcategory}
              onChange={e => setSelectedSubcategory(e.target.value)}
              disabled={!selectedCategory}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700 text-sm disabled:bg-gray-100 disabled:text-gray-400"
            >
              <option value="">{t('admin_products.all_subcategories')}</option>
              {subcategories.map(sub => (
                <option key={sub.id} value={sub.id}>{sub.title}</option>
              ))}
            </select>

            {/* Item Filter */}
            <select
              value={selectedItem}
              onChange={e => setSelectedItem(e.target.value)}
              disabled={!selectedSubcategory}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700 text-sm disabled:bg-gray-100 disabled:text-gray-400"
            >
              <option value="">{t('admin_products.all_items')}</option>
              {items.map(item => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>

            {/* Brand Filter */}
            <select
              value={selectedBrand}
              onChange={e => setSelectedBrand(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700 text-sm"
            >
              <option value="">Toutes les marques</option>
              {brands.map(b => (
                <option key={b.id} value={b.name}>{b.name}</option>
              ))}
            </select>

            {/* Reset Button */}
            {(searchTerm || selectedCategory || selectedSubcategory || selectedItem || selectedBrand) && (
              <button
                onClick={() => {
                  setSearchTerm('')
                  setSelectedCategory('')
                  setSelectedSubcategory('')
                  setSelectedItem('')
                  setSelectedBrand('')
                }}
                className="px-3 py-2 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors"
              >
                {t('admin_products.reset_filters')}
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {showAllColumns ? (
                    <>
                      <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{t('admin_products.image_label')}</th>
                      <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">ID</th>
                      <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Nom</th>
                      <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Catégorie</th>
                      <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Sous-cat.</th>
                      <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Item</th>
                      <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Marque</th>
                      <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Prix HT</th>
                      <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Prix TTC</th>
                      <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Stock</th>
                      <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Code-barres</th>
                      <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Expiration</th>
                      <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </>
                  ) : (
                    <>
                      {['Image', 'Nom', 'Catégorie', 'Prix HT', 'Prix TTC', 'Stock', 'Statut', 'Actions'].map(h => (
                         <th key={h} className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>
                       ))}
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredProducts.map(product => (
                  <React.Fragment key={product.id}>
                    {/* PRODUCT ROW */}
                    <tr key={product.id} className="hover:bg-gray-50 bg-white">
                      {showAllColumns ? (
                        <>
                          <td className="px-2 py-2">
                            {product.image
                              ? <img src={product.image} alt={product.name} className="w-8 h-8 object-cover rounded" onError={e => { e.target.src = '/images/placeholder.svg' }} />
                              : <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center"><Package size={12} className="text-gray-400" /></div>
                            }
                          </td>
                          <td className="px-2 py-2 text-xs text-gray-400 font-mono max-w-[80px] truncate">{product.id.slice(0, 8)}</td>
                          <td className="px-2 py-2 text-xs font-medium text-gray-900 max-w-[150px] truncate">{product.name}</td>
                          <td className="px-2 py-2 text-xs text-gray-500 max-w-[100px] truncate">{product.category?.name || '—'}</td>
                          <td className="px-2 py-2 text-xs text-gray-500 max-w-[100px] truncate">{product.subcategory?.title || '—'}</td>
                          <td className="px-2 py-2 text-xs text-gray-500 max-w-[100px] truncate">{product.subcategoryItem?.name || '—'}</td>
                          <td className="px-2 py-2 text-xs text-gray-500 max-w-[80px] truncate">{product.brand || '—'}</td>
                          <td className="px-2 py-2 text-xs">
                            <span className="font-medium">{product.priceHT || '0'} DH</span>
                          </td>
                          <td className="px-2 py-2 text-xs">
                            <span className="font-medium">{product.price || product.priceTTC || '0'} DH</span>
                            {product.oldPrice && <div className="text-xs text-gray-400 line-through">{product.oldPrice} DH</div>}
                          </td>
                          <td className="px-2 py-2">
                            <span className={`px-1.5 py-0.5 text-xs font-semibold rounded-full ${
                              product.stock > 10 ? 'bg-green-100 text-green-800'
                              : product.stock > 0 ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                            }`}>{product.stock}</span>
                          </td>
                          <td className="px-2 py-2 text-xs text-gray-500 font-mono max-w-[100px] truncate">{product.barcode || '—'}</td>
                          <td className="px-2 py-2 text-xs text-gray-500">
                            {product.expiryDate ? new Date(product.expiryDate).toLocaleDateString(isAr ? 'ar-MA' : 'fr-FR') : '—'}
                          </td>
                          <td className="px-2 py-2">
                            <button onClick={() => canEdit('products') && handleEdit(product)} disabled={!canEdit('products')} className={btn(canEdit('products'), 'text-sky-600 hover:text-sky-900 p-1 mr-1')} title="Modifier"><Edit size={14} /></button>
                            <button 
                              onClick={() => handleToggleActive(product.id, product.active)}
                              className={`p-1 mr-1 ${product.active ? 'text-orange-600 hover:text-orange-900' : 'text-green-600 hover:text-green-900'}`}
                              title={product.active ? 'Désactiver' : 'Activer'}
                            >
                              {product.active ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                            <button onClick={() => canDelete('products') && handleDelete(product.id)} disabled={!canDelete('products')} className={btn(canDelete('products'), 'text-red-600 hover:text-red-900 p-1')} title="Supprimer"><Trash2 size={14} /></button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-3">
                            {product.image
                              ? <img src={product.image} alt={product.name} className="w-10 h-10 object-cover rounded" onError={e => { e.target.src = '/images/placeholder.svg' }} />
                              : <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center"><Package size={16} className="text-gray-400" /></div>
                            }
                          </td>
                          <td className="px-3 py-3 text-sm font-medium text-gray-900 max-w-[200px] truncate">{product.name}</td>
                          <td className="px-3 py-3 text-sm text-gray-500">{product.category?.name || '—'}</td>
                          <td className="px-3 py-3 text-sm">
                            <span className="font-medium">{product.priceHT || '0'} DH</span>
                          </td>
                          <td className="px-3 py-3 text-sm">
                            <span className="font-medium">{product.price || product.priceTTC || '0'} DH</span>
                            {product.oldPrice && <div className="text-xs text-gray-400 line-through">{product.oldPrice} DH</div>}
                          </td>
                          <td className="px-3 py-3">
                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                              product.stock > 10 ? 'bg-green-100 text-green-800'
                              : product.stock > 0 ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                            }`}>{product.stock}</span>
                          </td>
                          <td className="px-3 py-3">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              product.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {product.active ? 'Actif' : 'Inactif'}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-sm">
                            <button onClick={() => canEdit('products') && handleEdit(product)} disabled={!canEdit('products')} className={btn(canEdit('products'), 'text-sky-600 hover:text-sky-900 p-1 mr-1')} title="Modifier"><Edit size={16} /></button>
                            <button 
                              onClick={() => handleToggleActive(product.id, product.active)}
                              className={`p-1 mr-1 ${product.active ? 'text-orange-600 hover:text-orange-900' : 'text-green-600 hover:text-green-900'}`}
                              title={product.active ? 'Désactiver' : 'Activer'}
                            >
                              {product.active ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                            <button onClick={() => canDelete('products') && handleDelete(product.id)} disabled={!canDelete('products')} className={btn(canDelete('products'), 'text-red-600 hover:text-red-900 p-1')} title="Supprimer"><Trash2 size={16} /></button>
                          </td>
                        </>
                      )}
                    </tr>

                    {/* VARIANTS ROWS (Sub-rows) */}
                    {product.productVariants && product.productVariants.length > 0 && (
                      product.productVariants.map(variant => (
                        <tr key={variant.id} className="hover:bg-blue-50 bg-gray-50 border-l-4 border-l-blue-300">
                        {showAllColumns ? (
                             <>
                               <td className="px-2 py-2 pl-8">
                                 {variant.image && variant.image.startsWith('http') ? (
                                   <img src={variant.image} alt={variant.value} className="w-6 h-6 object-cover rounded" onError={e => { e.target.src = '/images/placeholder.svg' }} />
                                 ) : (
                                   <div className="w-6 h-6 flex items-center justify-center text-xs text-gray-400"><X size={12} /></div>
                                 )}
                               </td>
                               <td className="px-2 py-2 text-xs text-gray-400 font-mono max-w-[80px] truncate">{variant.id.slice(0, 8)}</td>
                               <td className="px-2 py-2 text-xs font-medium text-blue-900 max-w-[150px] truncate">
                                 {variant.value}
                               </td>
                               <td className="px-2 py-2 text-xs text-gray-500 max-w-[100px] truncate">{product.category?.name || '—'}</td>
                               <td className="px-2 py-2 text-xs text-gray-500 max-w-[100px] truncate">{product.subcategory?.title || '—'}</td>
                               <td className="px-2 py-2 text-xs text-gray-500 max-w-[100px] truncate">{product.subcategoryItem?.name || '—'}</td>
                               <td className="px-2 py-2 text-xs text-gray-500 max-w-[80px] truncate">{product.brand || '—'}</td>
                               <td className="px-2 py-2 text-xs font-medium">
                                 {variant.priceHT ? `${variant.priceHT} DH` : 'Hérité'}
                               </td>
                               <td className="px-2 py-2 text-xs font-medium">
                                 {variant.priceTTC ? `${variant.priceTTC} DH` : 'Hérité'}
                               </td>
                               <td className="px-2 py-2">
                                 <span className={`px-1.5 py-0.5 text-xs font-semibold rounded-full ${
                                   variant.stock > 5 ? 'bg-green-100 text-green-800'
                                   : variant.stock > 0 ? 'bg-yellow-100 text-yellow-800'
                                   : 'bg-red-100 text-red-800'
                                 }`}>{variant.stock}</span>
                               </td>
                               <td className="px-2 py-2 text-xs text-gray-500 max-w-[100px] truncate">{variant.barcode || '—'}</td>
                               <td className="px-2 py-2 text-xs text-gray-500">
                                 {variant.expiryDate ? (() => {
                                   try {
                                     const d = new Date(variant.expiryDate);
                                     return isNaN(d.getTime()) ? '—' : d.toLocaleDateString(isAr ? 'ar-MA' : 'fr-FR');
                                   } catch {
                                     return '—'
                                   }
                                 })() : '—'}
                               </td>
                               <td className="px-2 py-2">
                                 <button onClick={() => canEdit('products') && handleEdit(product)} disabled={!canEdit('products')} className={btn(canEdit('products'), 'text-sky-600 hover:text-sky-900 p-1')}><Edit size={14} /></button>
                                 <button onClick={() => canDelete('products') && handleDeleteVariant(product.id, variant.id)} disabled={!canDelete('products')} className={btn(canDelete('products'), 'text-red-600 hover:text-red-900 p-1')}><Trash2 size={14} /></button>
                               </td>
                             </>
                           ) : (
                              <>
                                <td className="px-3 py-2 pl-8">
                                  {variant.image && variant.image.startsWith('http') ? (
                                    <img src={variant.image} alt={variant.value} className="w-8 h-8 object-cover rounded" onError={e => { e.target.src = '/images/placeholder.svg' }} />
                                  ) : (
                                    <div className="w-8 h-8 flex items-center justify-center text-xs text-gray-400"><X size={12} /></div>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-sm font-medium text-blue-900">
                                  ↳ {variant.value}
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-500">{product.category?.name || '—'}</td>
                                <td className="px-3 py-2 text-sm text-gray-600">
                                  {variant.priceHT ? `${variant.priceHT} DH` : 'Hérité'}
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-600">
                                  {variant.priceTTC ? `${variant.priceTTC} DH` : 'Hérité'}
                                </td>
                                <td className="px-3 py-2">
                                  <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                                    variant.stock > 5 ? 'bg-green-100 text-green-800'
                                    : variant.stock > 0 ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800'
                                  }`}>{variant.stock}</span>
                                </td>
                                <td className="px-3 py-2">
                                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                    Variante
                                  </span>
                                </td>
                                <td className="px-3 py-2">
                                  <button onClick={() => canEdit('products') && handleEdit(product)} disabled={!canEdit('products')} className={btn(canEdit('products'), 'text-sky-600 hover:text-sky-900 p-1')}><Edit size={16} /></button>
                                  <button onClick={() => canDelete('products') && handleDeleteVariant(product.id, variant.id)} disabled={!canDelete('products')} className={btn(canDelete('products'), 'text-red-600 hover:text-red-900 p-1')}><Trash2 size={16} /></button>
                                </td>
                              </>
                          )}
                        </tr>
                      ))
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4 my-6">
            <div className="flex items-center justify-between p-4 md:p-6 border-b sticky top-0 bg-white z-10">
              <h2 className="text-lg md:text-xl font-semibold text-gray-900">
                {editingProduct ? t('admin_products.modal_edit') : t('admin_products.modal_add')}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={22} />
              </button>
            </div>

            {formError && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{formError}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="p-6 space-y-5">

              {/* Barcode Display */}
              {formData.barcode && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tag size={16} className="text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">{t('admin_products.barcode_display_label')} {formData.barcode}</span>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setFormData(prev => ({ ...prev, barcode: '' }))}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {t('admin_products.barcode_clear')}
                  </button>
                </div>
              )}

              {/* Nom */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin_products.name_label')}</label>
                <input type="text" name="name" value={formData.name} onChange={handleInputChange} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700" />
              </div>

              {/* Marque */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin_products.brand_label')}</label>
                <input type="text" name="brand" value={formData.brand} onChange={handleInputChange}
                  placeholder="ex: Doliprane, Nivea, SVR..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700" />
              </div>

              {/* Catégorie → Sous-catégorie → Item */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                    {t('admin_products.category_label')}
                    {isCategorySuggested && (
                      <span className="flex items-center gap-1 text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full border border-yellow-200 animate-pulse">
                        <span className="w-1 h-1 bg-yellow-400 rounded-full"></span>
                        {t('admin_products.suggested')}
                      </span>
                    )}
                  </label>
                  <select 
                    name="categoryId" 
                    value={formData.categoryId} 
                    onChange={(e) => {
                      handleInputChange(e);
                      setIsCategorySuggested(false); // Remove highlight on manual change
                    }} 
                    required
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-sky-700 transition-colors ${
                      isCategorySuggested ? 'bg-yellow-50 border-yellow-300 ring-2 ring-yellow-100' : 'border-gray-300'
                    }`}
                  >
                    <option value="">-- {t('admin_products.category_label')} --</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin_products.subcategory_label')}</label>
                  <select name="subcategoryId" value={formData.subcategoryId} onChange={handleInputChange}
                    disabled={!formData.categoryId || subcategories.length === 0}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700 disabled:bg-gray-100 disabled:text-gray-400">
                    <option value="">{t('admin_products.subcategory_placeholder')}</option>
                    {subcategories.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                  </select>
                  {formData.categoryId && subcategories.length === 0 && (
                    <p className="text-xs text-gray-400 mt-1">{t('admin_products.no_subcategory')}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin_products.item_label')}</label>
                  <select name="subcategoryItemId" value={formData.subcategoryItemId} onChange={handleInputChange}
                    disabled={!formData.subcategoryId || items.length === 0}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700 disabled:bg-gray-100 disabled:text-gray-400">
                    <option value="">{t('admin_products.item_placeholder')}</option>
                    {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                  {formData.subcategoryId && items.length === 0 && (
                    <p className="text-xs text-gray-400 mt-1">{t('admin_products.no_item')}</p>
                  )}
                </div>
              </div>

               {/* Barcode Field */}
               <div>
                 <label className="block text-sm font-semibold text-green-800 mb-2">{t('admin_products.barcode_label')}</label>
                 <input 
                   type="text" 
                   name="barcode" 
                   value={formData.barcode} 
                   onChange={handleInputChange} 
                   placeholder="Saisissez le code-barres..."
                   className="w-full px-3 py-2 border border-green-200 rounded-lg focus:outline-none focus:border-green-600 bg-white"
                 />
               </div>

              {/* Stock */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin_products.stock_label')}</label>
                  <input type="number" name="stock" value={formData.stock} onChange={handleInputChange} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin_products.stock_alert_label')}</label>
                  <input type="number" name="stockAlert" value={formData.stockAlert} onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700" />
                </div>
              </div>

              {/* Pricing Section */}
              <div className="bg-sky-50/50 p-4 rounded-xl border border-sky-100 space-y-4">
                <div className="flex items-center gap-2 mb-1 text-sky-800 font-semibold text-sm">
                  <Tag size={16} /> {t('admin_products.price_config')}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('admin_products.price_ht')}</label>
                    <input type="number" name="priceHT" value={formData.priceHT} onChange={handleInputChange} step="0.01" required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700 bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('admin_products.tax_rate')}</label>
                    <select name="taxRate" value={formData.taxRate} onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700 bg-white">
                      <option value="20">20% (Standard)</option>
                      <option value="14">14%</option>
                      <option value="10">10%</option>
                      <option value="7">7%</option>
                      <option value="0">0% (Exonéré)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-sky-600 uppercase mb-1">{t('admin_products.price_ttc')}</label>
                    <div className="px-3 py-2 bg-sky-100 border border-sky-200 rounded-lg font-bold text-sky-900">
                      {formData.priceTTC || '0.00'} DH
                    </div>
                  </div>
                </div>

                

                {formData.priceTTC && parseFloat(formData.priceTTC) > 0 && (
                  <div className="bg-orange-50/50 p-4 rounded-xl border border-orange-100 space-y-4">
                    <div className="flex items-center gap-2 mb-1 text-orange-800 font-semibold text-sm">
                      <Percent size={16} /> {t('admin_products.promotion_optional')}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-orange-600 uppercase mb-1">{t('admin_products.discount_pct_label')}</label>
                        <input 
                          type="number" 
                          name="discountPercentage" 
                          value={formData.discountPercentage} 
                          onChange={handleInputChange} 
                          step="0.01"
                          min="0"
                          max="100"
                          placeholder="ex: 20 pour 20%"
                          className="w-full px-3 py-2 border border-orange-200 rounded-lg focus:outline-none focus:border-orange-500 bg-white" 
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-orange-600 uppercase mb-1">{t('admin_products.normal_price_label')}</label>
                        <div className="px-3 py-2 bg-orange-100 border border-orange-200 rounded-lg text-orange-900">
                          {formData.priceTTC} DH
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-green-600 uppercase mb-1">{t('admin_products.new_price_label')}</label>
                        <div className="px-3 py-2 bg-green-100 border border-green-200 rounded-lg font-bold text-green-900">
                          {formData.discountedPriceTTC ? `${formData.discountedPriceTTC} DH` : '—'}
                        </div>
                      </div>
                    </div>
                    {formData.discountPercentage && parseFloat(formData.discountPercentage) > 0 && (
                      <div className="text-center">
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm font-medium">
                          {t('admin_products.discount_badge', { n: formData.discountPercentage })}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Expiry Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin_products.expiry_label')}</label>
                  <input type="date" name="expiryDate" value={formData.expiryDate} onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700" />
                </div>
              </div>


              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin_products.image_label')}</label>
                <ImageUpload
                  type="product"
                  currentImage={formData.image}
                  onUploadSuccess={handleImageUpload}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin_products.description_label')}</label>
                <textarea name="description" value={formData.description} onChange={handleInputChange} rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700" />
              </div>

              {/* Composition - Composants séparés par virgule */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin_products.composition_label')}</label>
                <input 
                  type="text" 
                  name="composition" 
                  value={formData.composition} 
                  onChange={handleInputChange}
                  placeholder="Ex: Eau, Glycérine, Aloe Vera, Vitamine E"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700" 
                />
              </div>

              {/* Actif */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="active" checked={formData.active} onChange={handleInputChange}
                  className="w-4 h-4 text-sky-600 rounded" />
                <span className="text-sm text-gray-700">{t('admin_products.active_label')}</span>
              </label>

              {/* Variantes */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Tag size={18} className="text-sky-700" />
                    <span className="text-sm font-semibold text-gray-900">{t('admin_products.variants_section_title')}</span>
                    {variants.length > 0 && (
                      <span className="bg-sky-100 text-sky-700 text-xs px-2 py-0.5 rounded-full">{variants.length}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowVariants(!showVariants)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
                      showVariants 
                        ? 'bg-sky-100 text-sky-700 border border-sky-200' 
                        : 'bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100'
                    }`}
                  >
                    {showVariants ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {showVariants ? t('admin_products.hide_variants') : t('admin_products.manage_variants', { n: variants.length })}
                  </button>
                </div>

                {showVariants && (
                  <div className="space-y-4">
                    {/* Add variant button */}
                    <button
                      type="button"
                      onClick={() => setVariants([...variants, { id: Date.now().toString(), variantTypeId: '', variantTypeName: '', value: '', priceHT: null, priceTTC: null, composition: '', stock: 0, image: '', description: '', inCatalog: true, barcode: '', expiryDate: '' }])}
                      className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-sky-500 hover:text-sky-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus size={16} /> {t('admin_products.add_variant')}
                    </button>

                    {/* Variants list */}
                    {variants.length > 0 && (
                      <div className="space-y-3">
                        {variants.map((variant, index) => (
                          <div key={variant.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-sm font-semibold text-gray-700">{t('admin_products.variant_num', { n: index + 1 })}</span>
                              <button
                                type="button"
                                onClick={() => setVariants(variants.filter((_, i) => i !== index))}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">{t('admin_products.variant_type')}</label>
                                <select
                                  value={variant.variantTypeId || ''}
                                  onChange={(e) => {
                                    const newVariants = [...variants]
                                    newVariants[index].variantTypeId = e.target.value
                                    newVariants[index].variantTypeName = variantTypes.find(vt => vt.id === e.target.value)?.label || ''
                                    newVariants[index].value = '' // Reset value when type changes
                                    setVariants(newVariants)
                                    if (e.target.value) {
                                      fetchVariantValues(e.target.value)
                                    }
                                  }}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                >
                                  <option value="">{t('admin_products.select_variant_type')}</option>
                                  {variantTypes.map(vt => (
                                    <option key={vt.id} value={vt.id}>{vt.label}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">{t('admin_products.variant_value')}</label>
                                {variant.variantTypeId && variantValues[variant.variantTypeId]?.length > 0 ? (
                                  // Si le type a des valeurs, afficher un dropdown
                                  <select
                                    value={variant.value}
                                    onChange={(e) => {
                                      const newVariants = [...variants]
                                      newVariants[index].value = e.target.value
                                      setVariants(newVariants)
                                    }}
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                  >
                                    <option value="">{t('admin_products.select_variant_value')}</option>
                                    {variantValues[variant.variantTypeId].map(val => (
                                      <option key={val.id} value={val.value}>{val.value}</option>
                                    ))}
                                  </select>
                                ) : (
                                  // Sinon, afficher un input texte
                                  <input
                                    type="text"
                                    value={variant.value}
                                    onChange={(e) => {
                                      const newVariants = [...variants]
                                      newVariants[index].value = e.target.value
                                      setVariants(newVariants)
                                    }}
                                    placeholder={t('admin_products.variant_value_placeholder')}
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                  />
                                )}
                              </div>
                              
                              {/* Prix HT */}
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Prix HT (DH)</label>
                                <input
                                  type="number"
                                  value={variant.priceHT || ''}
                                  onChange={(e) => {
                                    const newVariants = [...variants]
                                    const priceHT = e.target.value ? parseFloat(e.target.value) : null
                                    newVariants[index].priceHT = priceHT
                                    // Auto-calculate TTC
                                    if (priceHT) {
                                      const taxRate = parseFloat(formData.taxRate) || 20
                                      newVariants[index].priceTTC = (priceHT * (1 + taxRate / 100)).toFixed(2)
                                    } else {
                                      newVariants[index].priceTTC = null
                                    }
                                    setVariants(newVariants)
                                  }}
                                  step="0.01"
                                  placeholder={t('admin_products.variant_price_placeholder')}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                />
                              </div>
                              
                              {/* Prix TTC (calculé automatiquement) */}
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Prix TTC (Auto)</label>
                                <div className="px-2 py-1.5 bg-gray-100 border border-gray-300 rounded text-sm text-gray-700">
                                  {variant.priceTTC ? `${variant.priceTTC} DH` : 'Hérité'}
                                </div>
                              </div>
                              
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Stock</label>
                                <input
                                  type="number"
                                  value={variant.stock}
                                  onChange={(e) => {
                                    const newVariants = [...variants]
                                    newVariants[index].stock = parseInt(e.target.value) || 0
                                    setVariants(newVariants)
                                  }}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                />
                              </div>
                              
                              {/* Composition */}
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Composition</label>
                                <input
                                  type="text"
                                  value={variant.composition || ''}
                                  onChange={(e) => {
                                    const newVariants = [...variants]
                                    newVariants[index].composition = e.target.value
                                    setVariants(newVariants)
                                  }}
                                  placeholder="Ex: Coton 100%, Polyester..."
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Image</label>
                                {variant.image ? (
                                  <div className="relative inline-block">
                                    <img src={variant.image} alt="Variant" className="w-20 h-20 object-cover rounded-lg border" />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const newVariants = [...variants]
                                        newVariants[index].image = ''
                                        setVariants(newVariants)
                                      }}
                                      className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                ) : (
                                  <label className="cursor-pointer">
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={async (e) => {
                                        const file = e.target.files[0]
                                        if (!file) return
                                        
                                        const formData = new FormData()
                                        formData.append('image', file)
                                        
                                        try {
                                          const { data } = await axios.post('/upload/product', formData, {
                                            headers: { 'Content-Type': 'multipart/form-data' }
                                          })
                                          const newVariants = [...variants]
                                          newVariants[index].image = data.url
                                          setVariants(newVariants)
                                        } catch (err) {
                                          console.error('Erreur upload:', err)
                                        }
                                      }}
                                      className="hidden"
                                    />
                                    <div className="w-20 h-20 border-2 border-dashed border-gray-300 hover:border-sky-700 rounded-lg flex items-center justify-center">
                                      <Upload size={20} className="text-gray-400" />
                                    </div>
                                  </label>
                                )}
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-xs text-gray-500 mb-1">{t('admin_products.variant_desc_label')}</label>
                                <textarea
                                  value={variant.description}
                                  onChange={(e) => {
                                    const newVariants = [...variants]
                                    newVariants[index].description = e.target.value
                                    setVariants(newVariants)
                                  }}
                                  rows={2}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">{t('admin_products.variant_barcode_label')}</label>
                                <input
                                  type="text"
                                  value={variant.barcode || ''}
                                  onChange={(e) => {
                                    const newVariants = [...variants]
                                    newVariants[index].barcode = e.target.value
                                    setVariants(newVariants)
                                  }}
                                  placeholder={t('admin_products.variant_barcode_label')}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">{t('admin_products.variant_expiry_label')}</label>
                                <input
                                  type="date"
                                  value={variant.expiryDate || ''}
                                  onChange={(e) => {
                                    const newVariants = [...variants]
                                    newVariants[index].expiryDate = e.target.value
                                    setVariants(newVariants)
                                  }}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                />
                              </div>
                              <div className="md:col-span-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={variant.inCatalog !== false}
                                    onChange={(e) => {
                                      const newVariants = [...variants]
                                      newVariants[index].inCatalog = e.target.checked
                                      setVariants(newVariants)
                                    }}
                                    className="w-4 h-4 text-sky-600 border-gray-300 rounded focus:ring-sky-500"
                                  />
                                  <span className="text-sm text-gray-700">{t('admin_products.variant_visible')}</span>
                                </label>
                                <p className="text-xs text-gray-500 ml-6">Si décoché, la variante ne sera pas affichée sur le site mais sera visible dans l'espace admin et pourra être commandée via la fiche produit</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                  {t('admin_products.cancel')}
                </button>
                <button type="submit" disabled={saving} className="px-5 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg flex items-center gap-2 disabled:opacity-50">
                  {saving
                    ? <><Loader2 size={16} className="animate-spin" />{editingProduct ? t('admin_products.editing') : t('admin_products.saving')}</>
                    : <><Save size={16} />{editingProduct ? t('admin_products.modal_edit') : t('admin_products.save')}</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
       {/* Import Result Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 my-6">
            <div className="flex items-center justify-between p-4 md:p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-900">{t('admin_products.import_title')}</h2>
              <button onClick={() => { setShowImportModal(false); setImportResult(null) }} className="text-gray-400 hover:text-gray-600">
                <X size={22} />
              </button>
            </div>
            <div className="p-6">
              {importing ? (
                <div className="text-center py-8">
                  <Loader2 size={40} className="animate-spin text-sky-700 mx-auto mb-4" />
                  <p className="text-gray-600">{t('admin_products.importing')}</p>
                </div>
              ) : importResult ? (
                <div>
                  {importResult.success ? (
                    <>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                        <p className="text-green-800 font-semibold">✓ {t('admin_products.import_success')}</p>
                        <p className="text-green-700 text-sm">{t('admin_products.import_count', { n: importResult.imported })}</p>
                        {importResult.errors > 0 && (
                          <p className="text-orange-600 text-sm mt-1">{t('admin_products.import_errors', { n: importResult.errors })}</p>
                        )}
                      </div>
                      {importResult.errorDetails?.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                          <p className="text-red-800 font-semibold text-sm mb-2">Erreurs:</p>
                          <ul className="text-red-700 text-xs space-y-1 max-h-32 overflow-y-auto">
                            {importResult.errorDetails.slice(0, 5).map((err, i) => (
                              <li key={i}>Ligne {err.row}: {err.error}</li>
                            ))}
                            {importResult.errorDetails.length > 5 && (
                              <li className="italic">...et {importResult.errorDetails.length - 5} autres</li>
                            )}
                          </ul>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-red-800 font-semibold">✗ {t('admin_products.import_fail')}</p>
                      <p className="text-red-700 text-sm">{importResult.message || importResult.error || 'Une erreur est survenue'}</p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            <div className="p-4 border-t flex justify-end">
              <button onClick={() => { setShowImportModal(false); setImportResult(null) }} className="px-4 py-2 bg-sky-700 text-white rounded-lg hover:bg-sky-800">
                {t('admin_products.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminProducts

