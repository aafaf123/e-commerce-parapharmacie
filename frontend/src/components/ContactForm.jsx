import { useValidatedForm } from '../hooks/useValidatedForm'
import { Mail, User, MessageSquare, Send, CheckCircle } from 'lucide-react'
import { contactSchema } from '../lib/validationSchemas'

const ContactForm = () => {
  const {
    register,
    handleSubmit,
    isSubmitting,
    reset,
    ErrorMessage,
    SuccessMessage,
    getFieldClasses,
    FieldError
  } = useValidatedForm(contactSchema)

  const onSubmit = handleSubmit(async (data) => {
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      const result = await response.json()
      throw new Error(result.message || 'Erreur lors de l\'envoi')
    }

    reset()
    return await response.json()
  }, {
    showSuccess: true,
    successMessage: 'Message envoyé avec succès ! Nous vous répondrons rapidement.',
    successDuration: 5000
  })

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-2xl shadow-lg">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Contactez-nous</h2>
        <p className="text-gray-600">Nous sommes là pour vous aider</p>
      </div>

      <SuccessMessage />
      <ErrorMessage />

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nom complet
            </label>
            <div className="relative">
              <User size={18} className="absolute left-3 top-3.5 text-gray-400" />
              <input
                type="text"
                {...register('name')}
                placeholder="Jean Dupont"
                className={getFieldClasses('name', 'w-full pl-10 pr-4 py-3 border-2 rounded-lg focus:outline-none transition-colors')}
              />
            </div>
            <FieldError name="name" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-3.5 text-gray-400" />
              <input
                type="email"
                {...register('email')}
                placeholder="jean@example.com"
                className={getFieldClasses('email', 'w-full pl-10 pr-4 py-3 border-2 rounded-lg focus:outline-none transition-colors')}
              />
            </div>
            <FieldError name="email" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sujet
          </label>
          <input
            type="text"
            {...register('subject')}
            placeholder="Objet de votre message"
            className={getFieldClasses('subject', 'w-full px-4 py-3 border-2 rounded-lg focus:outline-none transition-colors')}
          />
          <FieldError name="subject" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Message
          </label>
          <div className="relative">
            <MessageSquare size={18} className="absolute left-3 top-3.5 text-gray-400" />
            <textarea
              {...register('message')}
              rows={5}
              placeholder="Décrivez votre demande..."
              className={getFieldClasses('message', 'w-full pl-10 pr-4 py-3 border-2 rounded-lg focus:outline-none transition-colors resize-none')}
            />
          </div>
          <FieldError name="message" />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 bg-sky-700 hover:bg-sky-800 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Envoi...</span>
            </>
          ) : (
            <>
              <Send size={18} />
              <span>Envoyer le message</span>
            </>
          )}
        </button>
      </form>
    </div>
  )
}

export default ContactForm