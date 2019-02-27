INSERT INTO users (email, password, super_user)
VALUES
  ('test@email.com', 'pbkdf2:sha256:50000$TCI4GzcX$0de171a4f4dac32e3364c7ddc7c14f3e2fa61f2d17574483f7ffbb431b4acb2f', 0),
  ('test-super@email.com', 'pbkdf2:sha256:50000$TCI4GzcX$0de171a4f4dac32e3364c7ddc7c14f3e2fa61f2d17574483f7ffbb431b4acb2f', 1);

INSERT INTO projects (name, source_url, deployment_url, approval_status,
                      description, owner_id)
VALUES
  ('Test Project', 'https://kurtjlewis.com', '', 0, 'Test Description', 1),
  ('Test Project2', 'https://zacharysang.com', '', 0, 'Test Description2', 2);
