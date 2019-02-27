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
def test_submit_validation(client, auth, name, source_url, message):
    auth.login()

    response = client.post(
        '/host/submit',
        data= { 'name' : name, 'source-url': source_url,
                'description' : '' }
    )
    assert message in response.data

@pytest.mark.parametrize('path', (
    '/9',
    '/9/approve'
))
def test_404(client, auth, path):
    """Test that all project urls show a 404 when the project doesn't exist.
    login as super user because we can test more urls and it won't make
    a project exist when it shouldn't
    """
    auth.login_super()
    response = client.get(path)
    assert response.status_code == 404


def test_submit(client, auth, app):
    """Tests a successful submit."""
    auth.login()
    assert client.get('/host/submit').status_code == 200
    client.post(
        '/host/submit',
        data = { 'name': 'submit-test',
                 'source-url': 'https://zacharysang.com',
                 'description': 'Creation description'
        }
    )

    with app.app_context():
        db = get_db()
        count = db.execute('SELECT COUNT(id) FROM projects').fetchone()[0]
        assert count == 3
    

def test_approve(client, auth, app):
    """Try to approve project id = 1."""
    auth.login_super()
    response = client.get('/host/1/approve')
    assert response.status_code == 302
    assert response.headers['Location'].endswith('/host/queue')
    

    with app.app_context():
        db = get_db()
        project = db.execute('SELECT * FROM projects WHERE id=1').fetchone()
        assert project['approval_status'] == 1


def test_queue(client, auth):
    auth.login_super()
    assert client.get('/host/queue').status_code == 200

def test_detail(client, auth):
    auth.login()
    response = client.get('/host/1')
    assert response.status_code == 200
    assert b'WAITING' in response.data 
