export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'AICTE FDR-Sentinel API',
    version: '1.0.0',
    description: `
**Security Deposit / FDR Management Portal for AICTE Regulation Bureau**

This portal provides centralized lifecycle tracking, automated compliance rule verification, 
tri-level trust badges, cryptographic tamper-evident audit trails, and maker-checker release authorization.

*Note: Bank verification and OCR extractions operate via simulated adapters clearly labeled in all responses.*
    `,
    contact: {
      name: 'AICTE Regulation Bureau Tech Support',
      email: 'regulation-support@aicte-india.org',
    },
  },
  servers: [
    {
      url: 'http://localhost:5000',
      description: 'Local Development Server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          username: { type: 'string' },
          full_name: { type: 'string' },
          role: {
            type: 'string',
            enum: ['INSTITUTION_OFFICER', 'SCRUTINY_OFFICER', 'APPROVING_AUTHORITY', 'ADMIN', 'AUDITOR'],
          },
          designation: { type: 'string' },
          institution_id: { type: 'string', nullable: true },
        },
      },
      Fdr: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          institution_id: { type: 'string' },
          fdr_number: { type: 'string' },
          issuing_bank: { type: 'string' },
          branch_name: { type: 'string' },
          amount: { type: 'number' },
          issue_date: { type: 'string', format: 'date' },
          maturity_date: { type: 'string', format: 'date' },
          status: {
            type: 'string',
            enum: ['SUBMITTED', 'UNDER_SCRUTINY', 'VERIFIED', 'ACTIVE', 'EXPIRING', 'MATURED', 'RENEWED', 'RELEASED'],
          },
          trust_level: {
            type: 'string',
            enum: ['DECLARED', 'DOCUMENT_EXTRACTED', 'BANK_CONFIRMED'],
          },
          replaces_fdr_id: { type: 'string', nullable: true },
        },
      },
      AuditEntry: {
        type: 'object',
        properties: {
          sequence: { type: 'integer' },
          id: { type: 'string' },
          actor_id: { type: 'string' },
          actor_name: { type: 'string' },
          actor_role: { type: 'string' },
          action: { type: 'string' },
          entity_type: { type: 'string' },
          entity_id: { type: 'string' },
          payload_canonical: { type: 'string' },
          prev_hash: { type: 'string' },
          hash: { type: 'string' },
          created_at: { type: 'string' },
        },
      },
    },
  },
  paths: {
    '/api/health': {
      get: {
        summary: 'System health check',
        responses: {
          '200': {
            description: 'Portal and database are operational',
          },
        },
      },
    },
    '/api/auth/login': {
      post: {
        summary: 'Authenticate user with username and password',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'password'],
                properties: {
                  username: { type: 'string' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Authentication successful, returns JWT token' },
          '401': { description: 'Invalid credentials' },
          '429': { description: 'Rate limit exceeded' },
        },
      },
    },
    '/api/auth/me': {
      get: {
        summary: 'Get current user profile',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Current authenticated user profile' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/clock': {
      get: {
        summary: 'Get current system clock status',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Current clock date and time-travel offset' },
        },
      },
    },
    '/api/clock/advance': {
      post: {
        summary: 'Advance demo clock by N days (ADMIN only)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['days'],
                properties: {
                  days: { type: 'integer', minimum: 1 },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Clock advanced and scheduled jobs re-evaluated' },
          '403': { description: 'Forbidden' },
        },
      },
    },
    '/api/audit': {
      get: {
        summary: 'Query tamper-evident audit trail entries',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Paginated audit trail list' },
        },
      },
    },
    '/api/audit/verify': {
      get: {
        summary: 'Verify cryptographic SHA-256 hash chain integrity',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Chain integrity verification result (valid/corrupted)' },
        },
      },
    },
  },
};
