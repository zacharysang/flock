import functools
import os
from enum import Enum

from flask import (
    Blueprint, flash, g, redirect, render_template, request, session, url_for,
    abort, current_app
)

from flock_server.db import get_db
from flock_server.deploy import (
    deploy_project, generate_hash_id, update_status, destroy_project,
    get_project_folder
)
from flock_server.auth import auth_required, super_user_permissions_required

bp = Blueprint('host', __name__, url_prefix='/host')

class ApprovalStatus(Enum):
    WAITING=0
    APPROVED=1

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
        'SELECT * FROM projects where approval_status=(?);',
        (ApprovalStatus.WAITING.value,)).fetchall()

    return render_template('host/queue.html', projects=projects)

@bp.route('/<int:id>/approve')
@auth_required
@super_user_permissions_required
def approve(id):
    """Approves the id of the projct
    """ 
    db = get_db()
    cursor = db.cursor()
    cursor.execute(
        'UPDATE projects SET approval_status=(?) WHERE id=(?)',
        (ApprovalStatus.APPROVED.value, id,))
    db.commit()

    # deploy the project if enabled
    if current_app.config['DO_DEPLOY']:
        deploy_project(id)

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

        print(request.files)
        for f in request.files:
            print(f)

        if error is None:
            # good to go forward with input
            # generate hash_id from owner id and name
            hash_id = generate_hash_id(g.user['id'], name)
            cursor.execute(
                ('INSERT INTO projects (name, source_url, description, '
                 'min_workers, hash_id, owner_id) VALUES (?, ?, ?, ?, ?, ?)'),
                (name, source_url, description, min_workers, hash_id, 
                 g.user['id'])
            )
            db.commit()

            # save the code files to the deploy path with predescribed filenames
            project_folder = get_project_folder(hash_id)
            code_file = request.files['code-file']
            code_file.save(os.path.join(project_folder, 'flock.js'))

            if 'secrets-file' in request.files:
                secrets_file = request.files['secrets-file']
                secrets_file.save(os.path.join(project_folder, 'secrets.js'))

            return redirect(url_for('index'))

        # there was an error, fall through with flash
        flash(error)

    return render_template('host/submit.html')

@bp.route('/<int:id>')
@auth_required
def detail(id):
    """Shows details of project for given id.
    """
    # update the status of the project if deploy is enabled
    if current_app.config['DO_DEPLOY']:
        update_status(id) 

    # setup the database
    db = get_db()
    cursor = db.cursor()

    # Get the project 
    project = cursor.execute(
        'SELECT * FROM projects WHERE id=(?)',
        (id,)
    ).fetchone()

    if project is None:
        abort(404, "Project does not exist")

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

    return render_template('host/detail.html', project=project,
                           project_approval_status=project_approval_status,
                           project_approved=project_approved)

@bp.route('/<int:id>/delete')
@auth_required
def delete(id):
    """Deletes a given project.
    Deletes the deploy information and stops the given container.
    """

    db = get_db()
    # Get the project to verify owner identity
    project = db.execute('SELECT * FROM projects where id=(?);',
                         (id,)).fetchone()

    if project is None:
        abort(404, "Project does not exist")

    # Check that this user can delete the project
    if project['owner_id'] != g.user['id'] and g.user['super_user'] == 'false':
        # The current user doesn't own this project, don't delete it 
        flash('You don\'t have permissions to delete this project')
        return redirect(url_for('host.detail', id=id))

    # destroy the project if deploy is enabled
    if current_app.config['DO_DEPLOY']:
        destroy_project(id)

    # delete the database entry
    db.execute('DELETE FROM projects WHERE id=(?);', (id,))
    db.commit()

    return redirect(url_for('index'))
