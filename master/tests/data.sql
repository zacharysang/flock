-- All passwords are 'test'
INSERT INTO users (email, password, super_user)
VALUES
  ('test@email.com', 'pbkdf2:sha256:50000$TCI4GzcX$0de171a4f4dac32e3364c7ddc7c14f3e2fa61f2d17574483f7ffbb431b4acb2f', 'false'),
  ('test-super@email.com', 'pbkdf2:sha256:50000$TCI4GzcX$0de171a4f4dac32e3364c7ddc7c14f3e2fa61f2d17574483f7ffbb431b4acb2f', 'true'),
  ('test-2@email.com', 'pbkdf2:sha256:50000$TCI4GzcX$0de171a4f4dac32e3364c7ddc7c14f3e2fa61f2d17574483f7ffbb431b4acb2f', 'false');

INSERT INTO projects (name, source_url, deployment_url, approval_status,
                      description, owner_id)
VALUES
  ('UnitTest Project', 'https://kurtjlewis.com', '', 0, 'Description', 1),
  ('UnitTest Project2', 'https://zacharysang.com', '', 0, 'Description', 1);
