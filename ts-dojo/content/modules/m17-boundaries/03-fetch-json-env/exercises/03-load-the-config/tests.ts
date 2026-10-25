import { loadConfig, type Env } from './index';

const api = 'https://api.example.com';

/** The names of the variables `loadConfig` reports, once each and sorted; [] on success. */
function badNames(env: Env): string[] {
  const result = loadConfig(env);
  if (result.ok) return [];
  for (const error of result.errors) {
    expect(/^[A-Z_]+: \S/.test(error)).toBe(true);
  }
  return [...new Set(result.errors.map((error) => error.split(':')[0]))].sort();
}

test('loadConfig reads every setting', () => {
  expect(
    loadConfig({
      API_URL: api,
      PORT: '8080',
      LOG_LEVEL: 'debug',
      DEBUG: 'true',
      HOME: '/home/ada',
    }),
  ).toEqual({
    ok: true,
    config: { apiUrl: api, port: 8080, logLevel: 'debug', debug: true },
  });
});

test('loadConfig fills in the defaults', () => {
  const defaults = { apiUrl: api, port: 3000, logLevel: 'info', debug: false };
  expect(loadConfig({ API_URL: api })).toEqual({ ok: true, config: defaults });
  expect(
    loadConfig({ API_URL: api, PORT: '', LOG_LEVEL: '', DEBUG: '' }),
  ).toEqual({ ok: true, config: defaults });
  expect(loadConfig({ API_URL: api, PORT: undefined, DEBUG: 'false' })).toEqual(
    { ok: true, config: defaults },
  );
});

test('loadConfig reads generated settings', () => {
  const levels = ['debug', 'info', 'warn', 'error'] as const;
  for (let i = 0; i < 12; i++) {
    const port = 1 + ((i * 7919) % 65535);
    const apiUrl = `https://api${i}.example.com/v${i % 3}`;
    const logLevel = levels[i % 4];
    const debug = i % 2 === 0;
    expect(
      loadConfig({
        API_URL: apiUrl,
        PORT: String(port),
        LOG_LEVEL: logLevel,
        DEBUG: String(debug),
        [`OTHER_${i}`]: 'x',
      }),
    ).toEqual({ ok: true, config: { apiUrl, port, logLevel, debug } });
  }
  expect(loadConfig({ API_URL: api, PORT: '1' })).toEqual({
    ok: true,
    config: { apiUrl: api, port: 1, logLevel: 'info', debug: false },
  });
  expect(loadConfig({ API_URL: api, PORT: '65535' })).toEqual({
    ok: true,
    config: { apiUrl: api, port: 65535, logLevel: 'info', debug: false },
  });
});

test('loadConfig requires an https API_URL', () => {
  expect(badNames({})).toEqual(['API_URL']);
  expect(badNames({ API_URL: '' })).toEqual(['API_URL']);
  expect(badNames({ API_URL: 'http://api.example.com' })).toEqual(['API_URL']);
  expect(badNames({ API_URL: 'api.example.com' })).toEqual(['API_URL']);
});

test('loadConfig rejects bad values', () => {
  for (const port of ['0', '65536', '2.5', 'eighty', '-1', '99999']) {
    expect(badNames({ API_URL: api, PORT: port })).toEqual(['PORT']);
  }
  for (const level of ['verbose', 'INFO', 'trace']) {
    expect(badNames({ API_URL: api, LOG_LEVEL: level })).toEqual(['LOG_LEVEL']);
  }
  for (const debug of ['yes', '1', 'TRUE', 'on']) {
    expect(badNames({ API_URL: api, DEBUG: debug })).toEqual(['DEBUG']);
  }
});

test('loadConfig reports every bad variable', () => {
  expect(
    badNames({
      API_URL: 'http://api.example.com',
      PORT: '70000',
      LOG_LEVEL: 'verbose',
      DEBUG: 'yes',
    }),
  ).toEqual(['API_URL', 'DEBUG', 'LOG_LEVEL', 'PORT']);
  expect(badNames({ PORT: 'x', HOME: '/home/ada' })).toEqual([
    'API_URL',
    'PORT',
  ]);
});
