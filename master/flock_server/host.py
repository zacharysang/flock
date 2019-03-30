from enum import Enum
import functools
import os
import random
import string

from flask import (
    Blueprint, flash, g, redirect, render_template, request, session, url_for,
    abort, current_app, send_from_directory
)

from flock_server.db import get_db
from flock_server.deploy import (
    deploy_project, generate_hash_id, update_status, destroy_project,
    get_project_folder
)
from flock_server.auth import auth_required, super_user_permissions_required

bp = Blueprint('host', __name__, url_prefix='/host')

# Define enum for approval status'
class ApprovalStatus(Enum):
    WAITING=0
    APPROVED=1

# Constants for filenames of code and js file
CODE_FILENAME = 'user-code.js'
SECRETS_FILENAME = 'secret.js'

@bp.route('/queue')
@auth_required
@super_user_permissions_required
def queue():
    """Shows currently queued projects.
    """
    # setup the database
    db = get_db()
    cursor = db.cursor()
    
    projects = cursor.execute(
        'SELECT * FROM projects WHERE approval_status=(?);',
        (ApprovalStatus.WAITING.value,)).fetchall()

    return render_template('host/queue.html', projects=projects)

@bp.route('/<int:project_id>/approve')
@auth_required
@super_user_permissions_required
def approve(project_id):
    """Approves the project associated with a given project_id 
    """ 
    db = get_db()
    cursor = db.cursor()
    cursor.execute(
        'UPDATE projects SET approval_status=(?) WHERE id=(?);',
        (ApprovalStatus.APPROVED.value, project_id,))
    db.commit()

    # deploy the project if enabled
    if current_app.config['DO_DEPLOY']:
        deploy_project(project_id)

    return redirect(url_for('host.queue'))


@bp.route('/submit', methods=('GET', 'POST'))
@auth_required
def submit_project():
    """For submitting of new projects.
    """
    if request.method == 'POST':
        # pull the values from the request
        name = request.form['name']
        source_url = request.form['source-url']
        description = request.form['description']
        min_workers = request.form['min-workers']

        # setup the database
        db = get_db()
        cursor = db.cursor()
        error = None
        
        # check that user input exists
        if not name:
            error = 'Name is required.'
        elif not source_url:
            error = 'Source URL is required.'
        # description is not required
        elif not min_workers:
            error = 'Minimum number of workers is required.'
        elif 'code-file' not in request.files:
            error = 'Code file must be uploaded.'

        if error is None:
            # good to go forward with input
            # generate hash_id from owner id and name
            hash_id = generate_hash_id(g.user['id'], name)
            
            # generate a secret key for the project
            secret_key = ''.join(random.SystemRandom()
                                 .choice(string.ascii_uppercase +
                                         string.ascii_lowercase +
                                         string.digits)
                                 for _ in range(10))

            cursor.execute(
                ('INSERT INTO projects (name, source_url, description, '
                 'min_workers, secret_key, hash_id, owner_id) VALUES '
                 '(?, ?, ?, ?, ?, ?, ?);'),
                (name, source_url, description, min_workers, secret_key,
                 hash_id, g.user['id'])
            )
            db.commit()

            # save the code files to the deploy path with predescribed filenames
            project_folder = get_project_folder(hash_id)
            code_file = request.files['code-file']
            code_file.save(os.path.join(project_folder, CODE_FILENAME))

            if 'secrets-file' in request.files:
                secrets_file = request.files['secrets-file']
                secrets_file.save(os.path.join(project_folder,
                                               SECRETS_FILENAME))

            return redirect(url_for('index'))

        # there was an error, fall through with flash
        flash(error)

    return render_template('host/submit.html')

@bp.route('/<int:project_id>')
@auth_required
def detail(project_id):
    """Shows details of project for given project_id.
    """

    # setup the database
    db = get_db()
    cursor = db.cursor()

    # Get the project 
    project = cursor.execute(
        'SELECT * FROM projects WHERE id=(?);',
        (project_id,)
    ).fetchone()

    if project is None:
        abort(404, 'Project does not exist')

    # Check that this user can view the project
    if project['owner_id'] != g.user['id'] and g.user['super_user'] == 'false':
        # The current user doesn't own this project, don't show it to them
        flash('You don\'t have permissions to view this project')
        return redirect(url_for('index'))

    # Set the status variable to string representation
    project_approval_status = ApprovalStatus.WAITING.name
    project_approved = False
    if project['approval_status'] == ApprovalStatus.APPROVED.value:
        project_approval_status = ApprovalStatus.APPROVED.name
        project_approved = True

        # update the status of the project if deploy is enabled
        # only worth doing if the project is approved
        if current_app.config['DO_DEPLOY']:
            update_status(project_id) 

    return render_template('host/detail.html', project=project,
                           project_approval_status=project_approval_status,
                           project_approved=project_approved)

@bp.route('/<int:project_id>/delete')
@auth_required
def delete(project_id):
    """Deletes a given project.
    Deletes the deploy information and stops the given container.
    """

    db = get_db()
    # Get the project to verify owner identity
    project = db.execute('SELECT * FROM projects where id=(?);',
                         (project_id,)).fetchone()

    if project is None:
        abort(404, 'Project does not exist')

    # Check that this user can delete the project
    if project['owner_id'] != g.user['id'] and g.user['super_user'] == 'false':
        # The current user doesn't own this project, don't delete it 
        flash('You don\'t have permissions to delete this project')
        return redirect(url_for('host.detail', project_id=project_id))

    # destroy the project if deploy is enabled
    if current_app.config['DO_DEPLOY']:
        destroy_project(project_id)

    # delete the database entry
    db.execute('DELETE FROM projects WHERE id=(?);', (project_id,))
    db.commit()

    return redirect(url_for('index'))

@bp.route('/<int:project_id>/file/<string:filename>')
def serve_file(project_id, filename):
    """Serves the requested file from the project's deployment folder.
    Only serves CODE_FILENAME and SECRETS_FILENAME
    Query arg: `key` - key used for serving the secrets file
    """

    # get the project from the project id
    db = get_db()
    project = db.execute('SELECT * FROM projects WHERE id=(?);',
                         (project_id,)).fetchone()

    if project is None:
        abort(404, 'Project does not exist')

    # make sure it's an allowable filename
    if filename != CODE_FILENAME and filename != SECRETS_FILENAME:
        abort(404, 'File not found.')

    # if the filename is SECRETS_FILENAME, make sure they have the key
    if filename == SECRETS_FILENAME:
        if (request.args.get('key') is None 
            or request.args.get('key') != project['secret_key']):
            # They don't have a valid key, abort with an error
            abort(403, 'Key required for accessing secret file.')

    # get the project folder path
    project_folder_path = get_project_folder(project['hash_id'])

    # check that the file exists
    if not os.path.isfile(os.path.join(project_folder_path, filename)):
        abort(404, 'File does not exist.')
    
    # serve the requested file
    return send_from_directory(project_folder_path, filename)
