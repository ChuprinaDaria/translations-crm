#!/bin/bash
# Script to apply all migrations from database/migrations directory
# Run this on the server: bash apply_all_migrations.sh

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 Pulling latest changes from git...${NC}"
git pull origin main || echo -e "${YELLOW}⚠️  Warning: Could not pull from git (maybe not in git repo)${NC}"

echo ""
echo -e "${BLUE}📝 Applying all migrations from database/migrations/...${NC}"

# Get database connection details from environment or use defaults
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-crm_translations}"
DB_USER="${DB_USER:-crm_user}"
DB_PASSWORD="${DB_PASSWORD:-}"

# Check if running in Docker
if command -v docker &> /dev/null && docker ps | grep -q postgres; then
    echo -e "${BLUE}🐳 Using Docker PostgreSQL container${NC}"
    DB_COMMAND="docker compose exec -T postgres psql -U ${DB_USER} -d ${DB_NAME}"
else
    echo -e "${BLUE}💻 Using local PostgreSQL${NC}"
    if [ -n "$DB_PASSWORD" ]; then
        export PGPASSWORD="$DB_PASSWORD"
    fi
    DB_COMMAND="psql -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME}"
fi

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
MIGRATIONS_DIR="${SCRIPT_DIR}/database/migrations"

# Check if migrations directory exists
if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo -e "${RED}❌ Error: Migrations directory not found: $MIGRATIONS_DIR${NC}"
    exit 1
fi

# Track applied migrations
APPLIED_COUNT=0
FAILED_COUNT=0
FAILED_MIGRATIONS=()

# Get list of SQL files, sorted by name
MIGRATION_FILES=$(find "$MIGRATIONS_DIR" -name "*.sql" -type f | sort)

if [ -z "$MIGRATION_FILES" ]; then
    echo -e "${YELLOW}⚠️  No migration files found in $MIGRATIONS_DIR${NC}"
    exit 0
fi

echo -e "${BLUE}Found $(echo "$MIGRATION_FILES" | wc -l) migration file(s)${NC}"
echo ""

# Apply each migration
for migration_file in $MIGRATION_FILES; do
    migration_name=$(basename "$migration_file")
    
    echo -e "${BLUE}📝 Applying: ${migration_name}${NC}"
    
    # Try to apply migration
    if $DB_COMMAND < "$migration_file" 2>&1; then
        echo -e "${GREEN}✅ Migration ${migration_name} applied successfully${NC}"
        ((APPLIED_COUNT++))
    else
        exit_code=$?
        # Check if error is just "already exists" (which is OK for IF NOT EXISTS)
        if grep -q "IF NOT EXISTS\|already exists" "$migration_file" 2>/dev/null; then
            echo -e "${YELLOW}⚠️  Migration ${migration_name} - some objects may already exist (this is OK)${NC}"
            ((APPLIED_COUNT++))
        else
            echo -e "${RED}❌ Failed to apply migration: ${migration_name}${NC}"
            ((FAILED_COUNT++))
            FAILED_MIGRATIONS+=("$migration_name")
        fi
    fi
    echo ""
done

# Summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Successfully applied: ${APPLIED_COUNT} migration(s)${NC}"

if [ $FAILED_COUNT -gt 0 ]; then
    echo -e "${RED}❌ Failed: ${FAILED_COUNT} migration(s)${NC}"
    echo -e "${RED}Failed migrations:${NC}"
    for failed in "${FAILED_MIGRATIONS[@]}"; do
        echo -e "${RED}  - ${failed}${NC}"
    done
    echo ""
    exit 1
fi

echo ""
echo -e "${BLUE}🔄 Restarting services...${NC}"

# Restart services if Docker Compose is available
if command -v docker &> /dev/null && [ -f "docker-compose.yml" ] || [ -f "docker-compose.yaml" ]; then
    docker compose restart backend celery_worker celery_beat 2>/dev/null || \
    docker-compose restart backend celery_worker celery_beat 2>/dev/null || \
    echo -e "${YELLOW}⚠️  Could not restart services (Docker Compose not available)${NC}"
else
    echo -e "${YELLOW}⚠️  Docker Compose not found, skipping service restart${NC}"
fi

echo ""
echo -e "${GREEN}🎉 All migrations applied successfully!${NC}"

