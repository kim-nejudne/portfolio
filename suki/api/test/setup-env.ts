/**
 * Environment for the e2e suite, set before Nest reads it.
 *
 * NODE_ENV=test makes ConfigModule ignore `.env` entirely. Without that, a
 * developer's local `.env` would win over these values and the suite would
 * seed one database while asserting against another — which is exactly how
 * FORME's suite went green against the wrong data, and it was only caught
 * because an unrelated expectation happened to disagree.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgres://suki:suki@127.0.0.1:5435/suki_test';
process.env.DEVICE_KEY ??= 'e2e-device-key-that-is-long-enough-to-pass-validation';
process.env.WEB_ORIGIN ??= 'http://localhost:3000';
