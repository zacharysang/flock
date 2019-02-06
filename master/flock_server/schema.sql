-- Delete tables if they exist
DROP TABLE IF EXISTS users;

-- Create User table
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL
);


