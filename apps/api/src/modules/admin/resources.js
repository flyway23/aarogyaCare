export const resources = {
  users: {
    model: 'user',
    title: 'Users',
    columns: ['email', 'name', 'phone', 'role', 'isActive', 'deletedAt'],
    search: ['email', 'name', 'phone'],
    softDelete: true,
    fields: {
      email: { type: 'email', required: true },
      name: { type: 'text', required: true },
      phone: { type: 'text' },
      role: {
        type: 'select',
        options: ['PATIENT', 'DOCTOR', 'OPERATOR', 'ADMIN'],
        required: true,
      },
      isActive: { type: 'boolean', defaultValue: true },
      password: { type: 'password', createRequired: true },
    },
  },
  specialties: {
    model: 'specialty',
    title: 'Specialties',
    columns: ['name', 'createdAt'],
    search: ['name'],
    fields: { name: { type: 'text', required: true } },
  },
  doctors: {
    model: 'doctorProfile',
    title: 'Doctor profiles',
    columns: ['userId', 'specialtyId', 'feeInr', 'avgConsultMinutes', 'status'],
    search: ['bio'],
    fields: {
      userId: { type: 'text', required: true },
      specialtyId: { type: 'text', required: true },
      feeInr: { type: 'number', required: true },
      avgConsultMinutes: { type: 'number', required: true },
      bio: { type: 'text' },
      status: {
        type: 'select',
        options: ['AVAILABLE', 'BUSY', 'AWAY'],
        required: true,
      },
    },
  },
  wards: {
    model: 'ward',
    title: 'Wards',
    columns: ['name', 'type', 'createdAt'],
    search: ['name'],
    fields: {
      name: { type: 'text', required: true },
      type: {
        type: 'select',
        options: ['GENERAL', 'PRIVATE', 'SEMI_PRIVATE', 'ICU', 'EMERGENCY'],
        required: true,
      },
    },
  },
  beds: {
    model: 'bed',
    title: 'Beds',
    columns: ['wardId', 'bedNumber', 'status', 'reservedUntil'],
    search: ['bedNumber'],
    fields: {
      wardId: { type: 'text', required: true },
      bedNumber: { type: 'text', required: true },
      status: {
        type: 'select',
        options: [
          'AVAILABLE',
          'OCCUPIED',
          'RESERVED',
          'CLEANING',
          'OUT_OF_SERVICE',
        ],
        required: true,
      },
      reservedUntil: { type: 'datetime' },
    },
  },
  featureFlags: {
    model: 'featureFlag',
    title: 'Feature flags',
    columns: ['key', 'enabled', 'updatedAt'],
    search: ['key'],
    fields: {
      key: { type: 'text', required: true },
      enabled: { type: 'boolean', required: true },
    },
  },
  feedback: {
    model: 'feedback',
    title: 'Feedback',
    columns: ['appointmentId', 'patientId', 'text', 'isHidden', 'createdAt'],
    search: ['text'],
    fields: { isHidden: { type: 'boolean', required: true } },
  },
  payments: {
    model: 'payment',
    title: 'Payments',
    columns: [
      'appointmentId',
      'amountInr',
      'method',
      'status',
      'receiptNo',
      'createdAt',
    ],
    search: ['receiptNo'],
    readOnly: true,
    fields: {},
  },
  auditLogs: {
    model: 'auditLog',
    title: 'Audit log',
    columns: ['userId', 'action', 'entity', 'entityId', 'ip', 'createdAt'],
    search: ['action', 'entity', 'entityId'],
    readOnly: true,
    fields: {},
  },
};

export const resourceMetadata = Object.fromEntries(
  Object.entries(resources).map(([key, value]) => [
    key,
    {
      title: value.title,
      columns: value.columns,
      fields: value.fields,
      readOnly: Boolean(value.readOnly),
      supportsRestore: Boolean(value.softDelete),
    },
  ]),
);
