const issuer = process.env.KEYCLOAK_ISSUER;
const audience = process.env.KEYCLOAK_AUDIENCE;

if (!issuer || !audience) {
  console.error('KEYCLOAK_ISSUER and KEYCLOAK_AUDIENCE are required.');
  process.exit(2);
}

const normalizedIssuer = issuer.replace(/\/$/, '');
const response = await fetch(`${normalizedIssuer}/.well-known/openid-configuration`, {
  signal: AbortSignal.timeout(10_000),
});

if (!response.ok) {
  console.error(`Keycloak discovery failed with HTTP ${response.status}.`);
  process.exit(1);
}

const discovery = await response.json();
if (discovery.issuer !== normalizedIssuer || !discovery.jwks_uri) {
  console.error('Keycloak issuer/JWKS discovery does not match the configured issuer.');
  process.exit(1);
}

console.log(`Keycloak discovery is ready for audience ${audience}.`);
