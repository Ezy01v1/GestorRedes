import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** Error de cifrado con mensaje genérico: nunca incluye texto plano ni claves. */
export class CryptoError extends Error {
  constructor(message = 'No se pudo descifrar el valor.') {
    super(message);
    this.name = 'CryptoError';
  }
}

/**
 * Cifra tokens OAuth con AES-256-GCM. Formato: iv(12) ‖ authTag(16) ‖ ciphertext.
 * Admite varias versiones de clave para poder rotar APP_ENCRYPTION_KEY.
 */
export class TokenCipher {
  constructor(
    private readonly keys: ReadonlyMap<number, Buffer>,
    private readonly currentVersion: number,
  ) {
    for (const [version, key] of keys) {
      if (key.length !== KEY_BYTES) {
        throw new Error(`La clave de cifrado v${version} debe medir ${KEY_BYTES} bytes.`);
      }
    }
    if (!keys.has(currentVersion)) {
      throw new Error(`No existe la clave de cifrado v${currentVersion}.`);
    }
  }

  encrypt(plaintext: string): { data: Buffer; keyVersion: number } {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.keys.get(this.currentVersion)!, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return { data: Buffer.concat([iv, cipher.getAuthTag(), ciphertext]), keyVersion: this.currentVersion };
  }

  decrypt(data: Buffer, keyVersion: number): string {
    const key = this.keys.get(keyVersion);
    if (!key || data.length < IV_BYTES + TAG_BYTES) throw new CryptoError();
    try {
      const decipher = createDecipheriv(ALGORITHM, key, data.subarray(0, IV_BYTES));
      decipher.setAuthTag(data.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
      return Buffer.concat([
        decipher.update(data.subarray(IV_BYTES + TAG_BYTES)),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new CryptoError();
    }
  }
}
