/**
 * Database Client
 *
 * Drizzle ORM client configuration for PostgreSQL with pgvector support.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Prevent multiple instances in development
declare global {
  // eslint-disable-next-line no-var
  var _db: ReturnType<typeof drizzle<typeof schema>> | undefined;
  // eslint-disable-next-line no-var
  var _sql: ReturnType<typeof postgres> | undefined;
}

function getDbUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    // During build time, return a placeholder URL
    // The actual connection will only be established at runtime
    if (process.env.NODE_ENV === 'production' && typeof window === 'undefined') {
      console.warn('DATABASE_URL not set, using placeholder for build');
      return 'postgres://placeholder:placeholder@localhost:5432/placeholder';
    }
    throw new Error('DATABASE_URL environment variable is not set');
  }
  return url;
}

/**
 * Create PostgreSQL connection
 */
function createConnection() {
  if (global._sql) {
    return global._sql;
  }

  const sql = postgres(getDbUrl(), {
    max: 10, // Maximum connections in the pool
    idle_timeout: 20, // Close idle connections after 20 seconds
    connect_timeout: 10, // Connection timeout
  });

  if (process.env.NODE_ENV !== 'production') {
    global._sql = sql;
  }

  return sql;
}

/**
 * Create Drizzle client with schema
 */
function createDb() {
  if (global._db) {
    return global._db;
  }

  const sql = createConnection();
  const db = drizzle(sql, { schema });

  if (process.env.NODE_ENV !== 'production') {
    global._db = db;
  }

  return db;
}

/**
 * Drizzle database client
 */
export const db = createDb();

/**
 * Raw SQL client for advanced queries (e.g., pgvector operations)
 */
export const sql = createConnection();

/**
 * Type for the database client
 */
export type Database = typeof db;
