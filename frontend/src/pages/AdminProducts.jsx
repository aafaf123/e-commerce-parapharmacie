// frontend/src/pages/AdminProducts.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus,ArrowLeft, Edit, Trash2, Search, Save, X, Loader2, Package, ChevronDown, ChevronUp, Image, FileText, Tag } from 'lucide-react'
import adminAxios from '../api/adminAxios'
import axios from '../api/axios'
import ImageUpload from '../components/ImageUpload'
import BarcodeScanner from '../components/BarcodeScanner'
import { Scan, Keyboard } from 'lucide-react'

const AdminProducts = () => {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [manualBarcode, setManualBarcode] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [isCategorySuggested, setIsCategorySuggested] = useState(false)

  // Cascading data
  const [categories, setCategories] = useState([])
  const [subcategories, setSubcategories] = useState([])   // filtered by selected category
  const [items, setItems] = useState([])                   // filtered by selected subcategory

  // Variants management
  const [variants, setVariants] = useState([])
  const [showVariants, setShowVariants] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    price: '',
    oldPrice: '',
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
    active: true,
    barcode: ''
  })

  useEffect(() => {
    fetchProducts()
    fetchCategories()
  }, [])

  // USB Hardware Scanner Support (Listener for rapid key strokes)
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e) => {
      // Only listen if modal is open and we're not focused on an input (or specifically on the manual scan input)
      if (!isModalOpen) return;

      const currentTime = Date.now();
      
      // Hardware scanners typically send keys very quickly (< 50ms)
      if (currentTime - lastKeyTime > 100) {
        buffer = ''; // Reset buffer if slow typing
      }

      if (e.key === 'Enter') {
        if (buffer.length > 5) {
          handleBarcodeLookup(buffer);
          buffer = '';
          e.preventDefault();
        }
      } else if (/^\d$/.test(e.key)) {
        buffer += e.key;
      }
      
      lastKeyTime = currentTime;
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  // When categoryId changes → filter subcategories
  useEffect(() => {
    if (formData.categoryId && categories.length > 0) {
      const cat = categories.find(c => c.id === formData.categoryId)
      setSubcategories(cat?.subcategories || [])
    } else {
      setSubcategories([])
    }
    // Reset downstream
    setFormData(prev => ({ ...prev, subcategoryId: '', subcategoryItemId: '' }))
    setItems([])
  }, [formData.categoryId, categories])

  // When subcategoryId changes → filter items
  useEffect(() => {
    if (formData.subcategoryId && subcategories.length > 0) {
      const sub = subcategories.find(s => s.id === formData.subcategoryId)
      setItems(sub?.items || [])
    } else {
      setItems([])
    }
    setFormData(prev => ({ ...prev, subcategoryItemId: '' }))
  }, [formData.subcategoryId, subcategories])

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/products?limit=200')
      setProducts(response.data.products || response.data || [])
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

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
    setFormError('')
  }

  const validateForm = () => {
    if (!formData.name.trim()) { setFormError('Le nom du produit est requis'); return false }
    if (!formData.price)       { setFormError('Le prix est requis'); return false }
    if (!formData.categoryId)  { setFormError('La catégorie est requise'); return false }
    if (formData.stock === '')  { setFormError('Le stock est requis'); return false }
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) return
    setSaving(true)
    try {
      const productData = {
        name: formData.name.trim(),
        brand: formData.brand || null,
        price: parseFloat(formData.price),
        oldPrice: formData.oldPrice ? parseFloat(formData.oldPrice) : null,
        image: formData.image || null,
        stock: parseInt(formData.stock) || 0,
        stockAlert: parseInt(formData.stockAlert) || 10,
        categoryId: formData.categoryId,
        subcategoryId: formData.subcategoryId || null,
        subcategoryItemId: formData.subcategoryItemId || null,
        description: formData.description || null,
        usage: formData.utilisation || null,
        composition: formData.composition || null,
        benefits: formData.benefits
          ? formData.benefits.split(',').map(b => b.trim()).filter(Boolean)
          : [],
        active: formData.active,
        barcode: formData.barcode || null,
        variants: variants.map(v => ({
          type: v.type,
          value: v.value,
          priceAdjustment: v.priceAdjustment,
          stock: v.stock,
          sku: v.sku,
          image: v.image,
          description: v.description
        }))
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
      setFormError(error.response?.data?.message || 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '', brand: '', price: '', oldPrice: '', image: '', imagePublicId: '',
      stock: '', stockAlert: '10',
      categoryId: '', subcategoryId: '', subcategoryItemId: '',
      description: '', utilisation: '', composition: '', benefits: '',
      active: true
    })
    setFormError('')
    setSubcategories([])
    setItems([])
    setVariants([])
    setShowVariants(false)
    setManualBarcode('')
    setIsCategorySuggested(false)
  }

  const handleImageUpload = (url, publicId) => {
    setFormData(prev => ({
      ...prev,
      image: url,
      imagePublicId: publicId
    }))
  }

  const handleBarcodeLookup = async (barcode) => {
    if (!barcode) return;
    setIsScanning(true);
    setFormError('');
    try {
      const { data } = await axios.post('/products/scan-barcode', { barcode });
      
      // Pre-fill form with retrieved data
      setFormData(prev => ({
        ...prev,
        name: data.name || prev.name,
        brand: data.brand || prev.brand,
        description: data.description || prev.description,
        composition: data.composition || prev.composition,
        utilisation: data.usage || prev.utilisation,
        image: data.image || prev.image,
        barcode: data.barcode || barcode,
        stock: data.stock?.toString() || prev.stock || '1',
        categoryId: data.categoryId || prev.categoryId,
      }));

      if (data.isSuggested) {
        setIsCategorySuggested(true);
      }

      // If we got a brand name, but don't have a brandId yet, we just keep the name
      // If we got categories, we leave them for manual selection as per user request

      setIsScannerOpen(false);
      setManualBarcode('');
    } catch (error) {
      console.error('Scan error:', error);
      setFormError(error.response?.data?.message || 'Erreur lors de la récupération des données du produit');
    } finally {
      setIsScanning(false);
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product)

    // Pre-populate cascading selects
    const cat = categories.find(c => c.id === product.categoryId)
    const subs = cat?.subcategories || []
    const sub = subs.find(s => s.id === product.subcategoryId)
    setSubcategories(subs)
    setItems(sub?.items || [])

    setFormData({
      name: product.name || '',
      brand: product.brand || '',
      price: product.price?.toString() || '',
      oldPrice: product.oldPrice?.toString() || '',
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
      active: product.active !== false,
      barcode: product.barcode || ''
    })

    // Load variants
    const loadedVariants = product.productVariants || []
    setVariants(loadedVariants.map(v => ({
      id: v.id,
      type: v.type,
      value: v.value,
      priceAdjustment: v.priceAdjustment,
      stock: v.stock,
      sku: v.sku || '',
      image: v.image || '',
      description: v.description || ''
    })))

    setIsModalOpen(true)
  }

  const handleDelete = async (productId) => {
    if (!window.confirm('Supprimer ce produit ?')) return
    try {
      await axios.delete(`/products/${productId}`)
      fetchProducts()
    } catch (error) {
      alert('Erreur lors de la suppression')
    }
  }

  // Helper function to get subcategory name
  const getSubcategoryName = (product) => {
    if (!product.subcategoryId) return null;
    const category = categories.find(c => c.id === product.categoryId);
    if (!category) return null;
    const subcategory = category.subcategories?.find(s => s.id === product.subcategoryId);
    return subcategory?.title || null;
  };

  // Helper function to get item name
  const getItemName = (product) => {
    if (!product.subcategoryItemId) return null;
    const category = categories.find(c => c.id === product.categoryId);
    if (!category) return null;
    const subcategory = category.subcategories?.find(s => s.id === product.subcategoryId);
    if (!subcategory) return null;
    const item = subcategory.items?.find(i => i.id === product.subcategoryItemId);
    return item?.name || null;
  };

  const filteredProducts = products.filter(p =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.brand?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-700 mx-auto" />
          <p className="mt-4 text-gray-600">Chargement des produits...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all -m-1"
              title="Retour Dashboard"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Gestion des Produits</h1>
              <p className="text-gray-600 mt-1">{products.length} produit(s)</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setEditingProduct(null); resetForm(); setIsModalOpen(true); setIsScannerOpen(true); }}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
            >
              <Scan size={20} /> Scan Intelligent
            </button>
            <button
              onClick={() => { setEditingProduct(null); resetForm(); setIsModalOpen(true) }}
              className="flex items-center gap-2 bg-sky-700 hover:bg-sky-800 text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
            >
              <Plus size={20} /> Ajouter manuellement
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Rechercher par nom ou marque..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
            />
          </div>
          <span className="text-sm text-gray-500">{filteredProducts.length} résultat(s)</span>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Image', 'Nom', 'Marque', 'Prix', 'Stock', 'Catégorie', 'Sous-catégorie', 'Item', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredProducts.map(product => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {product.image
                        ? <img src={product.image} alt={product.name} className="w-10 h-10 object-cover rounded" onError={e => { e.target.src = '/images/placeholder.jpg' }} />
                        : <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center"><Package size={16} className="text-gray-400" /></div>
                      }
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{product.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{product.brand || '—'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="font-medium">{product.price} DH</span>
                      {product.oldPrice && <div className="text-xs text-gray-400 line-through">{product.oldPrice} DH</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                        product.stock > 10 ? 'bg-green-100 text-green-800'
                        : product.stock > 0 ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                      }`}>{product.stock}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{product.category?.name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {getSubcategoryName(product) || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {getItemName(product) || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm space-x-2">
                      <button onClick={() => handleEdit(product)} className="text-sky-600 hover:text-sky-900"><Edit size={16} /></button>
                      <button onClick={() => handleDelete(product.id)} className="text-red-600 hover:text-red-900"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingProduct ? 'Modifier le produit' : 'Ajouter un produit'}
              </h2>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="flex items-center gap-1.5 text-xs font-medium bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full hover:bg-emerald-200 transition-colors"
                >
                  <Scan size={14} /> Scan Caméra
                </button>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
              </div>
            </div>

            {/* Manual Scan Input Block */}
            <div className="bg-gray-50 px-6 py-3 border-b flex items-center justify-between gap-4">
              <div className="flex-1 flex items-center gap-2">
                <div className="relative flex-1">
                  <Keyboard size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Scan USB ou saisie manuelle code-barres..."
                    value={manualBarcode}
                    onChange={(e) => setManualBarcode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleBarcodeLookup(manualBarcode))}
                    className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleBarcodeLookup(manualBarcode)}
                  disabled={isScanning || !manualBarcode}
                  className="bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {isScanning ? <Loader2 size={16} className="animate-spin" /> : 'Saisir'}
                </button>
              </div>
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
                    <span className="text-sm font-medium text-blue-800">Code-barres : {formData.barcode}</span>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setFormData(prev => ({ ...prev, barcode: '' }))}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Effacer
                  </button>
                </div>
              )}

              {/* Nom */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom du produit *</label>
                <input type="text" name="name" value={formData.name} onChange={handleInputChange} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700" />
              </div>

              {/* Catégorie → Sous-catégorie → Item */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                    Catégorie *
                    {isCategorySuggested && (
                      <span className="flex items-center gap-1 text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full border border-yellow-200 animate-pulse">
                        <span className="w-1 h-1 bg-yellow-400 rounded-full"></span>
                        Suggéré
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
                    <option value="">-- Catégorie --</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sous-catégorie</label>
                  <select name="subcategoryId" value={formData.subcategoryId} onChange={handleInputChange}
                    disabled={!formData.categoryId || subcategories.length === 0}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700 disabled:bg-gray-100 disabled:text-gray-400">
                    <option value="">-- Sous-catégorie --</option>
                    {subcategories.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                  </select>
                  {formData.categoryId && subcategories.length === 0 && (
                    <p className="text-xs text-gray-400 mt-1">Aucune sous-catégorie</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Item</label>
                  <select name="subcategoryItemId" value={formData.subcategoryItemId} onChange={handleInputChange}
                    disabled={!formData.subcategoryId || items.length === 0}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700 disabled:bg-gray-100 disabled:text-gray-400">
                    <option value="">-- Item --</option>
                    {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                  {formData.subcategoryId && items.length === 0 && (
                    <p className="text-xs text-gray-400 mt-1">Aucun item</p>
                  )}
                </div>
              </div>

              {/* Marque + Prix */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Marque</label>
                  <input type="text" name="brand" value={formData.brand} onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prix (DH) *</label>
                  <input type="number" name="price" value={formData.price} onChange={handleInputChange} step="0.01" required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ancien prix (DH)</label>
                  <input type="number" name="oldPrice" value={formData.oldPrice} onChange={handleInputChange} step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock *</label>
                  <input type="number" name="stock" value={formData.stock} onChange={handleInputChange} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Seuil alerte stock</label>
                  <input type="number" name="stockAlert" value={formData.stockAlert} onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700" />
                </div>
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Image du produit</label>
                <ImageUpload
                  type="product"
                  currentImage={formData.image}
                  onUploadSuccess={handleImageUpload}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea name="description" value={formData.description} onChange={handleInputChange} rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700" />
              </div>

              {/* Actif */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="active" checked={formData.active} onChange={handleInputChange}
                  className="w-4 h-4 text-sky-600 rounded" />
                <span className="text-sm text-gray-700">Produit actif (visible sur le site)</span>
              </label>

              {/* Variantes */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Tag size={18} className="text-sky-700" />
                    <span className="text-sm font-semibold text-gray-900">Variantes du produit</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowVariants(!showVariants)}
                    className="text-sky-600 hover:text-sky-800 text-sm flex items-center gap-1"
                  >
                    {showVariants ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    {showVariants ? 'Masquer' : 'Gérer'}
                  </button>
                </div>

                {showVariants && (
                  <div className="space-y-4">
                    {/* Add variant button */}
                    <button
                      type="button"
                      onClick={() => setVariants([...variants, { id: Date.now().toString(), type: 'taille', value: '', priceAdjustment: 0, stock: 0, sku: '', image: '', description: '' }])}
                      className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-sky-500 hover:text-sky-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus size={16} /> Ajouter une variante
                    </button>

                    {/* Variants list */}
                    {variants.length > 0 && (
                      <div className="space-y-3">
                        {variants.map((variant, index) => (
                          <div key={variant.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-sm font-semibold text-gray-700">Variante #{index + 1}</span>
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
                                <label className="block text-xs text-gray-500 mb-1">Type</label>
                                <select
                                  value={variant.type}
                                  onChange={(e) => {
                                    const newVariants = [...variants]
                                    newVariants[index].type = e.target.value
                                    setVariants(newVariants)
                                  }}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                >
                                  <option value="taille">Taille</option>
                                  <option value="couleur">Couleur</option>
                                  <option value="poids">Poids</option>
                                  <option value="volume">Volume</option>
                                  <option value="parfum">Parfum</option>
                                  <option value="autre">Autre</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Valeur</label>
                                <input
                                  type="text"
                                  value={variant.value}
                                  onChange={(e) => {
                                    const newVariants = [...variants]
                                    newVariants[index].value = e.target.value
                                    setVariants(newVariants)
                                  }}
                                  placeholder="Ex: S, M, L, XL"
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Ajustement prix (DH)</label>
                                <input
                                  type="number"
                                  value={variant.priceAdjustment}
                                  onChange={(e) => {
                                    const newVariants = [...variants]
                                    newVariants[index].priceAdjustment = parseFloat(e.target.value) || 0
                                    setVariants(newVariants)
                                  }}
                                  step="0.01"
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                />
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
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">SKU</label>
                                <input
                                  type="text"
                                  value={variant.sku}
                                  onChange={(e) => {
                                    const newVariants = [...variants]
                                    newVariants[index].sku = e.target.value
                                    setVariants(newVariants)
                                  }}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Image URL</label>
                                <input
                                  type="text"
                                  value={variant.image}
                                  onChange={(e) => {
                                    const newVariants = [...variants]
                                    newVariants[index].image = e.target.value
                                    setVariants(newVariants)
                                  }}
                                  placeholder="https://..."
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                />
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-xs text-gray-500 mb-1">Description</label>
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
                <button type="button" onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                  Annuler
                </button>
                <button type="submit" disabled={saving}
                  className="px-5 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg flex items-center gap-2 disabled:opacity-50">
                  {saving
                    ? <><Loader2 size={16} className="animate-spin" />{editingProduct ? 'Modification...' : 'Enregistrement...'}</>
                    : <><Save size={16} />{editingProduct ? 'Modifier' : 'Enregistrer'}</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Scanner Modal */}
      {isScannerOpen && (
        <BarcodeScanner
          onScanSuccess={(code) => handleBarcodeLookup(code)}
          onScanError={(err) => console.log(err)}
          onClose={() => setIsScannerOpen(false)}
        />
      )}
    </div>
  )
}

export default AdminProducts
