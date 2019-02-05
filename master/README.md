This directory is home to the master service of flock.

Setup and usage instructions are forthcoming...

# Setup
First setup a virtual environment using `python3` (which might just be `python`
on your system). Then install the necessary requirements

```
$ pwd
 ..../..../flock/master
$ python3 -m venv venv
$ source venv/bin/activate
# pip install -r requirements.txt
```
See the below section on running in a development environment for creating
a database.

# Running
## Development
To run in a development environment, use the following commands. The environment
variables only need set once per shell session.
```
$ export FLASK_APP=flock_server
$ export FLASK_ENV=development
$ flask run
```
If it's your first time running the site, or you want to rest all data in the
database, run the following command with `FLASK_APP` and `FLASK_ENV` defined.
```
$ flask init-db
```

# Working on this app
This app is written in Flask.
 [Their documentation can be found here](http://flask.pocoo.org/docs/1.0/).

[Working with templates.](http://flask.pocoo.org/docs/1.0/patterns/templateinheritance/#template-inheritance)

