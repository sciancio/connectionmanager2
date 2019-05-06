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

const Mainloop = imports.mainloop;
const Signals = imports.signals;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Panel = imports.ui.panel;
const Util = imports.misc.util;
const ByteArray = imports.byteArray;
const Me = imports.misc.extensionUtils.getCurrentExtension();

const Gettext = imports.gettext.domain('gnome-shell-extensions');
const _ = Gettext.gettext;

let extensionPath;

// Import Command Terminal Manager and Search class
const CM = imports.misc.extensionUtils.getCurrentExtension();
const Search = CM.imports.search;
const Terminals = CM.imports.terminals;


const ConnectionManager = new Lang.Class({
    Name: 'ConnectionManager',
    Extends: PanelMenu.Button,

    _init: function() {

        this.parent(1.0, "Connection Manager", false);

        this._box = new St.BoxLayout();
        
//        this._icon = new St.Icon({
//            style_class: 'system-status-icon'
//        });
//        this._icon.gicon = Gio.icon_new_for_string(Me.path + '/icons/' + DisabledIcon +'.svg');
        
        

        this._icon = new St.Icon({ gicon: Gio.icon_new_for_string(Me.path + '/emblem-cm-symbolic.svg'),
                                             icon_size: 15 });

        this._bin = new St.Bin({child: this._icon});

        this._box.add(this._bin);
        this.actor.add_actor(this._box);
        this.actor.add_style_class_name('panel-status-button');

        let CMPrefs = CM.metadata;

        this._configFile = GLib.build_filenamev([GLib.get_home_dir(), CMPrefs['sw_config']]);
        this._prefFile = GLib.build_filenamev([extensionPath, CMPrefs['sw_bin']]) + " " + extensionPath;

        // Search provider
        this._searchProvider = null;
        this._sshList = [];
        this._searchProvider = new Search.SshSearchProvider('CONNECTION MANAGER');

        if( typeof Main.overview.viewSelector === "object" &&
            typeof Main.overview.viewSelector._searchResults === "object") {
            if(typeof Main.overview.viewSelector._searchResults._registerProvider === "function") { //3.14
                Main.overview.viewSelector._searchResults._registerProvider(this._searchProvider);
            } else if(typeof Main.overview.viewSelector._searchResults._searchSystem === "object" &&
                      typeof Main.overview.viewSelector._searchResults._searchSystem.addProvider === "function") { //3.12
                Main.overview.viewSelector._searchResults._searchSystem.addProvider(this._searchProvider);
            }
        }

        this._readConf();
    },


    _readConf: function () {

        this.menu.removeAll();

        // Rewrite _setOpenedSubMenu method to correctly open submenu
        this.menu._setOpenedSubMenu = Lang.bind(this, function (submenu) {
            this._openedSubMenu = submenu;
        });
        
        this._sshList = [];

        if (GLib.file_test(this._configFile, GLib.FileTest.EXISTS) ) {

            let filedata = GLib.file_get_contents(this._configFile);
            let jsondata = JSON.parse(ByteArray.toString(filedata[1]));
            let root = jsondata['Root'];

            // Global Settings
            if (typeof(jsondata.Global) == 'undefined') {
                jsondata.Global = '';
            };

            this._menu_open_tabs = !(/^false$/i.test(jsondata.Global.menu_open_tabs));
            this._menu_open_windows = !(/^false$/i.test(jsondata.Global.menu_open_windows));
            this._terminal = jsondata.Global.terminal;

            // TerminalCommand class
            if (this.TermCmd) {delete this.TermCmd; }
            this.TermCmd = new Terminals.TerminalCommand(this._terminal);

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
                Util.trySpawnCommandLine('python2 ' + this._prefFile);
            } catch (e) {
                Util.trySpawnCommandLine('python ' + this._prefFile);
            }
        }));
        this.menu.addMenuItem(menuPref, this.menu.length+1);

        // Update ssh name list
        this._searchProvider._update(this._sshList);        
    },


    _readTree: function(node, parent, ident) {

        let child, menuItem, menuSep, menuSub, icon, label,
            menuItemAll, iconAll, menuSepAll, menuItemTabs, iconTabs, ident_prec;
        let childHasItem = false, commandAll = new Array(), commandTab = new Array(), 
            sshparamsTab = new Array(), itemnr = 0;

        // For each child ... 
        for (let i = 0; i < node.length; i++) {
            child = node[i][0];
            let command;
            
            if (child.hasOwnProperty('Type')) {

                // Simple Item
                if (child.Type == '__item__') {

                    menuItem = new PopupMenu.PopupBaseMenuItem();
                    
                    icon = new St.Icon({icon_name: 'terminal',
                            style_class: 'connmgr-icon' });
                    menuItem.actor.add_child(icon);
                    
                    label = new St.Label({ text: ident+child.Name });
                    menuItem.actor.add_child(label);

                    // For each command ...
                    this.TermCmd.resetEnv();
                    this.TermCmd.setChild(child);
                    command = this.TermCmd.createCmd();
                    this.TermCmd.resetEnv();
                    let [commandT, sshparamsT] = this.TermCmd.createTabCmd();

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
                        {
                            'type': child.Type,
                            'terminal': this.TermCmd.get_terminal(),
                            'name': child.Name+' - '+child.Host,
                            'command': command
                        }
                    );
                }

                // Application Item
                if (child.Type == '__app__') {

                    menuItem = new PopupMenu.PopupBaseMenuItem();
                    icon = new St.Icon({icon_name: 'gtk-execute',
                            style_class: 'connmgr-icon' });
                    menuItem.actor.add_child(icon);

                    label = new St.Label({ text: ident+child.Name });
                    menuItem.actor.add_child(label);

                    // For each command ...
                    this.TermCmd.resetEnv();
                    this.TermCmd.setChild(child);
                    command = this.TermCmd.createCmd();
                    this.TermCmd.resetEnv();
                    let [commandT, sshparamsT] = this.TermCmd.createTabCmd();

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
                        {
                            'type': child.Type,
                            'terminal': this.TermCmd.get_terminal(),
                            'name': child.Name+' - '+child.Host,
                            'command': command
                        }

                    );
                }

                // Separator
                if (child.Type == '__sep__') {
                    parent.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem(), i);
                }
                
                // Folder
                if (child.Type == '__folder__') {

                    menuSub = new PopupMenu.PopupSubMenuMenuItem(ident+child.Name);
                    parent.menu.addMenuItem(menuSub);
                    
                    ident_prec = ident;
                    this._readTree(child.Children, menuSub, ident+"  ");

                }
            }
        }

        let position = 0;
        if (childHasItem) {

            if (( this._menu_open_windows) && (this.TermCmd.supportWindows()) ){
                menuItemAll = new PopupMenu.PopupBaseMenuItem();
                iconAll = new St.Icon({icon_name: 'fileopen',
                                style_class: 'connmgr-icon' });
                menuItemAll.actor.add_child(iconAll);

                label = new St.Label({ text: ident+"Open all windows" });
                menuItemAll.actor.add_child(label);
                
                parent.menu.addMenuItem(menuItemAll, position);
                position += 1;
                menuItemAll.connect('activate', function() { 
                    for (let c = 0; c < commandAll.length; c++) {
                        Util.spawnCommandLine(commandAll[c]);
                    }
                });
            }

            if ( (this._menu_open_tabs) && (this.TermCmd.supportTabs()) ) {
                menuItemTabs = new PopupMenu.PopupBaseMenuItem();
                iconTabs = new St.Icon({icon_name: 'fileopen',
                                style_class: 'connmgr-icon' });
                menuItemTabs.actor.add_child(iconTabs);

                label = new St.Label({ text: ident+"Open all as tabs" });
                menuItemTabs.actor.add_child(label);

                parent.menu.addMenuItem(menuItemTabs, position);
                position += 1;

                let term = this.TermCmd.get_terminal();

                menuItemTabs.connect('activate', function() { 
                    // Generate command to open all commandTab items in a single tabbed gnome-terminal
                    let mycommand='';

                    for (let c = 0; c < commandTab.length; c++) {
                        mycommand += commandTab[c]+' ';
                    }

                    Util.spawnCommandLine(' sh -c '+JSON.stringify(sshparamsTab[0]+' '+term+' '+mycommand)+' &');
                });
            }

            menuSepAll = new PopupMenu.PopupSeparatorMenuItem();
            parent.menu.addMenuItem(menuSepAll, position);

        }
        ident = ident_prec;
    },

});


let cm;

function enable() {
    cm = new ConnectionManager();
    
    let _children_length = Main.panel._rightBox.get_n_children();
    Main.panel.addToStatusArea("connectionmanager", cm, _children_length - 2, "right");
    
    let file = Gio.file_new_for_path(cm._configFile);
    cm.monitor = file.monitor(Gio.FileMonitorFlags.NONE, null);
    cm.monitor.connect('changed', Lang.bind(cm, cm._readConf));
}

function disable() {
    if(cm._searchProvider!=null) {
        Main.overview.removeSearchProvider(cm._searchProvider);
        cm._searchProvider = null;
    }

    cm.monitor.cancel();
    cm.destroy();
}

function init(extensionMeta) {
    extensionPath = extensionMeta.path;
    
    let theme = imports.gi.Gtk.IconTheme.get_default();
    theme.append_search_path(extensionPath);

}

