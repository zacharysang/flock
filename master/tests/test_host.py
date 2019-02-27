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
    '/host/queue',
    '/host/1/approve'
))
def test_super_login_required(client, auth, path):
    auth.login()
    # should redirect to home page
    response = client.get(path, follow_redirects=True)
    # will be message stating that the user can't access this page
    assert b'super user' in response.data

@pytest.mark.parametrize('path', (
    '/host/1',
))
def test_owner_required(client, auth, path):
    auth.login(email='test-2@email.com', password='test')
    # Follow redirect and ensure there is a message about permissions
    response = client.get(path, follow_redirects=True)
    assert b'permissions' in response.data

@pytest.mark.parametrize(('name', 'source_url', 'message'), (
    ('', 'https://kurtjlewis.com', b'Name is required.'),
    ('test proj', '', b'Source URL is required')
))
def test_submit_project(client, auth, name, source_url, message):
    auth.login()

    response = client.post(
        '/host/submit',
        data= { 'name' : name, 'source-url': source_url,
                'description' : '' }
    )
    print(response.data)
    assert message in response.data

