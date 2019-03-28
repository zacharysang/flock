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
def getWorkPage():
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
