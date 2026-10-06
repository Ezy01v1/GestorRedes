import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/env.validation';
import { TokenCipher } from './token-cipher';

export const MEDIA_SIGNING_SECRET = Symbol('MEDIA_SIGNING_SECRET');

@Global()
@Module({
  providers: [
    {
      provide: TokenCipher,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) =>
        new TokenCipher(
          new Map([[1, Buffer.from(config.get('APP_ENCRYPTION_KEY', { infer: true }), 'base64')]]),
          1,
        ),
    },
    {
      provide: MEDIA_SIGNING_SECRET,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) =>
        Buffer.from(config.get('MEDIA_SIGNING_SECRET', { infer: true }), 'base64'),
    },
  ],
  exports: [TokenCipher, MEDIA_SIGNING_SECRET],
})
export class CryptoModule {}
