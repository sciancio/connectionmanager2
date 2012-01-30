//   ConnectionManager 3 - Simple GUI app for Gnome 3 that provides a menu 
//   for initiating SSH/Telnet/Custom Apps connections. 
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
const Search = imports.ui.search;

const Mainloop = imports.mainloop;
const Signals = imports.signals;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Panel = imports.ui.panel;
const Util = imports.misc.util;

const Gettext = imports.gettext.domain('gnome-shell-extensions');
const _ = Gettext.gettext;

const GNOME_TERMINAL_APP = 'gnome-terminal';
const TERMINATOR_APP = 'terminator';


// SSH / Apps Search Provider
function SshSearchProvider() {
	this._init();
}

SshSearchProvider.prototype = {
	__proto__: Search.SearchProvider.prototype,

	_init: function() {
		Search.SearchProvider.prototype._init.call(this, "CONNECTION MANAGER");
		this.sshNames = [];
	},
	
	// Update list of SSH/Apps on configuration changes
	_update: function (sshNames) {
		this.sshNames = sshNames;
	},

	getResultMeta: function(resultId) {
	
		let appSys = Shell.AppSystem.get_default();
		let app = appSys.lookup_app('gnome-session-properties.desktop');

		switch (resultId.type) {
		case '__app__':
			app = appSys.lookup_app('gnome-session-properties.desktop');
			break;
		case '__item__':
			if (resultId.terminal) {
				app = appSys.lookup_app(TERMINATOR_APP + '.desktop');
			} else {
				app = appSys.lookup_app(GNOME_TERMINAL_APP + '.desktop');
			}
			break;
		}

		let ssh_name = resultId.name;

		return {'id': resultId,
				'name': ssh_name,
				'createIcon': function(size) {
								return app.create_icon_texture(size);
							  }
		};
	},

	activateResult: function(id) {
		Util.spawnCommandLine(id.command);
	},
	
	getInitialResultSet: function(terms) {
		// check if a found host-name begins like the search-term
		let searchResults = [];

		for (var i=0; i<this.sshNames.length; i++) {
			for (var j=0; j<terms.length; j++) {
				try {
					let pattern = new RegExp(terms[j],"gi");
					if (this.sshNames[i][2].match(pattern)) {

						searchResults.push({
								'type': this.sshNames[i][0],
								'terminal': this.sshNames[i][1],
								'name': this.sshNames[i][2],
								'command': this.sshNames[i][3]
						});
					}
				}
				catch(ex) {
					continue;
				}
			}
		}

		if (searchResults.length > 0) {
			return(searchResults);
		}

		return []
	},

	getSubsearchResultSet: function(previousResults, terms) {
		return this.getInitialResultSet(terms);
	},

}



function ConnectionManager(metadata) {
	this._init.apply(this, arguments);
}

ConnectionManager.prototype = {
	__proto__: PanelMenu.SystemStatusButton.prototype,

	_init: function(metadata) {

		this._configFile = GLib.build_filenamev([GLib.get_home_dir(), metadata.sw_config]);
		this._prefFile = GLib.build_filenamev([metadata.path, metadata.sw_bin]);

		// Search provider
		this._searchProvider = null;
		this._sshList = [];
		this._searchProvider = new SshSearchProvider();
		Main.overview.addSearchProvider(this._searchProvider);

		PanelMenu.SystemStatusButton.prototype._init.call(this, '', 'Connection Manager');

		this._readConf();

		// Icon
		let icon_file = GLib.build_filenamev([metadata.path, "emblem-cm-symbolic.svg"]);
		this._CMlogo = Gio.icon_new_for_string(icon_file);
		this.setGIcon(this._CMlogo);
		this.actor.set_size(40, 26);

	},

	_readConf: function () {

		this.menu.removeAll();
		this._sshList = [];

		if (GLib.file_test(this._configFile, GLib.FileTest.EXISTS) ) {

			let filedata = GLib.file_get_contents(this._configFile, null, 0);
			let jsondata = JSON.parse(filedata[1]);
			let root = jsondata['Root'];

			// Global Settings
			if (typeof(jsondata.Global) == 'undefined') {
				jsondata.Global = '';
			};

			this._menu_open_tabs = !(/^false$/i.test(jsondata.Global.menu_open_tabs));
			this._menu_open_windows = !(/^false$/i.test(jsondata.Global.menu_open_windows));
			this._terminator_as_terminal = (/^true$/i.test(jsondata.Global.terminator_as_terminal));

			this._readTree(root, this, "");

		} else {
			global.logError("CONNMGR: Error reading config file " + this._configFile);
			let filedata = null
		}

		let menuSepPref = new PopupMenu.PopupSeparatorMenuItem();
		this.menu.addMenuItem(menuSepPref, this.menu.length);
		
		let menuPref = new PopupMenu.PopupMenuItem("Connection Manager Settings");
		menuPref.connect('activate', Lang.bind(this, function() {
			try {
				Util.trySpawnCommandLine('python ' + this._prefFile);
			} catch (e) {
				Util.trySpawnCommandLine('python2 ' + this._prefFile);
			}
		}));
		this.menu.addMenuItem(menuPref, this.menu.length+1);
		
		// Update ssh name list
		this._searchProvider._update(this._sshList);
	},


	// This creates a command for each item using gnome-terminal
	_createCommand: function(child) {

		let command = '';

		if (child.Type == '__item__') {

			command += GNOME_TERMINAL_APP;

			let sshparams = child.Host.match(/^((?:\w+="(?:\\"|[^"])*" +)*)/g)[0];
			let sshparams_noenv = child.Host.match(/^(?:\w+="(?:\\"|[^"])*" +)*(.*)$/)[1];

			if (sshparams && sshparams.length > 0) {
				command = sshparams + ' ' + command + ' --disable-factory';
			}

			if (child.Profile && child.Profile.length > 0) {
				command += ' --window-with-profile=' + (child.Profile).quote();
			}

			command += ' --title=' + (child.Name).quote();
			command += ' -e ' + ("sh -c " + (child.Protocol + " " + sshparams_noenv).quote()).quote();

			command = 'sh -c ' + command.quote();

		}
		
		if (child.Type == '__app__') {
	
			if (child.Protocol == 'True') {
				command += GNOME_TERMINAL_APP + ' --title=' + (child.Name).quote() + ' -e ';
				command += (child.Host).quote();
			} else {
				command += child.Host;
			}
		}

		return command;
	},

	// This creates a command for each item using terminator (it must be installed)
	_createCommandTerminator: function(child) {

		let command = '';

		if (child.Type == '__item__') {

			command += TERMINATOR_APP;

			let sshparams = child.Host.match(/^((?:\w+="(?:\\"|[^"])*" +)*)/g)[0];
			let sshparams_noenv = child.Host.match(/^(?:\w+="(?:\\"|[^"])*" +)*(.*)$/)[1];

			if (sshparams && sshparams.length > 0) {
				command = sshparams + ' ' + command;
			}

			if (child.Profile && child.Profile.length > 0) {
				command += ' --profile=' + (child.Profile).quote();
			}

			command += ' --title=' + (child.Name).quote();
			command += ' -e ' + ("sh -c " + (child.Protocol + " " + sshparams_noenv).quote()).quote();

			command = 'sh -c ' + command.quote();

		}
		
		if (child.Type == '__app__') {
	
			if (child.Protocol == 'True') {
				command += TERMINATOR_APP + ' --title=' + (child.Name).quote() + ' -e ';
				command += (child.Host).quote();
			} else {
				command += child.Host;
			}
		}

		return command;
	},

	// This creates a command that when combined with other commands for items in same folder
	// Will open all items in a single tabbed gnome-terminal
	_createCommandTab: function(child) {
		let command = '';
		let sshparams = "";
		let sshparams_noenv = "";

		if (child.Type == '__item__') {

			command += ' ';

			sshparams = child.Host.match(/^((?:\w+="(?:\\"|[^"])*" +)*)/g)[0];
			sshparams_noenv = child.Host.match(/^(?:\w+="(?:\\"|[^"])*" +)*(.*)$/)[1];

			if (child.Profile && child.Profile.length > 0) {
				command += ' --tab-with-profile=' + (child.Profile).quote();
			}
			else 
			{
				command = ' --tab '; 
			}

			command += ' --title=' + (child.Name).quote();
			command += ' -e ' + ("sh -c " + (child.Protocol + " " + sshparams_noenv).quote()).quote();
		}
		
		if (child.Type == '__app__') {

			// Ignore "execute in a shell" when open all as tabs
			command += ' --tab --title=' + (child.Name).quote() + ' -e ';
			command += (child.Host).quote();
		}

		return [command, sshparams];
	},

	_readTree: function(node, parent, ident) {

		let child, menuItem, menuSep, menuSub, icon, 
			menuItemAll, iconAll, menuSepAll, menuItemTabs, iconTabs, ident_prec;
		let childHasItem = false, commandAll = new Array(), commandTab = new Array(), 
			sshparamsTab = new Array(), itemnr = 0;

		// For each child ... 
		for (let i = 0; i < node.length; i++) {
			child = node[i][0];
			let command;

			if (child.hasOwnProperty('Type')) {

				if (child.Type == '__item__') {

					menuItem = new PopupMenu.PopupMenuItem(ident+child.Name);
					icon = new St.Icon({icon_name: 'terminal',
							icon_type: St.IconType.FULLCOLOR,
							style_class: 'connmgr-icon' });
					menuItem.addActor(icon, { align: St.Align.END});

					if (this._terminator_as_terminal) {
						command = this._createCommandTerminator(child);
					} else {
						command = this._createCommand(child);
					}
					let [commandT, sshparamsT] = this._createCommandTab(child);
					menuItem.connect('activate', function() {
						Util.spawnCommandLine(command); 
					});
					parent.menu.addMenuItem(menuItem, i);
					
					childHasItem = true;
					if (this._menu_open_windows) { commandAll[itemnr] = command; }
					if (this._menu_open_tabs) { 
						commandTab[itemnr] = commandT; 
						sshparamsTab[itemnr] = sshparamsT; 
					}
					itemnr++;
					
					// Add ssh entry in search array
					this._sshList.push(
						[
							child.Type, 
							this._terminator_as_terminal, 
							child.Name+' - '+child.Host, 
							command
						]
					);
				}

				if (child.Type == '__app__') {

					menuItem = new PopupMenu.PopupMenuItem(ident+child.Name);
					icon = new St.Icon({icon_name: 'gtk-execute',
							icon_type: St.IconType.FULLCOLOR,
							style_class: 'connmgr-icon' });
					menuItem.addActor(icon, { align: St.Align.END});

					if (this._terminator_as_terminal) {
						command = this._createCommandTerminator(child);
					} else {
						command = this._createCommand(child);
					}
					let [commandT, sshparamsT] = this._createCommandTab(child);
					menuItem.connect('activate', function() {
						Util.spawnCommandLine(command); 
					});
					parent.menu.addMenuItem(menuItem, i);

					childHasItem = true;
					if (this._menu_open_windows) { commandAll[itemnr] = command; }
					if (this._menu_open_tabs) {
						commandTab[itemnr] = commandT;
						sshparamsTab[itemnr] = sshparamsT; 
					}
					itemnr++;
					
					// Add ssh entry in search array
					this._sshList.push(
						[
							child.Type, 
							this._terminator_as_terminal, 
							child.Name+' - '+child.Host, 
							command
						]
					);
				}


				if (child.Type == '__sep__') {
					menuSep = new PopupMenu.PopupSeparatorMenuItem();
					parent.menu.addMenuItem(menuSep, i);
				}
				if (child.Type == '__folder__') {

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
		
		let position = 0;
		if (childHasItem) {
		
			if (this._menu_open_windows) {
				menuItemAll = new PopupMenu.PopupMenuItem(ident+"Open all windows");
				iconAll = new St.Icon({icon_name: 'fileopen',
								icon_type: St.IconType.FULLCOLOR,
								style_class: 'connmgr-icon' });
				menuItemAll.addActor(iconAll, { align: St.Align.END});
				parent.menu.addMenuItem(menuItemAll, position);
				position += 1;
				menuItemAll.connect('activate', function() { 
					for (let c = 0; c < commandAll.length; c++) {
						Util.spawnCommandLine(commandAll[c]);
					}
				});
			}

			if ( (this._menu_open_tabs) && (!this._terminator_as_terminal) ) {
				menuItemTabs = new PopupMenu.PopupMenuItem(ident+"Open all as tabs");
				iconTabs = new St.Icon({icon_name: 'fileopen',
								icon_type: St.IconType.FULLCOLOR,
								style_class: 'connmgr-icon' });
				menuItemTabs.addActor(iconTabs, { align: St.Align.END});
				parent.menu.addMenuItem(menuItemTabs, position);
				position += 1;
				menuItemTabs.connect('activate', function() { 
					// Generate command to open all commandTab items in a single tabbed gnome-terminal
					let mycommand='';

					for (let c = 0; c < commandTab.length; c++) {
						mycommand += commandTab[c]+' ';
					}

					Util.spawnCommandLine(' sh -c '+(sshparamsTab[0]+' '+GNOME_TERMINAL_APP+' '+mycommand).quote()+' &');
				});
			}

			menuSepAll = new PopupMenu.PopupSeparatorMenuItem();
			parent.menu.addMenuItem(menuSepAll, position);

		}
		ident = ident_prec;
	},

	enable: function() {
		let _children = Main.panel._rightBox.get_children();
		Main.panel._rightBox.insert_actor(this.actor, _children.length - 2);
		Main.panel._menus.addMenu(this.menu);

		let file = Gio.file_new_for_path(this._configFile);
		this.monitor = file.monitor(Gio.FileMonitorFlags.NONE, null);
		this.monitor.connect('changed', Lang.bind(this, this._readConf));

	},
	
	disable: function() {
		Main.panel._menus.removeMenu(this.menu);
		Main.panel._rightBox.remove_actor(this.actor);
		
		Main.overview.removeSearchProvider(this._searchProvider);
		this._searchProvider = null;
		
		this.monitor.cancel();
	},

};


function init(metadata) {
	return new ConnectionManager(metadata);
}

