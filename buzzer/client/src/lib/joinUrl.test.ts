import { describe, expect, it } from 'vitest';
import { displayUrl, isLoopbackHost, joinUrl } from './joinUrl.js';

describe('join URL', () => {
  it('points at the player page for the room', () => {
    expect(joinUrl('https://buzzr.example', 'ABCD')).toBe('https://buzzr.example/play/ABCD');
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
