import pytest
from flock_server.db import get_db


@pytest.mark.parametrize('path', (
    '/host/submit',
    '/host/1'
))
def test_login_required(client, path):
    response = client.get(path)
    assert response.headers['Location'].endswith('/login')

@pytest.mark.parametrize('path', (
    '/host/1',
))
def test_owner_required(client, auth, path):
    auth.login(email='test-2@email.com', password='test')
    # Follow redirect and ensure there is a message about permissions
    response = client.get(path, follow_redirects=True)
    assert b'permissions' in response.data


