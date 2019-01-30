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

# Running
## Development
To run in a development environment, use the following commands. The environment
variables only need set once per shell session.
```
$ export FLASK_APP=flock_server
$ export FLASK_ENV=development
$ flask run
```