import '@testing-library/jest-dom';

jest.mock('dayjs', () => {
  const actualDayjs = jest.requireActual<typeof import('dayjs')>('dayjs');

  return {
    __esModule: true,
    ...actualDayjs,
    default: actualDayjs,
  };
});

jest.mock('dayjs/plugin/utc', () => ({
  __esModule: true,
  default: jest.requireActual('dayjs/plugin/utc'),
}));

jest.mock('dayjs/plugin/customParseFormat', () => ({
  __esModule: true,
  default: jest.requireActual('dayjs/plugin/customParseFormat'),
}));

jest.mock('dayjs/plugin/advancedFormat', () => ({
  __esModule: true,
  default: jest.requireActual('dayjs/plugin/advancedFormat'),
}));

jest.mock('dayjs/plugin/weekday', () => ({
  __esModule: true,
  default: jest.requireActual('dayjs/plugin/weekday'),
}));

jest.mock('dayjs/plugin/localeData', () => ({
  __esModule: true,
  default: jest.requireActual('dayjs/plugin/localeData'),
}));

jest.mock('dayjs/plugin/weekOfYear', () => ({
  __esModule: true,
  default: jest.requireActual('dayjs/plugin/weekOfYear'),
}));

jest.mock('dayjs/plugin/weekYear', () => ({
  __esModule: true,
  default: jest.requireActual('dayjs/plugin/weekYear'),
}));

jest.mock('dayjs/plugin/timezone', () => ({
  __esModule: true,
  default: jest.requireActual('dayjs/plugin/timezone'),
}));

// Mock Vite environment variables for tests
if (typeof globalThis !== 'undefined') {
  globalThis.__VITE_ENV__ = {
    VITE_API_BASE_URL: '',
    MODE: 'test',
    DEV: 'false',
    PROD: 'false',
  };
}

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  constructor() {}
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  disconnect() {}
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  observe() {}
  takeRecords() {
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  unobserve() {}
} as unknown as typeof IntersectionObserver;

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-object-url');
global.URL.revokeObjectURL = jest.fn();

// Mock import.meta.env for Vite
Object.defineProperty(global, 'import', {
  value: {
    meta: {
      env: {
        VITE_API_BASE_URL: '',
        MODE: 'test',
        DEV: 'false',
        PROD: 'false',
      },
    },
  },
  writable: true,
});
