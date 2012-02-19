#!/usr/bin/env python
#
#   ConnectionManager 3 - a simple script to convert SSHMenu configuration file 
#   to a CM configuration file.
#   It ignore "global" and "classes" sections of SSHMenu
#
#   Copyright (C) 2011  Stefano Ciancio
#
#   This library is free software; you can redistribute it and/or
#   modify it under the terms of the GNU Library General Public
#   License as published by the Free Software Foundation; either
#   version 2 of the License, or (at your option) any later version.
#
#   This library is distributed in the hope that it will be useful,
#   but WITHOUT ANY WARRANTY; without even the implied warranty of
#   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
#   Library General Public License for more details.
#
#   You should have received a copy of the GNU Library General Public
#   License along with this library; if not, write to the Free Software
#   Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA

import yaml
import os.path
import json

F = open(os.getenv("HOME") + '/.sshmenu')
DATAMAP = yaml.load(F)
F.close()

JSON_OUTPUT = ""

def print_item(itype, iname, ihost, iprofile, iprotocol):
    """Print item json string"""
    return '[{"Type":'+json.dumps(itype)+','+ \
    '"Name":'+json.dumps(str(iname))+','+ \
    '"Host":'+json.dumps(str(ihost))+','+ \
    '"Profile":'+json.dumps(str(iprofile))+','+ \
    '"Protocol":'+json.dumps(str(iprotocol))+','+ \
    '"Children":[]' \
    '}]'

def print_folder(ftype, fname, fhost, fprofile, fprotocol):
    """Print folder json string"""
    return '"Type":'+json.dumps(str(ftype))+','+ \
    '"Name":'+json.dumps(str(fname))+','+ \
    '"Host":'+json.dumps(str(fhost))+','+ \
    '"Profile":'+json.dumps(str(fprofile))+','+ \
    '"Protocol":'+json.dumps(str(fprotocol))+','+ \
    '"Children":'

def convert(dct):
    """Convert sshmenu config to cm config"""

    global JSON_OUTPUT

    items = dct

    for index, child in enumerate(items):

        if child['type'] == 'menu':
            JSON_OUTPUT += "[{"+print_folder('__folder__', child['title'], 
                None, None, None)+"["
            convert(child['items'])
            JSON_OUTPUT += "]}]"
            if index+1 != len(items):
                JSON_OUTPUT += ","

        if child['type'] == 'host':
            JSON_OUTPUT += print_item('__item__', child['title'], 
                child['sshparams'], child['profile'], 'ssh')
            if index+1 != len(items):
                JSON_OUTPUT += ","

        if child['type'] == 'separator':
            JSON_OUTPUT += print_item('__sep__', '_____________________',
                '', '', '')
            if index+1 != len(items):
                JSON_OUTPUT += ","

    return JSON_OUTPUT



# Read Configuration
JSON_OUTPUT = '{"Root": [' + convert(DATAMAP['items']) + ']}'

print(json.dumps(json.loads(JSON_OUTPUT), indent=2))




