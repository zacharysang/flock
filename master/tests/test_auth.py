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
