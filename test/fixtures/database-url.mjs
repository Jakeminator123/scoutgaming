import { randomUUID } from 'node:crypto';

// Inert fixture data for tests with an injected pool/schema reader. This helper
// never reads environment credentials, connects, logs or writes the URL.
export function fixtureDatabaseUrl(base = 'postgresql://fixture.neon.tech/fixture?sslmode=require', username = 'fixture') {
  const url = new URL(base);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.username || url.password) {
    throw Error('fixture_database_url_requires_credential_free_postgres_base');
  }
  url.username = username;
  url.password = randomUUID();
  return url.href;
}
