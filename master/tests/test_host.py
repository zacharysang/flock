import pytest
import json
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
    ('', 'https://kurtjlewis.com', '1', (BytesIO(b'CODE FILE'), 'user-code.js'),
     b'Name is required.'),
    ('test proj', '', '1', (BytesIO(b'CODE FILE'), 'user-code.js'),
     b'Source URL is required'),
    ('test proj2', 'https://kurtjlewis.com', '',
     (BytesIO(b'CODE FILE'), 'user-code.js'),
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
    '/9/delete',
    '/9/file/user-code.js',
    '/9/file/note-real.js'
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
                 'code-file': (BytesIO(b'CODE_FILE'), 'user-code.js'),
                 'secrets-file': (BytesIO(b'SECRETS'), 'secrets.js')
        }
    )

    with app.app_context():
        db = get_db()
        count = db.execute('SELECT COUNT(id) FROM projects;').fetchone()[0]
        assert count == 3
    

def test_approve(client, auth, app):
    """Try to approve project id = 1."""
    auth.login_super()
    response = client.get('/host/1/approve')
    assert response.status_code == 302
    assert response.headers['Location'].endswith('/host/queue')
    

    with app.app_context():
        db = get_db()
        project = db.execute('SELECT * FROM projects WHERE id=1;').fetchone()
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


def test_serve_file(client, auth, app):
    # need to submit some files first
    auth.login()
    project_name = 'serve-file-test'
    code_file_content = b'CODE FILE'
    secrets_file_content = b'SECRETS FILE'
    client.post(
        '/host/submit', buffered=True,
        content_type='multipart/form-data',
        data = { 'name': project_name, 
                 'source-url': 'https://zacharysang.com',
                 'min-workers': '1',
                 'description': 'Creation description',
                 'code-file': (BytesIO(code_file_content), 'user-code.js'),
                 'secrets-file': (BytesIO(secrets_file_content), 'secrets.js')
        }
    )
    # project is created, logout because these urls don't require sessions
    auth.logout()
    
    # get app context so we can get the project id
    with app.app_context():
        db = get_db()
        project = db.execute('SELECT * FROM projects WHERE name=(?);',
                             (project_name,)).fetchone()
        # make sure the project exists
        assert project is not None

        # check a couple of different urls to make sure they return content

        # check for user-code.js
        response = client.get('/host/{}/file/user-code.js'.format(project['id']))
        assert response.status_code == 200
        assert code_file_content in response.data

        # check for secret.js without key
        response = client.get('/host/{}/file/secret.js'.format(project['id']))
        assert response.status_code == 403

        # check for secret.js with key
        response = client.get('/host/{}/file/secret.js?key={}'
                              .format(project['id'], project['secret_key']))
        assert response.status_code == 200
        assert secrets_file_content in response.data

        # check for file that doesn't exist
        response = client.get('/host/{}/file/not-real.js'.format(project['id']))
        assert response.status_code == 404

def test_node_0_communicate(client, app):
    """Test that node-0-communicate can update the worker_count of a project."""
    with app.app_context():
        db = get_db()
        project = db.execute('SELECT * FROM projects WHERE id=1;').fetchone()
        response = client.post(
            '/host/{}/node-0-communicate'.format(project['id']),
            content_type='application/json',
            data = json.dumps({ 'secret_key': project['secret_key'],
                     'worker_count': '100'
            })
        )

        assert response.status_code == 200
        project = db.execute('SELECT * FROM projects WHERE id=1;').fetchone()
        assert project['worker_count'] == 100

def test_node_0_communicate_404(client):
    """Tests that node-0-communicate 404s for a non-existent project"""
    # test that it 404s
    assert client.post('/host/10/node-0-communicate').status_code == 404
