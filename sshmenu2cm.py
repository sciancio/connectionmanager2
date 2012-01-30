#!/usr/bin/env python2

import yaml
import os.path
import json

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

f = open(os.getenv("HOME") + '/.sshmenu')
dataMap = yaml.load(f)
f.close()

json_output = ""

def print_item(type, name, host, profile, protocol):
	return '[{"Type":'+json.dumps(type)+','+ \
	'"Name":'+json.dumps(str(name))+','+ \
	'"Host":'+json.dumps(str(host))+','+ \
	'"Profile":'+json.dumps(str(profile))+','+ \
	'"Protocol":'+json.dumps(str(protocol))+','+ \
	'"Children":[]' \
	'}]'

def print_folder(type, name, host, profile, protocol):
	return '"Type":'+json.dumps(str(type))+','+ \
	'"Name":'+json.dumps(str(name))+','+ \
	'"Host":'+json.dumps(str(host))+','+ \
	'"Profile":'+json.dumps(str(profile))+','+ \
	'"Protocol":'+json.dumps(str(protocol))+','+ \
	'"Children":'

def convert(dct, parent=''):

	global json_output

	items = dct;

	for index, child in enumerate(items):

		if child['type'] == 'menu':
			json_output += "[{"+print_folder('__folder__', child['title'], None, None, None)+"["
			convert(child['items'], '')
			json_output += "]}]"
			if index+1 != len(items):
				json_output += ","
	
		if child['type'] == 'host':
			json_output += print_item('__item__', child['title'], child['sshparams'], child['profile'], 'ssh')
			if index+1 != len(items):
				json_output += ","

		if child['type'] == 'separator':
			json_output += print_item('__sep__', '_____________________', '', '', '')
			if index+1 != len(items):
				json_output += ","
			
	return json_output



# Read Configuration
json_output = '{"Root": [' + convert(dataMap['items'], '') + ']}'

print(json.dumps(json.loads(json_output), indent=2))




