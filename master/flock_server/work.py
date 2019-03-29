import functools
import os
import random

from flask import (
    Blueprint, flash, g, redirect, render_template, request, session, url_for
)

from flock_server.db import get_db
from flock_server.host import ApprovalStatus, CODE_FILENAME, SECRETS_FILENAME

bp = Blueprint('work', __name__, url_prefix='/work')

@bp.route('/')
def get_work_page():
    """Returns a work page for a project.
    """
    # get all projects that are approved and running
    db = get_db()
    cursor = db.cursor()
    cursor.execute(('SELECT * FROM projects WHERE approval_status=(?) AND '
                    'health_status="RUNNING";'),
                   (ApprovalStatus.APPROVED.value,));
    

    # algorithm to pick propject
    # version 1 is random
    projects = cursor.fetchall()
    
    # check that there are projects to work on
    if len(projects) == 0:
        flash('There are no projects to work on.')
        return redirect(url_for('index'))

    project = random.choice(projects)

    code_file = url_for('host.serve_file', project_id=project['id'],
                        filename=CODE_FILENAME)

    
    return render_template('work/index.html', code_file=code_file, secret=False)

@bp.route('/<int:project_id>')
def get_work_page_for_project(project_id):
    """Returns the work page for a specific project.
    """

    # Get the project from the db 
    db = get_db()
    project = db.execute('SELECT * FROM projects WHERE id=(?);',
                         (project_id,)).fetchone()

    # check that this project exists
    if project is None:
        abort(404, 'Project not found.')

    # check for key, which allows us to send secret file
    secret=False
    secrets_file = ''
    if request.args.get('key') == project['secret_key']:
        secret = True
        # flask makes key a query param:
        secrets_file = url_for('host.serve_file', project_id=project_id,
                               filename=SECRETS_FILENAME,
                               key=project['secret_key'])

    code_file = url_for('host.serve_file', project_id=project_id,
                        filename=CODE_FILENAME)

    return render_template('work/index.html', code_file=code_file,
                           secret=secret, secrets_file=secrets_file)
    
