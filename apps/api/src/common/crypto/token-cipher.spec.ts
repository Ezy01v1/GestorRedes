import { randomBytes } from 'node:crypto';
import { CryptoError, TokenCipher } from './token-cipher';

describe('TokenCipher', () => {
  const key = randomBytes(32);
  const cipher = new TokenCipher(new Map([[1, key]]), 1);

  it('cifra y descifra (roundtrip)', () => {
    const { data, keyVersion } = cipher.encrypt('EAAB-token');
    expect(keyVersion).toBe(1);
    expect(cipher.decrypt(data, keyVersion)).toBe('EAAB-token');
  });

  it('usa el layout iv(12) ‖ tag(16) ‖ ciphertext', () => {
    expect(cipher.encrypt('abc').data.length).toBe(12 + 16 + 3);
  });

  it('usa un IV distinto en cada cifrado', () => {
    expect(cipher.encrypt('x').data.equals(cipher.encrypt('x').data)).toBe(false);
  });

  it('detecta manipulación del ciphertext', () => {
    const { data } = cipher.encrypt('x');
    data[data.length - 1]! ^= 0xff;
    expect(() => cipher.decrypt(data, 1)).toThrow(CryptoError);
  });

  it('falla con otra clave', () => {
    const other = new TokenCipher(new Map([[1, randomBytes(32)]]), 1);
    expect(() => other.decrypt(cipher.encrypt('x').data, 1)).toThrow(CryptoError);
  });

  it('falla con una versión de clave desconocida', () => {
    expect(() => cipher.decrypt(cipher.encrypt('x').data, 2)).toThrow(CryptoError);
  });

  it('rechaza claves que no son de 32 bytes', () => {
    expect(() => new TokenCipher(new Map([[1, randomBytes(16)]]), 1)).toThrow();
  });

  it('rechaza una versión actual que no está entre las claves', () => {
    expect(() => new TokenCipher(new Map([[1, randomBytes(32)]]), 2)).toThrow();
  });

  it('rechaza datos demasiado cortos sin revelar nada', () => {
    expect(() => cipher.decrypt(Buffer.alloc(10), 1)).toThrow(CryptoError);
  });

  it('el error no contiene el texto plano', () => {
    const { data } = cipher.encrypt('EAAB-secret');
    data[20]! ^= 0x01;
    try {
      cipher.decrypt(data, 1);
      throw new Error('debería haber fallado');
    } catch (e) {
      expect(String(e)).not.toMatch(/EAAB/);
    }
  });
});
