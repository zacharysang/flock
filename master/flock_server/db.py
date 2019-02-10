import sqlite3

import click
from flask import current_app, g
from flask.cli import with_appcontext

def get_db():
    """
    Gets an instance of the database, and creates it if it doesn't exist
    """
    if 'db' not in g:
        # Database doesn't exist, so create it
        g.db = sqlite3.connect(
            current_app.config['DATABASE'],
            detect_types=sqlite3.PARSE_DECLTYPES
        )
        g.db.row_factory = sqlite3.Row
    return g.db

def close_db(e=None):
    """
    Closes the database 
    """
    db = g.pop('db', None)

    if db is not None:
        db.close()

def init_db():
    """ Runs the schema.sql sql script """
    db = get_db();

    with current_app.open_resource('schema.sql') as f:
        db.executescript(f.read().decode('utf8'))

@click.command('init-db')
@with_appcontext
def init_db_command():
    """
    CLI interface for running schema.sql which clears the database and creates
    new tables
    """
    init_db()
    click.echo('Initialized the database')


def init_app(app):
    """
    For registering the app from __init__.py
    """
    # Teardown when the app exits
    app.teardown_appcontext(close_db)
    # add the init_db_command so it can be called from the cli
    app.cli.add_command(init_db_command)
