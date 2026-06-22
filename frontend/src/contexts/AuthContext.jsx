import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)

  const apiFetch = useCallback(async (url, options = {}) => {
    const headers = { ...options.headers }
    const currentToken = localStorage.getItem('token')
    if (currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`
    }
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json'
    }
    const res = await fetch(url, { ...options, headers })
    return res
  }, [])

  const fetchUser = useCallback(async () => {
    const currentToken = localStorage.getItem('token')
    if (!currentToken) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${currentToken}` },
      })
      if (res.ok) {
        const data = await res.json()
        setUser(data.user || data)
        setNeedsSetup(data.needsSetup || false)
      } else {
        localStorage.removeItem('token')
        setToken(null)
        setUser(null)
      }
    } catch {
      localStorage.removeItem('token')
      setToken(null)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const checkSetup = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/status')
      if (res.ok) {
        const data = await res.json()
        if (data.needsSetup) {
          setNeedsSetup(true)
        }
      }
    } catch {
      // Server might be down, ignore
    }
  }, [])

  useEffect(() => {
    if (token) {
      fetchUser()
    } else {
      setLoading(false)
      checkSetup()
    }
  }, [token, fetchUser, checkSetup])

  const changePassword = async (currentPassword, newPassword) => {
    const res = await apiFetch('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || 'Failed to change password')
    }
    // Refresh user so must_change_password / role reflect the new state
    await fetchUser()
    return data
  }

  const login = async (username, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || 'Login failed')
    }
    localStorage.setItem('token', data.token)
    setToken(data.token)
    setUser(data.user || null)
    setNeedsSetup(false)
    if (!data.user) {
      await fetchUser()
    }
    return data
  }

  const logout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }

  const role = user?.role || null
  const hasRole = (...roles) => !!role && roles.includes(role)

  return (
    <AuthContext.Provider
      value={{
        token, user, role, hasRole, login, logout, loading, needsSetup,
        apiFetch, changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export default AuthContext
