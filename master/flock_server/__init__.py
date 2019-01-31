import os

from flask import Flask

from flask import (
    render_template
)


def create_app(test_config=None):
    # create and configure the app
    app = Flask(__name__, instance_relative_config=True)

    if test_config is None:
        # load the instince config if it exists when not testting
        app.config.from_pyfile('config.py', silent=True)
    else:
        # load the test config if passed in
        app.config.from_mapping(test_config)
    
    # ensure the instance folder exists
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass

    # index page
    @app.route('/')
    def get_index():
        return render_template('index.html')

    #
    # load blueprints
    #
    # auth
    from . import auth
    app.register_blueprint(auth.bp)

    # work module
    from . import work
    app.register_blueprint(work.bp)

    return app
