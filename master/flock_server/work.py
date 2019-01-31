import functools

from flask import (
    Blueprint, flash, g, redirect, render_template, request, session, url_for
)

bp = Blueprint('work', __name__, url_prefix='/work')

@bp.route('/')
def getWorkPage():
  return render_template('work/index.html')