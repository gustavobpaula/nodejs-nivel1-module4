import { DatabaseSync } from "node:sqlite";

export function createDb(path = ":memory:", { readOnly = false } = {}) {
  const db = new DatabaseSync(path, { readOnly });

  if (readOnly) return db;

  db.exec(`
	CREATE TABLE IF NOT EXISTS access_log (
	  id TEXT PRIMARY KEY,
	  ip TEXT NOT NULL,
	  username TEXT NOT NULL,
	  first_name TEXT NOT NULL,
	  last_name TEXT NOT NULL,
	  email TEXT NOT NULL,
	  location TEXT NOT NULL,
	  job_area TEXT NOT NULL,
	  company TEXT NOT NULL,
	  job_title TEXT NOT NULL,
	  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
	)
  `);

  return db;
}

// const db = createDb("access_log.db");
