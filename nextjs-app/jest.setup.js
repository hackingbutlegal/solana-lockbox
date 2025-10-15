// Set up globals FIRST before any imports
const crypto = require('crypto')
const { TextEncoder, TextDecoder } = require('util')

// Ensure crypto.webcrypto is available (Node.js 15+)
if (!crypto.webcrypto || !crypto.webcrypto.subtle) {
  throw new Error('crypto.webcrypto.subtle not available - requires Node.js 15+')
}

// Set up Web Crypto API for tests
// Use Object.defineProperty to prevent accidental overwriting
Object.defineProperty(global, 'crypto', {
  value: {
    subtle: crypto.webcrypto.subtle,
    getRandomValues: (arr) => {
      const bytes = crypto.randomBytes(arr.length)
      arr.set(bytes)
      return arr
    },
  },
  writable: false,
  configurable: false,
})

global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder
global.fetch = jest.fn()

// Now import testing library
import '@testing-library/jest-dom'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
    }
  },
  usePathname() {
    return ''
  },
}))
