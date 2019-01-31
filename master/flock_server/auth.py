import functools

from flask import (
    Blueprint, flash, g, redirect, render_template, request, session, url_for
)
from werkzeug.security import check_password_hash, generate_password_hash


bp = Blueprint('auth', __name__, url_prefix='/auth')


@bp.route('/login', methods=('GET', 'POST'))
def register():
    """
    Handles GET and POST requests on the 'auth/login' route
    """
    if request.method == 'GET':
        return render_template('auth/login.html')