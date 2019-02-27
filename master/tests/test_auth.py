"""Tests auth functionality of the app.
"""
import pytest
from flask import g, session
from flock_server.db import get_db

def test_register(client, app):
    # test that register page exists
    assert client.get('/register').status_code == 200
    # send good register post
    user_email = 'test-reg@email.com'
    response = client.post(
        '/register', data={'email': user_email,
                           'password': 'pass',
                           'confirm-password': 'pass'}
    )
    # redirects to login
    assert response.headers['Location'].endswith('/login')

    # Check the user was created
    with app.app_context():
        assert get_db().execute(
            'SELECT * FROM users WHERE email = (?)',
            ('test-reg@email.com',)
        ).fetchone() is not None

@pytest.mark.parametrize(('email', 'password', 'confirm_password', 'message'), (
    ('', 'pass', 'pass',  b'Email is required.'),
    ('email', '', 'pass', b'Password is required.'),
    ('email', 'pass', '', b'Password confirmation is required.'),
    ('email', 'pass', 'not-pass', b'Passwords do not match.'),
    # test@email.com is in data.sql
    ('test@email.com', 'pass', 'pass', b'Account cannot be registered'),
))
def test_register_validate_input(client, email, password, confirm_password,
                                 message):
    response = client.post(
        '/register',
        data={'email': email, 'password': password,
              'confirm-password': confirm_password
        }
    )
    assert message in response.data

def test_login(client, auth):
    assert client.get('/login').status_code == 200
    response = auth.login()
    assert response.headers['Location'].endswith('/')

    with client:
        client.get('/')
        assert session['user_id'] == 1
        assert g.user['email'] == 'test@email.com'

@pytest.mark.parametrize(('email', 'password', 'message'), (
    ('', 'test', b'Email is required.'),
    ('a', '', b'Password is required.'),
    ('a', 'test', b'Incorrect email.'),
    ('test@email.com', 'abc', b'Incorrect password.'),
))
def test_login_validate_input(auth, email, password, message):
    response = auth.login(email, password)
    assert message in response.data

def test_logout(client, auth):
    auth.login()

    with client:
        auth.logout()
        assert 'user_id' not in session
    
