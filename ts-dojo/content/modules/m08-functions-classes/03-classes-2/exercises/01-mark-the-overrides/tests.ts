import { LevelLogger, Logger, ShortLogger } from './index';

test('a plain logger logs the message as it is', () => {
  const logger = new Logger();
  expect(logger.log('disk is full')).toBe('disk is full');
  expect(logger.lines).toEqual(['disk is full']);
});

test('a level logger puts its level in front of every line', () => {
  const warn = new LevelLogger('warn');
  expect(warn.log('disk is full')).toBe('[warn] disk is full');
  expect(warn.log('fan is loud')).toBe('[warn] fan is loud');
  expect(warn.lines).toEqual(['[warn] disk is full', '[warn] fan is loud']);
  expect(new LevelLogger('info').log('started')).toBe('[info] started');
});

test('a short logger keeps the first 10 characters of every line', () => {
  const short = new ShortLogger();
  for (let n = 0; n <= 20; n++) {
    const message = 'abcdefghijklmnopqrstuvwxyz'.slice(0, n);
    expect(short.log(message)).toBe(message.slice(0, 10));
  }
  expect(short.lines).toHaveLength(21);
});

test('format itself is replaced, not only log', () => {
  expect(new ShortLogger().format('a long message')).toBe('a long mes');
  expect(new LevelLogger('error').format('x')).toBe('[error] x');
});
