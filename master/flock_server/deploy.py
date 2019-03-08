"""
Kurt Lewis
This file handles the automagic deployment of projects onto AWS
"""
import hashlib
import os

from flask import current_app

deploy_folder_path = os.path.join(current_app.instance_path, 'deploys')

def generate_id(user_id, project_name):
    """Generates a unique hash id per project name + user_id.
    Concatenates user id to project name and hashes that using sha1.
    """
    string = str(user_id) + str(project_name)
    return hashlib.sha1(string.encode('utf-8')).hexdigest()

def deploy_project():
    """Central driving function for deploying projects to AWS.
    """
    

def build_config_files(hash_id):
    """Builds the config files needed for deploying to AWS.
    """
    # define the docker compose file with params
    docker_compose = ('version \'3\'\n'
                      'services:\n'
                      '  {hash_id}:\n'
                      '    image: {image_name}\n'
                      '    ports:\n'
                      '      - "80:80"\n'
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
                  '    mem_limit = 0.5GB\n'
                  '    cpu_limit = 256\n'
                  'run_params:\n'
                  '  network_configuration:\n'
                  '    awsvpc_configuration:\n'
                  '      subnets:\n'
                  '        - "{subnet_id_1}"\n'
                  '        - "{subnet_id_2}"\n'
                  '      security_groups:\n'
                  '        - "{security_group_id}"\n'
                  '      assign_public_ip: ENABLED\n')
    # check to see if a folder for this project has been created in the instance
    # folder
    path = os.path.join(deploy_folder_path, hash_id)
    if not os.path.exists(path):
        # it doesn't exist, so make the path
        os.makedirs(path)
    elif not os.path.isdir(path):
        print('Error: {path} cannot be made because it is a file.'
              .format(path=path))
        raise Exception





