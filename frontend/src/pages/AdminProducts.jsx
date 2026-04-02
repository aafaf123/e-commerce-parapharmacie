// frontend/src/pages/AdminProducts.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Edit, Trash2, Search, Save, X, Loader2, Package, ChevronDown } from 'lucide-react'
import adminAxios from '../api/adminAxios'
import axios from '../api/axios'

const AdminProducts = () => {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // Cascading data
  const [categories, setCategories] = useState([])
  const [subcategories, setSubcategories] = useState([])   // filtered by selected category
  const [items, setItems] = useState([])                   // filtered by selected subcategory

  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    price: '',
    oldPrice: '',
    image: '',
    stock: '',
    stockAlert: '10',
    categoryId: '',
    subcategoryId: '',
    subcategoryItemId: '',
    description: '',
    utilisation: '',
    composition: '',
    benefits: '',
    active: true
  })

  useEffect(() => {
    fetchProducts()
    fetchCategories()
  }, [])

  // When categoryId changes → filter subcategories
  useEffect(() => {
    if (formData.categoryId) {
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
    if (formData.subcategoryId) {
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
        active: formData.active
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
      name: '', brand: '', price: '', oldPrice: '', image: '',
      stock: '', stockAlert: '10',
      categoryId: '', subcategoryId: '', subcategoryItemId: '',
      description: '', utilisation: '', composition: '', benefits: '',
      active: true
    })
    setFormError('')
    setSubcategories([])
    setItems([])
  }

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
      active: product.active !== false
    })
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
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestion des Produits</h1>
            <p className="text-gray-600 mt-1">{products.length} produit(s)</p>
          </div>
          <button
            onClick={() => { setEditingProduct(null); resetForm(); setIsModalOpen(true) }}
            className="flex items-center gap-2 bg-sky-700 hover:bg-sky-800 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={20} /> Ajouter un produit
          </button>
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
                      {product.subcategoryId
                        ? categories.find(c => c.id === product.categoryId)?.subcategories?.find(s => s.id === product.subcategoryId)?.title || '—'
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {product.subcategoryItemId
                        ? categories.find(c => c.id === product.categoryId)?.subcategories?.find(s => s.id === product.subcategoryId)?.items?.find(i => i.id === product.subcategoryItemId)?.name || '—'
                        : '—'}
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
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>

            {formError && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{formError}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="p-6 space-y-5">

              {/* Nom */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom du produit *</label>
                <input type="text" name="name" value={formData.name} onChange={handleInputChange} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700" />
              </div>

              {/* Catégorie → Sous-catégorie → Item */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie *</label>
                  <select name="categoryId" value={formData.categoryId} onChange={handleInputChange} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700">
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

              {/* Image */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL de l'image</label>
                <input type="text" name="image" value={formData.image} onChange={handleInputChange}
                  placeholder="https://... ou /images/produit.jpg"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700" />
                {formData.image && (
                  <img src={formData.image} alt="Aperçu" className="mt-2 w-16 h-16 object-cover rounded" />
                )}
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
    </div>
  )
}

export default AdminProducts
