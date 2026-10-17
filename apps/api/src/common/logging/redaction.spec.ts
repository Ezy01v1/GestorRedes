import { sanitizeText, sanitizeUrl } from './redaction';

describe('sanitizeUrl', () => {
  it('redacta code y state en una URL relativa', () => {
    expect(sanitizeUrl('/oauth/cb?code=abc&state=xyz&ok=1')).toBe(
      '/oauth/cb?code=%5BREDACTED%5D&state=%5BREDACTED%5D&ok=1',
    );
  });

  it('redacta access_token en una URL absoluta', () => {
    const out = sanitizeUrl('https://graph.facebook.com/v26.0/me?access_token=EAAB123&fields=id');
    expect(out).not.toContain('EAAB123');
    expect(out).toContain('fields=id');
  });

  it('devuelve tal cual lo que no es una URL', () => {
    expect(sanitizeUrl('not a url ::')).toBe('not a url ::');
  });

  it('deja intacta una URL sin query', () => {
    expect(sanitizeUrl('/api/v1/posts')).toBe('/api/v1/posts');
  });
});

describe('sanitizeText', () => {
  it('redacta access_token en texto libre', () => {
    expect(sanitizeText('request to https://graph.facebook.com/me?access_token=EAAB123 failed')).not.toContain(
      'EAAB123',
    );
  });

  it('redacta Bearer tokens', () => {
    expect(sanitizeText('Authorization: Bearer eyJhbGciOi.payload.sig')).not.toContain('eyJhbGciOi');
  });

  it('redacta tokens en JSON serializado', () => {
    expect(sanitizeText('{"access_token":"IGQV123","token_type":"bearer"}')).not.toContain('IGQV123');
  });

  it('redacta client_secret y refresh_token', () => {
    const out = sanitizeText('client_secret=s3cr3t&refresh_token=r3fr3sh');
    expect(out).not.toMatch(/s3cr3t|r3fr3sh/);
  });
});
