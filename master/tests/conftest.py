import os
import tempfile

import pytest
from flock_server import create_app
from flock_server.db import get_db, init_db

with open(os.path.join(os.path.dirname(__file__), 'data.sql'), 'rb') as f:
    _data_sql = f.read().decode('utf8')

@pytest.fixture
def app():
    db_fd, db_path = tempfile.mkstemp()

    app = create_app({
        'TESTING': True,
        'DATABASE': db_path,
    })

    with app.app_context():
        init_db()
        get_db().executescript(_data_sql)

    yield app

    os.close(db_fd)
    os.unlink(db_path)
    
@pytest.fixture
def client(app):
    return app.test_client()

@pytest.fixture
def runner(app):
    return app.test_cli_runner()

# Fixture for making authenticated tests easier
class AuthActions(object):
    def __init__(self, client):
        self._client = client

    def login(self, email='test@email.com', password='test'):
        return self._client.post(
            '/login',
            data={'email': email, 'password': password}
        )

    def logout(self):
        return self._client.get('/logout')

@pytest.fixture
def auth(client):
    return AuthActions(client)

def test_index(client, auth):
    response = client.get('/')
    assert b'Log In' in response.data
    assert b'Register' in response.data

    auth.login()
    response = client.get('/')
    assert b'Log Out' in response.data
