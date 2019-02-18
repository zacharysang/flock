"""Tests the create_app function.
"""
from flock_server import create_app

def test_config():
    assert not create_app().testing
    assert create_app({'TESTING': True}).testing

def test_index(client):
    response = client.get('/')
    assert b'Flock' in response.data
