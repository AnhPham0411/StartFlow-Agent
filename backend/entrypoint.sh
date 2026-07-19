#!/bin/sh
set -eu

# Prisma CLI reads DATABASE_URL directly, so derive it only inside the container process.
DATABASE_URL="$(node <<'NODE'
const { buildDatabaseUrl } = require('./backend/dist/config/database-url.js');
process.stdout.write(buildDatabaseUrl(process.env));
NODE
)"
export DATABASE_URL

exec "$@"
