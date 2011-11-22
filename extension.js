//   ConnectionManager 3 - Simple GUI app for Gnome 3 that provides a menu 
//   for initiating SSH/Telnet connections. 
//   Copyright (C) 2011  Stefano Ciancio
//
//   This library is free software; you can redistribute it and/or
//   modify it under the terms of the GNU Library General Public
//   License as published by the Free Software Foundation; either
//   version 2 of the License, or (at your option) any later version.
//
//   This library is distributed in the hope that it will be useful,
//   but WITHOUT ANY WARRANTY; without even the implied warranty of
//   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
//   Library General Public License for more details.
//
//   You should have received a copy of the GNU Library General Public
//   License along with this library; if not, write to the Free Software
//   Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA

const St = imports.gi.St;
const Gdk = imports.gi.Gdk;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Shell = imports.gi.Shell;

const Mainloop = imports.mainloop;
const Signals = imports.signals;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Panel = imports.ui.panel;
const Util = imports.misc.util;

const Gettext = imports.gettext.domain('gnome-shell-extensions');
const _ = Gettext.gettext;


function ConnectionManager(metadata) {
	this._init.apply(this, arguments);
}

ConnectionManager.prototype = {
	__proto__: PanelMenu.SystemStatusButton.prototype,

	_init: function(metadata) {

		this._configFile = GLib.build_filenamev([GLib.get_home_dir(), metadata.sw_config]);
		this._prefFile = GLib.build_filenamev([global.userdatadir, '/extensions/', metadata.uuid, metadata.sw_bin]);

		PanelMenu.SystemStatusButton.prototype._init.call(this, '', 'Connection Manager');

		// Label CM
		let label = new St.Label({ text: _("CM") });
		this.actor.get_children().forEach(function(c) { c.destroy() });
		this.actor.add_actor(label);

		this._readConf();
		// Update every 1 minute
		GLib.timeout_add(0, 60000, Lang.bind(this, 
			function () {
				this._readConf();
				return true;
			}));

	},

	_readConf: function () {

		this.menu.removeAll();
		
		if (GLib.file_test(this._configFile, GLib.FileTest.EXISTS) ) {

			let filedata = GLib.file_get_contents(this._configFile, null, 0);
			let jsondata = JSON.parse(filedata[1]);
			let root = jsondata['Root'];

			this._readTree(root, this, "");
		} else {
			global.logError("CONNMGR: Error reading config file " + this._configFile);
			let filedata = null
		}

		let menuSepPref = new PopupMenu.PopupSeparatorMenuItem();
		this.menu.addMenuItem(menuSepPref, this.menu.length);
		
		let menuPref = new PopupMenu.PopupMenuItem("Connection Manager Settings");
		menuPref.connect('activate', Lang.bind(this, function() {
			Util.spawnCommandLine('python ' + this._prefFile);
		}));
		this.menu.addMenuItem(menuPref, this.menu.length+1);

		let menuReload = new PopupMenu.PopupMenuItem("Configuration Reload");
		menuReload.connect('activate', Lang.bind(this, function() { this._readConf(); } ));
		this.menu.addMenuItem(menuReload, this.menu.length+2);
		
		
	},


	_createCommand: function(child) {

		let command = 'gnome-terminal';

		sshparams = child.Host.match(/^((?:\w+="(?:\\"|[^"])*" +)*)/g)[0];
		sshparams_noenv = child.Host.match(/^(?:\w+="(?:\\"|[^"])*" +)*(.*)$/)[1];

		if (sshparams && sshparams.length > 0) {
			command = sshparams + ' ' + command + ' --disable-factory';
		}

		if (child.Profile && child.Profile.length > 0) {
			command += ' --window-with-profile=' + (child.Profile).quote();
		}

		command += ' --title=' + (child.Name).quote();
		command += ' -e ' + (child.Protocol + " " + sshparams_noenv).quote();

		command = 'sh -c ' + command.quote();

		return command;
	},


	_readTree: function(node, parent, ident) {

		let child, menuItem, menuSep, menuSub, icon, 
			menuItemAll, iconAll, menuSepAll, ident_prec;
		let childHasItem = false, commandAll = new Array(), itemnr = 0;

		// For each child ... 
		for (let i = 0; i < node.length; i++) {
			child = node[i][0];

			if (child.hasOwnProperty('Type')) {

				if (child['Type'] == '__item__') {

					menuItem = new PopupMenu.PopupMenuItem(ident+child.Name);
					icon = new St.Icon({icon_name: 'terminal',
							icon_type: St.IconType.FULLCOLOR,
							style_class: 'connmgr-icon' });
					menuItem.addActor(icon, { align: St.Align.END});

					let command = this._createCommand(child);
					menuItem.connect('activate', function() {
						Util.spawnCommandLine(command); 
					});
					parent.menu.addMenuItem(menuItem, i);
					
					childHasItem = true;
					commandAll[itemnr] = command;
					itemnr++;
					
				}
				if (child['Type'] == '__sep__') {
					menuSep = new PopupMenu.PopupSeparatorMenuItem();
					parent.menu.addMenuItem(menuSep, i);
				}
				if (child['Type'] == '__folder__') {

					menuSub = new PopupMenu.PopupSubMenuMenuItem(ident+child.Name);
					icon = new St.Icon({icon_name: 'folder',
							icon_type: St.IconType.FULLCOLOR,
							style_class: 'connmgr-icon' });
					menuSub.addActor(icon, { align: St.Align.END});

					parent.menu.addMenuItem(menuSub);
					ident_prec = ident;
					this._readTree(child.Children, menuSub, ident+"  ");
					
				}
			}
		}
		
		if (childHasItem) {
			menuItemAll = new PopupMenu.PopupMenuItem(ident+"Open all windows");
			iconAll = new St.Icon({icon_name: 'fileopen',
							icon_type: St.IconType.FULLCOLOR,
							style_class: 'connmgr-icon' });
			menuItemAll.addActor(iconAll, { align: St.Align.END});

			
			menuSepAll = new PopupMenu.PopupSeparatorMenuItem();
			parent.menu.addMenuItem(menuItemAll, 0);
			parent.menu.addMenuItem(menuSepAll, 1);
			
			menuItemAll.connect('activate', function() { 
				for (let c = 0; c < commandAll.length; c++) {
					Util.spawnCommandLine(commandAll[c]);
				}
			});
		}
		
		ident = ident_prec;
	},

	enable: function() {
		let _children = Main.panel._rightBox.get_children();
		Main.panel._rightBox.insert_actor(this.actor, _children.length - 1);
		Main.panel._menus.addMenu(this.menu);
	},
	
	disable: function() {
		Main.panel._menus.removeMenu(this.menu);
		Main.panel._rightBox.remove_actor(this.actor);
	},

};


function init(metadata) {
	return new ConnectionManager(metadata);
}

