import pytest
from io import BytesIO
from flock_server.db import get_db


@pytest.mark.parametrize('path', (
    '/host/submit',
    '/host/1',
    '/host/1/approve',
    '/host/1/delete',
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
    '/host/1/delete',
))
def test_owner_required(client, auth, path):
    auth.login(email='test-2@email.com', password='test')
    # Follow redirect and ensure there is a message about permissions
    response = client.get(path, follow_redirects=True)
    assert b'permissions' in response.data

@pytest.mark.parametrize(('name', 'source_url', 'min_workers', 'code_file',
                          'message'), (
    ('', 'https://kurtjlewis.com', '1', (BytesIO(b'CODE FILE'), 'flock.js'),
     b'Name is required.'),
    ('test proj', '', '1', (BytesIO(b'CODE FILE'), 'flock.js'),
     b'Source URL is required'),
    ('test proj2', 'https://kurtjlewis.com', '',
     (BytesIO(b'CODE FILE'), 'flock.js'),
     b'Minimum number of workers is required.'),
    ('test proj', 'https://kurtjlewis.com', '1', '',
     b'Code file must be uploaded.')
))
def test_submit_validation(client, auth, name, source_url, min_workers, 
                           code_file, message):
    auth.login()

    response = client.post(
        '/host/submit', buffered=True,
        content_type='multipart/form-data',
        data= { 'name' : name, 'source-url': source_url,
                'min-workers': min_workers,
                'description' : '',
                'code-file' : code_file}
    )
    assert message in response.data

@pytest.mark.parametrize('path', (
    '/9',
    '/9/approve',
    '/9/delete'
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
        '/host/submit', buffered=True,
        content_type='multipart/form-data',
        data = { 'name': 'submit-test',
                 'source-url': 'https://zacharysang.com',
                 'min-workers': '1',
                 'description': 'Creation description',
                 'code-file': (BytesIO(b'CODE_FILE'), 'flock.js'),
                 'secrets-file': (BytesIO(b'SECRETS'), 'secrets.js')
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

def test_delete(client, auth, app):
    auth.login()
    response = client.get('/host/1/delete')

    with app.app_context():
        db = get_db()
        project = db.execute('SELECT * FROM projects WHERE id=1;').fetchone()
        assert project is None
