// Mock uuid module for Jest tests
let counter = 0;

module.exports = {
  v4: jest.fn(() => {
    counter++;
    const hex = counter.toString(16).padStart(12, '0');
    return `${hex.slice(0, 8)}-${hex.slice(0, 4)}-${hex.slice(
      0,
      4
    )}-${hex.slice(0, 4)}-${hex.slice(0, 12)}`;
  }),
  v1: jest.fn(() => '00000000-0000-1000-8000-000000000000'),
  v3: jest.fn(() => '00000000-0000-3000-8000-000000000000'),
  v5: jest.fn(() => '00000000-0000-5000-8000-000000000000'),
  NIL: '00000000-0000-0000-0000-000000000000',
  parse: jest.fn((uuid) => Buffer.from(uuid.replace(/-/g, ''), 'hex')),
  stringify: jest.fn((buffer) => {
    const hex = buffer.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
      12,
      16
    )}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }),
  validate: jest.fn((uuid) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)
  ),
  version: jest.fn((uuid) => parseInt(uuid.split('-')[2][0], 16)),
};
