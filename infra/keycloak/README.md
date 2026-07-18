# Existing Keycloak configuration

StartFlow does not run or provision Keycloak. Apply `realm.example.json` to the existing Keycloak only after reviewing the host-specific redirect URIs and web origins.

Required realm roles are `analyst`, `approver`, and `admin`. The browser client `portal-ops` uses Authorization Code + PKCE and adds the hardcoded `INTEGRATION_API` audience to access tokens. The backend uses the confidential `INTEGRATION_API` client with `KEYCLOAK_SECRET` for introspection. No demo user or password is committed; create users and role mappings in the existing Keycloak administration flow.

Validate the configured issuer without admin credentials:

```powershell
$env:KEYCLOAK_ISSUER='https://auth.example.com/realms/startflow'
node infra/keycloak/check-keycloak.mjs
```

Production values belong in GitHub Environment secrets/variables and the ignored runtime env file prepared during deployment.
