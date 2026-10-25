import { EmailNotifier, Notifier, SmsNotifier } from './index';

const email = new EmailNotifier('ada@example.com');

// @ts-expect-error
const plain = new Notifier(); // a Notifier can't be created with new

// @ts-expect-error
class Silent extends Notifier {} // a subclass must implement format

// @ts-expect-error
email.sent = []; // sent can't be replaced

export { plain, Silent };

test('an email notifier sends to its address', () => {
  const notifier = new EmailNotifier('kim@example.com');
  expect(notifier.send('Your order has shipped')).toBe(
    'to kim@example.com: Your order has shipped',
  );
  expect(notifier.sent).toEqual(['to kim@example.com: Your order has shipped']);
});

test('an sms keeps a short message whole', () => {
  const notifier = new SmsNotifier('+46700000000');
  expect(notifier.send('Hi')).toBe('sms +46700000000: Hi');
});

test('an sms cuts a long message to 20 characters', () => {
  const notifier = new SmsNotifier('+46700000000');
  expect(notifier.send('Your order has shipped today')).toBe(
    'sms +46700000000: Your order has shipp',
  );
});

test('an sms keeps at most 20 characters of any message', () => {
  const notifier = new SmsNotifier('+46700000009');
  for (let n = 0; n <= 30; n++) {
    expect(notifier.format('x'.repeat(n))).toBe(
      `sms +46700000009: ${'x'.repeat(Math.min(n, 20))}`,
    );
  }
});

test('send records every message in order', () => {
  const notifier = new SmsNotifier('+46700000001');
  notifier.send('one');
  notifier.send('two');
  expect(notifier.sent).toEqual([
    'sms +46700000001: one',
    'sms +46700000001: two',
  ]);
});

test('each notifier keeps its own list', () => {
  const first = new SmsNotifier('+46700000002');
  const second = new SmsNotifier('+46700000003');
  first.send('hello');
  expect(second.sent).toEqual([]);
});

test('an sms notifier is a Notifier', () => {
  expect(new SmsNotifier('+46700000004')).toBeInstanceOf(Notifier);
});
