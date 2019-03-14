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
  deployment_url TEXT,
  approval_status INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  hash_id TEXT,
  deployment_url TEXT,
  owner_id INTEGER NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users (id)
);

