# Existing Keycloak configuration

StartFlow does not run or provision Keycloak. Apply `realm.example.json` to the existing Keycloak only after reviewing the host-specific redirect URIs and web origins.

Required realm roles are `analyst`, `approver`, and `admin`. The browser client `startflow-web` uses Authorization Code + PKCE and adds the `startflow-api` audience to access tokens. No demo user or password is committed; create users and role mappings in the existing Keycloak administration flow.

Validate the configured issuer without admin credentials:

```powershell
$env:KEYCLOAK_ISSUER='https://auth.example.com/realms/startflow'
$env:KEYCLOAK_AUDIENCE='startflow-api'
node infra/keycloak/check-keycloak.mjs
```

Production values belong in GitHub Environment secrets/variables and the ignored runtime env file prepared during deployment.
