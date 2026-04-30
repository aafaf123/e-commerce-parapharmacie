import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertTriangle, Eye, EyeOff, Loader2, X, Shield, Mail } from 'lucide-react'

const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Mot de passe requis'),
  confirmText: z.string().refine(val => val === 'SUPPRIMER', {
    message: 'Vous devez taper "SUPPRIMER" pour confirmer'
  })
})

const verificationCodeSchema = z.object({
  code: z.string().length(6, 'Le code doit contenir 6 chiffres').regex(/^\d{6}$/, 'Le code doit contenir uniquement des chiffres')
})

const DeleteAccountModal = ({ isOpen, onClose, onConfirm, user }) => {
  const [step, setStep] = useState(1) // 1: confirmation, 2: code verification
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { register: registerDelete, handleSubmit: handleSubmitDelete, formState: { errors: errorsDelete }, reset: resetDelete } = useForm({
    resolver: zodResolver(deleteAccountSchema)
  })

  const { register: registerCode, handleSubmit: handleSubmitCode, formState: { errors: errorsCode }, reset: resetCode } = useForm({
    resolver: zodResolver(verificationCodeSchema)
  })

  const handleClose = () => {
    setStep(1)
    setError('')
    setLoading(false)
    resetDelete()
    resetCode()
    onClose()
  }

  const onSubmitPassword = async (data) => {
    setLoading(true)
    setError('')
    
    try {
      const response = await fetch('/api/auth/delete-account-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
          password: data.password
        })
      })

      const result = await response.json()

      if (response.ok) {
        setStep(2)
      } else {
        setError(result.message || 'Erreur lors de la demande')
      }
    } catch (err) {
      setError('Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  const onSubmitCode = async (data) => {
    setLoading(true)
    setError('')
    
    try {
      const response = await fetch('/api/auth/delete-account-confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
          code: data.code
        })
      })

      const result = await response.json()

      if (response.ok) {
        onConfirm()
        handleClose()
      } else {
        setError(result.message || 'Code invalide ou expiré')
      }
    } catch (err) {
      setError('Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                {step === 1 ? 'Supprimer le compte' : 'Code de vérification'}
              </h2>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {step === 1 ? (
            <form onSubmit={handleSubmitDelete(onSubmitPassword)} className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-red-800 mb-2">Attention : Action irréversible</h3>
                    <ul className="text-sm text-red-700 space-y-1">
                      <li>• Toutes vos données seront supprimées définitivement</li>
                      <li>• Vos commandes et historique seront perdus</li>
                      <li>• Cette action ne peut pas être annulée</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirmez votre mot de passe
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    {...registerDelete('password')}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 pr-12 ${
                      errorsDelete.password ? 'border-red-500 bg-red-50' : 'border-gray-300'
                    }`}
                    placeholder="Votre mot de passe actuel"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errorsDelete.password && (
                  <p className="text-sm text-red-600 mt-1">{errorsDelete.password.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tapez "SUPPRIMER" pour confirmer
                </label>
                <input
                  type="text"
                  {...registerDelete('confirmText')}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 ${
                    errorsDelete.confirmText ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="SUPPRIMER"
                />
                {errorsDelete.confirmText && (
                  <p className="text-sm text-red-600 mt-1">{errorsDelete.confirmText.message}</p>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Vérification...
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4" />
                      Envoyer le code
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmitCode(onSubmitCode)} className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-blue-800 mb-1">Code envoyé par email</h3>
                    <p className="text-sm text-blue-700">
                      Un code de vérification à 6 chiffres a été envoyé à <strong>{user.email}</strong>
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Code de vérification
                </label>
                <input
                  type="text"
                  {...registerCode('code')}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-2xl font-mono tracking-widest ${
                    errorsCode.code ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="123456"
                  maxLength={6}
                />
                {errorsCode.code && (
                  <p className="text-sm text-red-600 mt-1">{errorsCode.code.message}</p>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                  Retour
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Suppression...
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4" />
                      Supprimer définitivement
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default DeleteAccountModal