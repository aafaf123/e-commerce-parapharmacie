import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Star, MessageSquare, Send, CheckCircle } from 'lucide-react'
import { reviewSchema } from '../lib/validationSchemas'

const ProductReviewForm = ({ productId, onReviewSubmitted }) => {
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, setValue, watch } = useForm({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      rating: 0,
      comment: ''
    }
  })

  const [success, setSuccess] = useState(false)
  const [apiError, setApiError] = useState('')
  const rating = watch('rating')

  const onSubmit = async (data) => {
    try {
      setApiError('')
      
      const response = await fetch(`/api/products/${productId}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.message || 'Erreur lors de l\'envoi de l\'avis')
      }

      const newReview = await response.json()
      setSuccess(true)
      reset()
      
      if (onReviewSubmitted) {
        onReviewSubmitted(newReview)
      }
      
      setTimeout(() => setSuccess(false), 5000)
    } catch (error) {
      setApiError(error.message || 'Erreur serveur. Veuillez réessayer.')
    }
  }

  const handleStarClick = (starRating) => {
    setValue('rating', starRating, { shouldValidate: true })
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-900 mb-2">Donnez votre avis</h3>
        <p className="text-gray-600">Partagez votre expérience avec ce produit</p>
      </div>

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <CheckCircle size={20} className="text-green-600" />
          <p className="text-sm text-green-700">Merci pour votre avis ! Il sera publié après modération.</p>
        </div>
      )}

      {apiError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{apiError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Note avec étoiles */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Note générale
          </label>
          <div className="flex items-center gap-2 mb-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => handleStarClick(star)}
                className={`p-1 transition-colors ${
                  star <= rating 
                    ? 'text-yellow-400 hover:text-yellow-500' 
                    : 'text-gray-300 hover:text-yellow-300'
                }`}
              >
                <Star 
                  size={32} 
                  fill={star <= rating ? 'currentColor' : 'none'}
                  className="transition-all duration-200"
                />
              </button>
            ))}
            <span className="ml-2 text-sm text-gray-600">
              {rating > 0 ? `${rating}/5` : 'Cliquez pour noter'}
            </span>
          </div>
          {errors.rating && <p className="text-xs text-red-600">{errors.rating.message}</p>}
          
          {/* Texte descriptif de la note */}
          {rating > 0 && (
            <p className="text-sm text-gray-600 mt-2">
              {rating === 1 && "Très décevant"}
              {rating === 2 && "Décevant"}
              {rating === 3 && "Correct"}
              {rating === 4 && "Bien"}
              {rating === 5 && "Excellent"}
            </p>
          )}
        </div>

        {/* Commentaire */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Votre commentaire
          </label>
          <div className="relative">
            <MessageSquare size={18} className="absolute left-3 top-3.5 text-gray-400" />
            <textarea
              {...register('comment')}
              rows={4}
              placeholder="Décrivez votre expérience avec ce produit..."
              className={`w-full pl-10 pr-4 py-3 border-2 rounded-lg focus:outline-none transition-colors resize-none ${
                errors.comment ? 'border-red-500 bg-red-50' : 'border-gray-300 focus:border-sky-700'
              }`}
            />
          </div>
          {errors.comment && <p className="text-xs text-red-600 mt-1">{errors.comment.message}</p>}
          
          {/* Compteur de caractères */}
          <div className="flex justify-between items-center mt-2">
            <p className="text-xs text-gray-500">
              Minimum 10 caractères pour publier votre avis
            </p>
            <p className="text-xs text-gray-400">
              {watch('comment')?.length || 0}/500
            </p>
          </div>
        </div>

        {/* Conseils */}
        <div className="bg-sky-50 border border-sky-200 rounded-lg p-4">
          <h4 className="font-semibold text-sky-900 mb-2">Conseils pour un bon avis</h4>
          <ul className="text-sm text-sky-800 space-y-1">
            <li>• Soyez honnête et constructif</li>
            <li>• Mentionnez les points positifs et négatifs</li>
            <li>• Évitez les informations personnelles</li>
            <li>• Respectez les autres utilisateurs</li>
          </ul>
        </div>

        {/* Bouton de soumission */}
        <button
          type="submit"
          disabled={isSubmitting || rating === 0}
          className="w-full py-3 bg-sky-700 hover:bg-sky-800 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Publication...</span>
            </>
          ) : (
            <>
              <Send size={18} />
              <span>Publier mon avis</span>
            </>
          )}
        </button>
      </form>
    </div>
  )
}

export default ProductReviewForm