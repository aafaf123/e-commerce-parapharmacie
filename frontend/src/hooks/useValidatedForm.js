import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'

/**
 * Hook personnalisé qui combine React Hook Form avec Zod et ajoute des fonctionnalités communes
 * @param {Object} schema - Schéma Zod pour la validation
 * @param {Object} options - Options pour useForm
 * @returns {Object} - Objet avec toutes les méthodes de useForm plus des utilitaires
 */
export const useValidatedForm = (schema, options = {}) => {
  const [apiError, setApiError] = useState('')
  const [success, setSuccess] = useState(false)

  const form = useForm({
    resolver: zodResolver(schema),
    ...options
  })

  const { handleSubmit: originalHandleSubmit, formState: { errors, isSubmitting } } = form

  /**
   * Wrapper pour handleSubmit qui gère automatiquement les erreurs API
   * @param {Function} onSubmit - Fonction à exécuter lors de la soumission
   * @param {Object} options - Options pour la gestion des erreurs
   */
  const handleSubmit = (onSubmit, submitOptions = {}) => {
    const {
      showSuccess = false,
      successMessage = 'Opération réussie !',
      successDuration = 3000,
      onSuccess,
      onError
    } = submitOptions

    return originalHandleSubmit(async (data) => {
      try {
        setApiError('')
        setSuccess(false)

        const result = await onSubmit(data)

        if (showSuccess) {
          setSuccess(successMessage)
          setTimeout(() => setSuccess(false), successDuration)
        }

        if (onSuccess) {
          onSuccess(result)
        }

        return result
      } catch (error) {
        const errorMessage = error.message || 'Une erreur est survenue'
        setApiError(errorMessage)
        
        if (onError) {
          onError(error)
        }
        
        throw error
      }
    })
  }

  /**
   * Réinitialise les messages d'erreur et de succès
   */
  const clearMessages = () => {
    setApiError('')
    setSuccess(false)
  }

  /**
   * Définit un message d'erreur API
   */
  const setError = (message) => {
    setApiError(message)
    setSuccess(false)
  }

  /**
   * Définit un message de succès
   */
  const setSuccessMessage = (message, duration = 3000) => {
    setSuccess(message)
    setApiError('')
    if (duration > 0) {
      setTimeout(() => setSuccess(false), duration)
    }
  }

  /**
   * Vérifie si le formulaire a des erreurs (validation ou API)
   */
  const hasErrors = Object.keys(errors).length > 0 || !!apiError

  /**
   * Obtient le premier message d'erreur de validation
   */
  const getFirstError = () => {
    const errorKeys = Object.keys(errors)
    if (errorKeys.length > 0) {
      return errors[errorKeys[0]]?.message
    }
    return null
  }

  /**
   * Composant pour afficher les messages d'erreur API
   */
  const ErrorMessage = ({ className = "mb-6 p-4 bg-red-50 border border-red-200 rounded-lg" }) => {
    if (!apiError) return null
    
    return (
      <div className={className}>
        <p className="text-sm text-red-700">{apiError}</p>
      </div>
    )
  }

  /**
   * Composant pour afficher les messages de succès
   */
  const SuccessMessage = ({ className = "mb-6 p-4 bg-green-50 border border-green-200 rounded-lg" }) => {
    if (!success) return null
    
    return (
      <div className={className}>
        <p className="text-sm text-green-700">{success}</p>
      </div>
    )
  }

  /**
   * Utilitaire pour obtenir les classes CSS d'un champ avec erreur
   */
  const getFieldClasses = (fieldName, baseClasses = "w-full px-3 py-2 border rounded-lg focus:outline-none") => {
    const hasError = !!errors[fieldName]
    const errorClasses = hasError 
      ? "border-red-500 bg-red-50 focus:border-red-500" 
      : "border-gray-300 focus:border-sky-700"
    
    return `${baseClasses} ${errorClasses}`
  }

  /**
   * Composant pour afficher l'erreur d'un champ spécifique
   */
  const FieldError = ({ name, className = "text-xs text-red-600 mt-1" }) => {
    const error = errors[name]
    if (!error) return null
    
    return <p className={className}>{error.message}</p>
  }

  return {
    ...form,
    handleSubmit,
    apiError,
    success,
    isSubmitting,
    hasErrors,
    clearMessages,
    setError,
    setSuccessMessage,
    getFirstError,
    getFieldClasses,
    ErrorMessage,
    SuccessMessage,
    FieldError
  }
}

/**
 * Hook spécialisé pour les formulaires d'authentification
 */
export const useAuthForm = (schema, options = {}) => {
  const form = useValidatedForm(schema, options)
  
  const submitWithAuth = (onSubmit) => {
    return form.handleSubmit(async (data) => {
      const result = await onSubmit(data)
      
      // Gestion automatique du token JWT
      if (result.token) {
        localStorage.setItem('token', result.token)
      }
      
      if (result.user) {
        localStorage.setItem('user', JSON.stringify(result.user))
      }
      
      return result
    })
  }

  return {
    ...form,
    submitWithAuth
  }
}

/**
 * Hook spécialisé pour les formulaires avec upload de fichiers
 */
export const useFileForm = (schema, options = {}) => {
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  
  const form = useValidatedForm(schema, options)
  
  const submitWithFiles = (onSubmit) => {
    return form.handleSubmit(async (data) => {
      setIsUploading(true)
      setUploadProgress(0)
      
      try {
        // Simuler le progrès d'upload
        const progressInterval = setInterval(() => {
          setUploadProgress(prev => Math.min(prev + 10, 90))
        }, 100)
        
        const result = await onSubmit(data)
        
        clearInterval(progressInterval)
        setUploadProgress(100)
        
        setTimeout(() => {
          setUploadProgress(0)
          setIsUploading(false)
        }, 500)
        
        return result
      } catch (error) {
        setIsUploading(false)
        setUploadProgress(0)
        throw error
      }
    })
  }

  return {
    ...form,
    submitWithFiles,
    uploadProgress,
    isUploading
  }
}