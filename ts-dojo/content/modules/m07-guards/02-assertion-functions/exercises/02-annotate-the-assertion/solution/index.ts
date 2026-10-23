export type Config = { host: string; port: number };

/** Throws a TypeError unless value is a Config: a string host and a whole-number port. */
export const assertConfig: (value: unknown) => asserts value is Config = (
  value,
) => {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('host' in value) ||
    !('port' in value) ||
    typeof value.host !== 'string' ||
    !Number.isInteger(value.port)
  ) {
    throw new TypeError('not a config');
  }
};

/** Parses the text and returns the config, or throws when the data is not one. */
export function readConfig(json: string): Config {
  const data: unknown = JSON.parse(json);
  assertConfig(data);
  return data;
}

/** The address to connect to, such as localhost:8080. */
export function address(json: string): string {
  const config = readConfig(json);
  return `${config.host}:${config.port}`;
}
