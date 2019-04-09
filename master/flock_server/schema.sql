-- Delete tables if they exist
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS projects;

-- Create User table
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  super_user BOOLEAN DEFAULT false
);

-- Create project table
CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  deployment_ip TEXT,
  deployment_url TEXT,
  deployment_subdomain TEXT,
  approval_status INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  secret_key TEXT,
  hash_id TEXT,
  min_workers INTEGER,
  worker_count INTEGER,
  session_secret TEXT,
  health_status TEXT,
  health_message TEXT,
  owner_id INTEGER NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users (id)
);

