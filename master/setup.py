from setuptools import find_packages, setup

setup(
    name='flock_server',
    version='0.1.0',
    author='Kurt Lewis',
    url='https://github.com/zacharysang/flock',
    packages=find_packages(),
    include_package_data=True,
    zip_safe=False,
    install_requires=[
        'flask',
    ],
)
