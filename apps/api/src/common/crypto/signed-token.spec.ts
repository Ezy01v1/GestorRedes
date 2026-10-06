import { randomBytes } from 'node:crypto';
import { signToken, verifyToken } from './signed-token';

describe('signToken / verifyToken', () => {
  const secret = randomBytes(32);
  const now = 1_800_000_000;

  it('verifica un token válido', () => {
    const token = signToken({ mediaId: 'm1', exp: now + 3600 }, secret);
    expect(verifyToken(token, secret, now)).toEqual({ mediaId: 'm1', exp: now + 3600 });
  });

  it('devuelve null si el token caducó', () => {
    expect(verifyToken(signToken({ mediaId: 'm1', exp: now }, secret), secret, now)).toBeNull();
  });

  it('devuelve null si se manipula el payload', () => {
    const [, sig] = signToken({ mediaId: 'm1', exp: now + 10 }, secret).split('.');
    const forged = Buffer.from(JSON.stringify({ mediaId: 'm2', exp: now + 10 })).toString('base64url');
    expect(verifyToken(`${forged}.${sig}`, secret, now)).toBeNull();
  });

  it('devuelve null con otro secreto', () => {
    const token = signToken({ mediaId: 'm1', exp: now + 10 }, secret);
    expect(verifyToken(token, randomBytes(32), now)).toBeNull();
  });

  it('devuelve null si exp no es numérico', () => {
    const payload = Buffer.from(JSON.stringify({ mediaId: 'm1', exp: 'nunca' })).toString('base64url');
    const token = signToken({ mediaId: 'm1', exp: now + 10 }, secret);
    expect(verifyToken(`${payload}.${token.split('.')[1]}`, secret, now)).toBeNull();
  });

  it.each(['', 'abc', 'a.b.c', '..', '%%%.%%%'])('devuelve null si está malformado: %p', (t) => {
    expect(verifyToken(t, secret, now)).toBeNull();
  });
});
