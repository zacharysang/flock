import functools

from flask import (
    Blueprint, flash, g, redirect, render_template, request, session, url_for
)

from flock_server.db import get_db
from flock_server.auth import auth_required, super_user_permissions_required

bp = Blueprint('host', __name__)

@bp.route('/queue')
def queue():
    """Shows currently queued projects.
    """

    return render_template('host/queue.html')


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

        if error is None:
            # good to go forward with input
            cursor.execute(
                ('INSERT INTO projects (name, source_url, description, '
                'owner_id) VALUES (?, ?, ?, ?)'),
                (name, source_url, description, g.user['id'])
            )
            db.commit()
            return redirect(url_for('index'))

        # there was an error, fall through with flash
        flash(error)

    return render_template('host/submit.html')
