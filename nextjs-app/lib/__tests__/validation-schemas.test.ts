import {
  titleSchema,
  usernameSchema,
  passwordSchema,
  urlSchema,
  notesSchema,
  emailSchema,
  phoneSchema,
  creditCardSchema,
  cvvSchema,
  expirationDateSchema,
  tagSchema,
  tagsSchema,
  categorySchema,
  hexStringSchema,
  passwordEntrySchema,
  validate,
} from '../validation-schemas';

describe('Validation Schemas', () => {
  describe('titleSchema', () => {
    it('should accept valid titles', () => {
      const result = validate(titleSchema, 'My GitHub Account');
      expect(result.success).toBe(true);
      expect(result.success && result.data).toBe('My GitHub Account');
    });

    it('should trim whitespace', () => {
      const result = validate(titleSchema, '  My Title  ');
      expect(result.success).toBe(true);
      expect(result.success && result.data).toBe('My Title');
    });

    it('should reject empty titles', () => {
      const result = validate(titleSchema, '');
      expect(result.success).toBe(false);
    });

    it('should reject titles that are too long', () => {
      const longTitle = 'a'.repeat(256);
      const result = validate(titleSchema, longTitle);
      expect(result.success).toBe(false);
    });

    it('should remove control characters', () => {
      const result = validate(titleSchema, 'Title\x00With\x01Control');
      expect(result.success).toBe(true);
      expect(result.success && result.data).toBe('TitleWithControl');
    });
  });

  describe('emailSchema', () => {
    it('should accept valid emails', () => {
      const validEmails = [
        'user@example.com',
        'test.user@example.com',
        'user+tag@example.co.uk',
        'user_123@example.com',
      ];

      validEmails.forEach((email) => {
        const result = validate(emailSchema, email);
        expect(result.success).toBe(true);
      });
    });

    it('should normalize emails to lowercase', () => {
      const result = validate(emailSchema, 'USER@EXAMPLE.COM');
      expect(result.success).toBe(true);
      expect(result.success && result.data).toBe('user@example.com');
    });

    it('should reject invalid emails', () => {
      const invalidEmails = [
        'not-an-email',
        '@example.com',
        'user@',
        'user@@example.com',
        'user@example',
      ];

      invalidEmails.forEach((email) => {
        const result = validate(emailSchema, email);
        expect(result.success).toBe(false);
      });
    });

    it('should accept empty string as optional', () => {
      const result = validate(emailSchema, '');
      expect(result.success).toBe(true);
    });
  });

  describe('phoneSchema', () => {
    it('should accept valid phone numbers', () => {
      const validPhones = [
        '+1234567890',
        '1234567890',
        '+44 20 1234 5678',
        '(123) 456-7890',
      ];

      validPhones.forEach((phone) => {
        const result = validate(phoneSchema, phone);
        expect(result.success).toBe(true);
      });
    });

    it('should normalize phone numbers (digits and + only)', () => {
      const result = validate(phoneSchema, '(123) 456-7890');
      expect(result.success).toBe(true);
      expect(result.success && result.data).toBe('1234567890');
    });

    it('should accept phone with country code', () => {
      const result = validate(phoneSchema, '+1 (234) 567-8900');
      expect(result.success).toBe(true);
      expect(result.success && result.data).toBe('+12345678900');
    });

    it('should reject phone numbers that are too short', () => {
      const result = validate(phoneSchema, '123456');
      expect(result.success).toBe(false);
    });

    it('should accept empty string as optional', () => {
      const result = validate(phoneSchema, '');
      expect(result.success).toBe(true);
    });
  });

  describe('creditCardSchema', () => {
    it('should accept valid credit card numbers', () => {
      const validCards = [
        '4111111111111111', // Visa test card
        '5500000000000004', // Mastercard test card
        '340000000000009', // Amex test card
      ];

      validCards.forEach((card) => {
        const result = validate(creditCardSchema, card);
        expect(result.success).toBe(true);
      });
    });

    it('should normalize card numbers (remove spaces/hyphens)', () => {
      const result = validate(creditCardSchema, '4111 1111 1111 1111');
      expect(result.success).toBe(true);
      expect(result.success && result.data).toBe('4111111111111111');
    });

    it('should reject invalid card numbers (Luhn check)', () => {
      const result = validate(creditCardSchema, '4111111111111112');
      expect(result.success).toBe(false);
      expect(!result.success && result.error).toContain('Luhn');
    });

    it('should reject card numbers with non-digits', () => {
      const result = validate(creditCardSchema, '4111-ABCD-1111-1111');
      expect(result.success).toBe(false);
    });

    it('should reject card numbers that are too short', () => {
      const result = validate(creditCardSchema, '411111111111');
      expect(result.success).toBe(false);
    });

    it('should reject card numbers that are too long', () => {
      const result = validate(creditCardSchema, '41111111111111111111');
      expect(result.success).toBe(false);
    });
  });

  describe('cvvSchema', () => {
    it('should accept 3-digit CVV', () => {
      const result = validate(cvvSchema, '123');
      expect(result.success).toBe(true);
    });

    it('should accept 4-digit CVV (Amex)', () => {
      const result = validate(cvvSchema, '1234');
      expect(result.success).toBe(true);
    });

    it('should reject CVV with non-digits', () => {
      const result = validate(cvvSchema, '12a');
      expect(result.success).toBe(false);
    });

    it('should reject CVV with wrong length', () => {
      const result1 = validate(cvvSchema, '12');
      expect(result1.success).toBe(false);

      const result2 = validate(cvvSchema, '12345');
      expect(result2.success).toBe(false);
    });
  });

  describe('expirationDateSchema', () => {
    it('should accept MM/YY format', () => {
      const result = validate(expirationDateSchema, '12/25');
      expect(result.success).toBe(true);
    });

    it('should accept MM/YYYY format', () => {
      const result = validate(expirationDateSchema, '12/2025');
      expect(result.success).toBe(true);
    });

    it('should reject invalid formats', () => {
      const invalidDates = ['12/5', '1/25', '13/25', '00/25', 'invalid'];

      invalidDates.forEach((date) => {
        const result = validate(expirationDateSchema, date);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('tagSchema', () => {
    it('should accept valid tags', () => {
      const validTags = ['work', 'personal', 'finance_2023', 'high-priority'];

      validTags.forEach((tag) => {
        const result = validate(tagSchema, tag);
        expect(result.success).toBe(true);
      });
    });

    it('should convert tags to lowercase', () => {
      const result = validate(tagSchema, 'MyTag');
      expect(result.success).toBe(true);
      expect(result.success && result.data).toBe('mytag');
    });

    it('should reject tags with special characters', () => {
      const invalidTags = ['tag@work', 'tag with spaces', 'tag!', 'tag#1'];

      invalidTags.forEach((tag) => {
        const result = validate(tagSchema, tag);
        expect(result.success).toBe(false);
      });
    });

    it('should reject tags that are too long', () => {
      const longTag = 'a'.repeat(51);
      const result = validate(tagSchema, longTag);
      expect(result.success).toBe(false);
    });
  });

  describe('tagsSchema', () => {
    it('should sanitize array of tags', () => {
      const result = validate(tagsSchema, ['work', 'personal', 'finance']);
      expect(result.success).toBe(true);
      expect(result.success && result.data).toEqual(['work', 'personal', 'finance']);
    });

    it('should deduplicate tags', () => {
      const result = validate(tagsSchema, ['work', 'Work', 'WORK', 'personal']);
      expect(result.success).toBe(true);
      expect(result.success && result.data).toEqual(['work', 'personal']);
    });

    it('should skip invalid tags', () => {
      const result = validate(tagsSchema, ['work', 'invalid tag', 'personal', 'tag@bad']);
      expect(result.success).toBe(true);
      expect(result.success && result.data).toEqual(['work', 'personal']);
    });

    it('should limit to 20 tags', () => {
      const manyTags = Array.from({ length: 30 }, (_, i) => `tag${i}`);
      const result = validate(tagsSchema, manyTags);
      expect(result.success).toBe(true);
      expect(result.success && result.data.length).toBe(20);
    });

    it('should return empty array for invalid input', () => {
      const result = validate(tagsSchema, undefined);
      expect(result.success).toBe(true);
      expect(result.success && result.data).toEqual([]);
    });
  });

  describe('categorySchema', () => {
    it('should accept valid category IDs', () => {
      const result = validate(categorySchema, 5);
      expect(result.success).toBe(true);
      expect(result.success && result.data).toBe(5);
    });

    it('should default to 0 for undefined', () => {
      const result = validate(categorySchema, undefined);
      expect(result.success).toBe(true);
      expect(result.success && result.data).toBe(0);
    });

    it('should reject negative numbers', () => {
      const result = validate(categorySchema, -1);
      expect(result.success).toBe(false);
    });

    it('should reject numbers > 999', () => {
      const result = validate(categorySchema, 1000);
      expect(result.success).toBe(false);
    });

    it('should reject non-integers', () => {
      const result = validate(categorySchema, 5.5);
      expect(result.success).toBe(false);
    });
  });

  describe('hexStringSchema', () => {
    it('should accept valid hex strings', () => {
      const schema = hexStringSchema();
      const result = validate(schema, 'deadbeef');
      expect(result.success).toBe(true);
      expect(result.success && result.data).toBe('deadbeef');
    });

    it('should normalize to lowercase', () => {
      const schema = hexStringSchema();
      const result = validate(schema, 'DEADBEEF');
      expect(result.success).toBe(true);
      expect(result.success && result.data).toBe('deadbeef');
    });

    it('should remove non-hex characters', () => {
      const schema = hexStringSchema();
      const result = validate(schema, 'de-ad-be-ef');
      expect(result.success).toBe(true);
      expect(result.success && result.data).toBe('deadbeef');
    });

    it('should validate expected length', () => {
      const schema = hexStringSchema(4); // 4 bytes = 8 hex chars
      const result1 = validate(schema, 'deadbeef');
      expect(result1.success).toBe(true);

      const result2 = validate(schema, 'dead');
      expect(result2.success).toBe(false);
    });
  });

  describe('passwordEntrySchema', () => {
    it('should accept valid password entry', () => {
      const entry = {
        title: 'GitHub Account',
        username: 'user@example.com',
        password: 'secure-password-123',
        url: 'github.com',
        notes: 'My work account',
        email: 'user@example.com',
        phone: '+1234567890',
        category: 0,
        tags: ['work', 'development'],
        type: 0,
      };

      const result = validate(passwordEntrySchema, entry);
      expect(result.success).toBe(true);
    });

    it('should accept minimal entry (title only)', () => {
      // Login type (0) requires username and password fields
      const entry = {
        title: 'Minimal Entry',
        type: 0,
        username: 'user',
        password: 'pass',
        url: 'example.com',
      };

      const result = validate(passwordEntrySchema, entry);
      expect(result.success).toBe(true);
    });

    it('should reject entry without title', () => {
      const entry = {
        username: 'user',
        password: 'pass',
        type: 0,
      };

      const result = validate(passwordEntrySchema, entry);
      expect(result.success).toBe(false);
    });

    it('should normalize nested fields', () => {
      // Login entry requires username, password, and url
      const entry = {
        title: '  My Entry  ',
        username: 'USER@EXAMPLE.COM',
        password: 'testpass',
        url: 'microsoft.com',
        tags: ['Work', 'FINANCE'],
        type: 0,
      };

      const result = validate(passwordEntrySchema, entry);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('My Entry'); // Trimmed
        expect(result.data.username).toBe('USER@EXAMPLE.COM'); // Username preserved as-is
        expect(result.data.url).toBe('https://microsoft.com'); // Normalized
        expect(result.data.tags).toEqual(['work', 'finance']); // Lowercase & deduplicated
      }
    });
  });

  describe('Edge cases and security', () => {
    it('should handle null bytes in strings', () => {
      const result = validate(titleSchema, 'Title\x00WithNull');
      expect(result.success).toBe(true);
      expect(result.success && result.data).toBe('TitleWithNull');
    });

    it('should handle Unicode characters', () => {
      const result = validate(titleSchema, 'Título en Español 中文');
      expect(result.success).toBe(true);
    });

    it('should handle very long inputs', () => {
      const veryLongString = 'a'.repeat(100000);
      const result = validate(titleSchema, veryLongString);
      expect(result.success).toBe(false);
    });

    it('should reject XSS attempts in URLs', () => {
      const xssAttempts = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'vbscript:msgbox(1)',
      ];

      xssAttempts.forEach((url) => {
        const result = validate(urlSchema, url);
        expect(result.success).toBe(false);
      });
    });
  });
});
