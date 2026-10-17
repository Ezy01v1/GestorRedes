import type { Config } from 'jest';

// Tests contra un PostgreSQL real (Testcontainers): requieren Docker.
const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: 'test/.*\\.int-spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  testEnvironment: 'node',
  testTimeout: 180_000,
  // El cliente generado por Prisma importa con extensión .js; Jest debe resolverlas a los .ts.
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
};

export default config;
