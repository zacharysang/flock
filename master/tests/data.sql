INSERT INTO user (email, password)
VALUES
  ('test@email.com', 'password-not-hash'),
  ('test2@email.com', 'password-not-hash');

INSERT INTO projects (name, source_url, deployment_url, approval_status,
                      description, owner_id)
VALUES
  ('Test Project', 'https://kurtjlewis.com', '', 0, 'Test Description', 1),
  ('Test Project2', 'https://zacharysang.com', '', 0, 'Test Description2', 2);
