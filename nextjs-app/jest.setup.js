// Set up globals FIRST before any imports
const crypto = require('crypto')
const { TextEncoder, TextDecoder } = require('util')

global.crypto = {
  subtle: crypto.webcrypto.subtle,
  getRandomValues: (arr) => crypto.randomBytes(arr.length),
}

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
