"""
Kurt Lewis
This file handles the automagic deployment of projects onto AWS
"""
import hashlib
import logging
import os
import random
import re
import shutil
import string
import subprocess
from datetime import datetime

from flask import current_app

from flock_server.db import get_db

docker_compose_filename = 'docker_compose.yml'
ecs_params_filename = 'ecs_params.yml'

logging.basicConfig(filename='server.log', level=logging.INFO)

def generate_hash_id(user_id, project_name):
    """Generates a unique hash id per project name + user_id.
    Concatenates user id to project name and hashes that using sha1.
    Safe to call not in a deployment environment
    """
    string = str(user_id) + str(project_name) + str(datetime.now())
    return hashlib.sha1(string.encode('utf-8')).hexdigest()

def get_deploy_folder_path():
    """Returns the full path to the deploy folder.
    Safe to call not in a deployment environment
    """
    # Create the deploy folder path
    deploy_folder_path = os.path.join(current_app.instance_path, 'deploys')

    return deploy_folder_path

def get_config_file_paths(hash_id):
    """Returns a tuple of config file paths (docker compose yml, ecs params yml)
    Safe to call not in a deployment environment.
    """
    folder_path = get_project_folder(hash_id)
    docker_compose_path = os.path.join(folder_path, docker_compose_filename)
    ecs_params_path = os.path.join(folder_path, ecs_params_filename)

    return (docker_compose_path, ecs_params_path)

def get_project_folder_from_id(project_id):
    """Returns the folder for a given project. Creates it if it does not exist.
    Safe to call not in a deployment environment.
    """
    # get the hash_id
    db = get_db()
    hash_id = db.execute('SELECT hash_id FROM projects WHERE id=(?);',
                         (project_id,)).fetchone()

    return get_project_folder(hash_id)

def get_project_folder(hash_id):
    """Returns the folder for a given project. Creates it if it does not exist.
    Safe to call not in a deployment environment.
    """
    # check to see if a folder for this project has been created in the instance
    # folder
    deploy_folder_path = get_deploy_folder_path()
    path = os.path.join(deploy_folder_path, hash_id)
    if not os.path.exists(path):
        # it doesn't exist, so make the path
        os.makedirs(path)
    elif not os.path.isdir(path):
        print('Error: {path} cannot be made because it is a file.'
              .format(path=path))
        raise Exception

    return path

def deploy_project(project_id):
    """Central driving function for deploying projects to AWS.
    """
    logging.info('Begining deploy for project {}'.format(project_id))

    # get the project from that database
    db = get_db()
    cursor = db.cursor()
    project = cursor.execute(
        'SELECT * FROM projects where id=(?);',
        (project_id,)).fetchone()

    # generate hash if it doesn't already exist, but it should
    if project['hash_id'] is None or project['hash_id'] == '':
        hash_id = generate_hash_id(project['owner_id'], project['name'])
        # write the hash id to the project
        cursor.execute(
            'UPDATE projects SET hash_id=(?) WHERE id=(?);',
            (hash_id, project_id,))
        db.commit()
    else:
        hash_id = project['hash_id']
    
    # first need to build config files
    build_config_files(hash_id,
                       project['id'],
                       project['min_workers'],
                       project['secret_key'])

    start_container(hash_id)

    # get url
    update_status(project_id)

def destroy_project(project_id):
    """Destroys a given project by stopping container and deleting config files.
    """
    logging.info('Destroying deployment for project {}'.format(project_id))

    # get the project from that database
    db = get_db()
    project = db.execute(
        'SELECT * FROM projects where id=(?);',
        (project_id,)).fetchone()

    # get hash id from project
    hash_id = project['hash_id']

    stop_container(hash_id)

    # delete the folder with config details
    path = get_project_folder(hash_id)
    shutil.rmtree(path)

    

def build_config_files(hash_id, project_id, min_workers, secret_key):
    """Builds the config files needed for deploying to AWS.
    """
    # define the docker compose file with params
    docker_compose = ('version: \'3\'\n'
                      'services:\n'
                      '  {hash_id}:\n'
                      '    image: {image_name}\n'
                      '    environment:\n' # configure environment variables
                      '      - FLOCK_MIN_SIZE={flock_min_size}\n'
                      '      - FLOCK_PORT={flock_port}\n'
                      '      - FLOCK_SESSION_SECRET={flock_session_secret}\n'
                      '      - FLOCK_URL={flock_url}\n'
                      '    ports:\n'
                      '      - "{flock_port}:{flock_port}"\n'
                      '    logging:\n'
                      '      driver: awslogs\n'
                      '      options:\n'
                      '        awslogs-group: {group}\n' # Should be hardcoded?
                      '        awslogs-region: {region}\n'
                      '        awslogs-stream-prefix: {hash_id}\n')
    # define the ecs params file with params
    ecs_params = ('version: 1\n'
                  'task_definition:\n'
                  '  task_execution_role: ecsTaskExecutionRole\n'
                  '  ecs_network_mode: awsvpc\n'
                  '  task_size:\n'
                  '    mem_limit: 0.5GB\n'
                  '    cpu_limit: 256\n'
                  'run_params:\n'
                  '  network_configuration:\n'
                  '    awsvpc_configuration:\n'
                  '      subnets:\n'
                  '        - "{subnet_id_1}"\n'
                  '        - "{subnet_id_2}"\n'
                  '      security_groups:\n'
                  '        - "{security_group_id}"\n'
                  '      assign_public_ip: ENABLED\n')


    
    #
    # generate the files and write them to the directory
    #
    # get the paths for the files
    (docker_compose_path, ecs_params_path) = get_config_file_paths(hash_id)

    # create session secret
    session_secret = ''.join(random.SystemRandom()
                             .choice(string.ascii_uppercase +
                                     string.ascii_lowercase +
                                     string.digits)
                             for _ in range(10))

    # generate the docker compose file
    docker_compose = docker_compose.format(hash_id=hash_id,
                                           image_name=current_app.config['FLOCK_CONTAINER_NAME'],
                                           flock_min_size=min_workers,
                                           flock_port=current_app.config['FLOCK_PORT'],
                                           flock_session_secret=session_secret,
                                           flock_url=current_app.config['FLOCK_URL'] + '/work/{}?key={}'.format(project_id, secret_key),
                                           group=current_app.config['FLOCK_LOG_GROUP'],
                                           region=current_app.config['FLOCK_REGION'],)
    with open(docker_compose_path, 'w') as file:
        file.write(docker_compose)
                                           
    # generate ecs params
    ecs_params = ecs_params.format(subnet_id_1=current_app.config['FLOCK_SUBNET_1_ID'],
                                   subnet_id_2=current_app.config['FLOCK_SUBNET_2_ID'],
                                   security_group_id=current_app.config['FLOCK_SECURITY_GROUP_ID'])
    with open(ecs_params_path, 'w') as file:
        file.write(ecs_params)
    

def start_container(hash_id):
    (docker_compose_path, ecs_params_path) = get_config_file_paths(hash_id) 

    # build the start command
    # TODO - i'm not sure if project name means something different
    # TODO - see if I can just use 'cluster' instead of cluster-config
    start_cmd = ('{ecs_cli_path} compose --project-name {hash_id} '
                 '--ecs-params {ecs_params} '
                 '--file {docker_compose} '
                 'up '
                 '--cluster-config {cluster_config} '
                 '--ecs-profile {ecs_profile} ')
    start_cmd = start_cmd.format(ecs_cli_path=current_app.config['ECS_CLI_PATH'],
                                 hash_id=hash_id,
                                 cluster_config=current_app.config['FLOCK_CLUSTER_CONFIG'],
                                 ecs_params=ecs_params_path,
                                 docker_compose=docker_compose_path,
                                 ecs_profile=current_app.config['FLOCK_ECS_PROFILE'])

    # Run the start command
    logging.info('start command: ' + start_cmd)
    print(start_cmd)
    proc = subprocess.run(start_cmd.split(' '),
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    print(proc.stdout)
    logging.info('start output: ' + proc.stdout.decode('utf-8'))

def stop_container(hash_id):
    (docker_compose_path, ecs_params_path) = get_config_file_paths(hash_id)

    # build the stop command
    # TODO - i'm not sure if project name means something different
    # TODO - see if I can just use 'cluster' instead of cluster-config
    stop_cmd= ('{ecs_cli_path} compose --project-name {hash_id} '
               '--ecs-params {ecs_params} '
               '--file {docker_compose} '
               'down '
               '--cluster-config {cluster_config} '
               '--ecs-profile {ecs_profile}')
    stop_cmd = stop_cmd.format(ecs_cli_path=current_app.config['ECS_CLI_PATH'],
                               hash_id=hash_id,
                               cluster_config=current_app.config['FLOCK_CLUSTER_CONFIG'],
                               ecs_params=ecs_params_path,
                               docker_compose=docker_compose_path,
                               ecs_profile=current_app.config['FLOCK_ECS_PROFILE'])

    # run the stop command
    logging.info('stop command: ' + stop_cmd)
    proc = subprocess.run(stop_cmd.split(' '),
                          stdout=subprocess.PIPE,
                          stderr=subprocess.PIPE)
    logging.info('stop output: ' + proc.stdout.decode('utf-8'))

    if proc.returncode != 0:
        logging.error('Failed to stop container.')


def update_status(project_id):
    # get the hash id from the project id from the database
    db = get_db()
    project = db.execute('SELECT * FROM projects where id=(?);',
                         (project_id,)).fetchone()
    hash_id = project['hash_id']

    (docker_compose_path, ecs_params_path) = get_config_file_paths(hash_id) 

    # build the status command
    # TODO - I'm not sure if project-name means something different
    # TODO - see if I can just use 'cluster' instead of cluster-config
    status_cmd = ('{ecs_cli_path} compose --project-name {hash_id} '
                  '--ecs-params {ecs_params} '
                  '--file {docker_compose} '
                  'ps '
                  '--cluster-config {cluster_config} '
                  '--ecs-profile {ecs_profile}')
    status_cmd = status_cmd.format(ecs_cli_path=current_app.config['ECS_CLI_PATH'],
                                   hash_id=hash_id,
                                   ecs_params=ecs_params_path,
                                   docker_compose = docker_compose_path,
                                   cluster_config=current_app.config['FLOCK_CLUSTER_CONFIG'],
                                   ecs_profile=current_app.config['FLOCK_ECS_PROFILE'])

    # Run the status command and capture the output
    logging.info('status command: ' + status_cmd)
    proc = subprocess.run(status_cmd.split(' '),
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    # decode output and log it
    output = proc.stdout.decode('utf-8')
    print(output)
    logging.info('status output: ' + output)
    
    # find the IP address and health of the project using regex
    # Start with hash id, then look for optional colon followed by number
    # there will then be a status and eventually an IP
    # if the status is a fail condition, this regex won't match
    regex = ':?\d*\s*(?P<status>\w*)\s*(?P<ip>\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'
    regex = hash_id + regex
    match = re.search(regex, output)

    if match is not None:
        db.execute(('UPDATE projects SET deployment_url=(?), health_status=(?) '
                   'WHERE id=(?);'),
                   (match.group('ip'), match.group('status'), project_id,))
        db.commit()
    else:
        logging.error('Did not find ip or status')
        if re.search('STOPPED', output) is not None:
            print('Container didn\'t start.')
            logging.error('Container didn\'t start.')
            status = 'STOPPED'
            message = 'Container failed to start...'
            db.execute(('UPDATE projects SET health_status=(?), '
                        'health_message=(?) WHERE id=(?);'),
                       (status, message, project_id,))
            db.commit()

    
