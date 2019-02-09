import functools

from flask import (
    Blueprint, flash, g, redirect, render_template, request, session, url_for
)

from werkzeug.security import check_password_hash, generate_password_hash

from flock_server.db import get_db

bp = Blueprint('auth', __name__)


@bp.route('/login', methods=('GET', 'POST'))
def login():
    """
    Handles GET and POST requests on the '/login' route
    """
    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']
        db = get_db()
        error = None
        cursor = db.cursor()
        cursor.execute(
            'SELECT * FROM users WHERE email = ?', (email,)
        )
        user = cursor.fetchone()

        # Check to see that user input required fields and info is valid
        if not email:
            error = 'Email is required.'
        elif not password:
            error = 'Password is required.'
        elif user is None:
            error = 'Incorrect email.'
        elif not check_password_hash(user['password'], password):
            error = 'Incorrect password.'

        if error is None:
            session.clear()
            session['user_id'] = user['id']
            return redirect(url_for('index'))

        flash(error)

    return render_template('auth/login.html')





@bp.route('/register', methods=('GET', 'POST'))
def register():
    """
    Handles GET and POST requests on the '/register' route
    """
    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']
        confirm_password = request.form['confirm-password']
        db = get_db()
        error = None

        # input validation
        if not email:
            error = 'Email is required.'
        elif not password:
            error = 'Password is required.'
        elif not confirm_password:
            error = 'Password confirmation is required.'
        elif password != confirm_password:
            error = 'Passwords do not match.'

        # check that the given email isn't already registered
        cursor = db.cursor()
        cursor.execute(
            'SELECT id FROM users WHERE email = ?', (email,)
        )
        if cursor.fetchone() is not None:
            error = 'Account cannot be registered'

        if error is None:
            cursor.execute(
                'INSERT INTO users (email, password) VALUES (?, ?)',
                (email, generate_password_hash(password))
            )
            db.commit()
            return redirect(url_for('auth.login'))

        flash(error)
    return render_template('auth/register.html')

@bp.route('/logout', methods=('GET',))
def logout():
    """ Handles GET request to '/logout' route.
    """
    session.clear()
    return redirect(url_for('index'))


def auth_required(view):
    """ Decorator for requiring authentication on other views
    """
    @functools.wraps(view)
    def wrapped_view(**kwargs):
        if g.user is None:
            return redirect(url_for('auth.login'))
        
        return view(**kwargs)
    
    return wrapped_view 
