// frontend/src/context/AuthContextNew.jsx
import { createContext, useContext } from 'react'

export const AuthContext = createContext()

export const useAuthNew = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuthNew must be used within AuthProvider')
  return context
}
