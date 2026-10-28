import { describe, expect, it } from 'vitest';
import { displayUrl, isLoopbackHost, joinPageOrigin, joinUrl, pairUrl } from './joinUrl.js';

describe('join URL', () => {
  it('points at the player page for the room', () => {
    expect(joinUrl('https://buzzr.example', 'ABCD')).toBe('https://buzzr.example/play/ABCD');
  });

  it('pairing link points at the host page with the token in the hash', () => {
    expect(pairUrl('https://buzzr.example', 'ABCD', 'tok_en-1')).toBe(
      'https://buzzr.example/host/ABCD#t=tok_en-1',
    );
  });

  it('drops the protocol for display', () => {
    expect(displayUrl('http://192.168.1.20:5173/play/ABCD')).toBe('192.168.1.20:5173/play/ABCD');
    expect(displayUrl('https://buzzr.example/play/ABCD')).toBe('buzzr.example/play/ABCD');
  });

  it('flags addresses only this computer can reach', () => {
    expect(isLoopbackHost('localhost')).toBe(true);
    expect(isLoopbackHost('127.0.0.1')).toBe(true);
    expect(isLoopbackHost('[::1]')).toBe(true);
    expect(isLoopbackHost('192.168.1.20')).toBe(false);
    expect(isLoopbackHost('buzzr.example')).toBe(false);
  });
});

describe('join page origin', () => {
  const page = (url: string) => new URL(url);

  it("uses the page's own origin when the server has none", () => {
    expect(joinPageOrigin(null, page('http://192.168.1.20:5173/screen/ABCD'))).toBe(
      'http://192.168.1.20:5173',
    );
    expect(joinPageOrigin(null, page('https://buzzr.example/screen/ABCD'))).toBe(
      'https://buzzr.example',
    );
  });

  it("gives a host-only LAN origin the page's port", () => {
    expect(joinPageOrigin('http://192.168.1.20', page('http://localhost:5173/screen/ABCD'))).toBe(
      'http://192.168.1.20:5173',
    );
    expect(joinPageOrigin('http://192.168.1.20', page('http://localhost:3000/screen/ABCD'))).toBe(
      'http://192.168.1.20:3000',
    );
    expect(joinPageOrigin('http://192.168.1.20', page('http://localhost/screen/ABCD'))).toBe(
      'http://192.168.1.20',
    );
  });

  it('keeps a PUBLIC_URL as it is', () => {
    expect(joinPageOrigin('https://buzzr.example', page('http://localhost:3000/screen/A'))).toBe(
      'https://buzzr.example',
    );
    expect(joinPageOrigin('http://10.0.0.5:8080', page('http://localhost:5173/screen/A'))).toBe(
      'http://10.0.0.5:8080',
    );
  });
});
