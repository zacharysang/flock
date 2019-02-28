This directory is home to the master service of flock.

Setup and usage instructions are forthcoming...

# Setup
## Python
The actual webserver is written in python. For everything but project
deployment, it can be sufficient to only do this portion.
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

## AWS Setup
Because this project interfaces with AWS cli's, it's necessary to install a
few AWS tools. First install the [AWS CLI]()
and the [ECS CLI](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ECS_CLI_installation.html).

This project requires a dedicated IAM user for a secret key and ID.
That user needs to have the Policy `AmazonECSTaskExecutionRolePolicy`.
If I can reduce the needed permissions, I'll document that here.

You'll also need a second AWS IAM user with more thorough permissions for the
initial configuration steps. I user my full power personal account to do this.
These steps will be runnable from any machine, so it is possible to run them
from a development machine and avoid having these credentials ever touch the
production environment. Initial configuration steps also require the
[AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-install.html).

### Configuring Fargate Cluster
Containers deployed from the flock_server application will be deployed to
a fargate cluster you define by following these steps. 

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

# Generate a module for distribution
To register the module locally, run:
```
$ pip install -e .
```

# Testing
To run tests, with the environment variables from above set, the virtual env
activated, and the package registered locally run:
```
$ pytest
```
To run a coverage report, run:
```
$ coverage run -m pytest
```
To generate the coverage report, run:
```
$ coverage html
```

# Working on this app
This app is written in Flask.
 [Their documentation can be found here](http://flask.pocoo.org/docs/1.0/).

[Working with templates.](http://flask.pocoo.org/docs/1.0/patterns/templateinheritance/#template-inheritance)

