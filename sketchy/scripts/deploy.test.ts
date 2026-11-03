// The data volume's wiring (F77) across the Dockerfile, the droplet's compose file, the Docker
// smoke test and the deploy workflow. Autopilot sessions can't run Docker, so this pins the
// pieces `npm run smoke:docker` and the deploy rely on.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const dockerfile = read('../Dockerfile');
const compose = read('../deploy/compose.deploy.yaml');
const smoke = read('./docker-smoke.sh');
const workflow = read('../../.github/workflows/deploy-sketchy.yml');

describe('data volume', () => {
  it('the image sets DATA_DIR=/data and creates /data owned by node, outside /app', () => {
    expect(dockerfile).toMatch(/^\s+DATA_DIR=\/data$/m);
    expect(dockerfile).toMatch(/^RUN mkdir \/data && chown node:node \/data$/m);
    // The seed packs stay baked in where a /data volume can't hide them.
    expect(dockerfile).toMatch(/^COPY --chown=node:node data\/packs \.\/data\/packs$/m);
  });

  it('compose sets DATA_DIR and mounts /opt/sketchy/data (./data beside it) at /data', () => {
    expect(compose).toMatch(/^ {6}DATA_DIR: '\/data'$/m);
    expect(compose).toMatch(/^ {4}volumes:\n {6}- \.\/data:\/data$/m);
    expect(compose).not.toMatch(/:\/app\/data/);
  });

  it('the deploy hands /opt/sketchy/data to uid 1000 before compose up', () => {
    const chown = workflow.indexOf(
      'docker run --rm --user 0 --entrypoint chown -v /opt/sketchy/data:/data "sketchy:$TAG" 1000:1000 /data',
    );
    const up = workflow.indexOf('docker compose up -d\n');
    expect(chown).toBeGreaterThan(0);
    expect(up).toBeGreaterThan(chown);
  });

  it('the Docker smoke test mounts a volume and checks a second start keeps an edited store', () => {
    expect(smoke).toContain('-v "$VOLUME:$DATA_DIR"');
    expect(smoke).toContain('--entrypoint chown -v "$VOLUME:/data" "$TAG" 1000:1000 /data');
    expect(smoke).toMatch(/grep -q "\^Seeded \$DATA_DIR\/categories\.json from 9 word packs"/);
    expect(smoke).toMatch(/grep -q "\^Loaded \$DATA_DIR\/categories\.json: "/);
    expect(smoke).toContain('the second start seeded the store again');
    expect(smoke).toContain('[ "$(store_title)" = "Smoke edited" ]');
  });
});
