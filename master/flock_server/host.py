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
