#!/bin/sh
set -e

echo "Waiting for database..."
for i in {1..60}; do
  if pg_isready -h postgres -p 5432 -U postgres > /dev/null 2>&1; then
    echo "Database is ready!"
    sleep 2
    break
  fi
  echo "Database is unavailable - sleeping ($i/60)"
  sleep 1
done

# Run migrations
echo "Running migrations..."
npm run db:migrate -w apps/backend -- --skip-generate

# Run seed
echo "Running seed..."
npm run db:seed -w apps/backend

echo "Database initialization complete!"
