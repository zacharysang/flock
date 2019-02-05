-- Delete tables if they exist
DROP TABLE IF EXISTS user;

-- Create User table
CREATE TABLE user (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL
);


