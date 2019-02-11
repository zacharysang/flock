import functools

from flask import (
    Blueprint, flash, g, redirect, render_template, request, session, url_for
)

from flock_server.db import get_db

bp = Blueprint('host', __name__)

@bp.route('/queue')
def queue():
    """Shows currently queued projects.
    """

    return render_template('host/queue.html')


@bp.route('/submit')
def submit_project():
    """For submitting of new projects.
    """

    return render_template('host/submit.html')
