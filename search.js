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

const Shell = imports.gi.Shell;
const Util = imports.misc.util;
const Lang = imports.lang;

// SSH / Apps Search Provider
const SshSearchProvider = new Lang.Class({
    Name: 'SshSearchProvider',

    _init: function(title) {
        this.title = title;
        this.sshNames = [];
    },

    // Update list of SSH/Apps on configuration changes
    _update: function (sshNames) {
        this.sshNames = sshNames;
    },

    getInitialResultSet: function(terms) {
        let searching = [];

        for (var i=0; i<this.sshNames.length; i++) {
            for (var j=0; j<terms.length; j++) {
                let pattern = new RegExp(terms[j],"gi");
                if (this.sshNames[i][2].match(pattern)) {
                    searching.push ({
                            'type': this.sshNames[i][0],
                            'terminal': this.sshNames[i][1],
                            'name': this.sshNames[i][2],
                            'command': this.sshNames[i][3]
                    });
        }
            }
        }

        this.searchSystem.pushResults(this, searching);
    },

    getSubsearchResultSet: function(previousResults, terms) {
        this.getInitialResultSet(terms);
    },

    getResultMetas: function(resultIds, callback) {
        let metas = [];

        for (let i=0; i<resultIds.length; i++) {
        let appSys = Shell.AppSystem.get_default();
        let app = appSys.lookup_app('gnome-session-properties.desktop');
        
            switch (resultIds[i].type) {
        case '__app__':
            app = appSys.lookup_app('gnome-session-properties.desktop');
            break;
        case '__item__':
                app = appSys.lookup_app(resultIds[i].terminal + '.desktop');
            break;
        }

            metas.push( {
                'id': resultIds[i].command,
                'name': resultIds[i].name,
                'createIcon': function(size) { 
                                let icon = null; 
                                if (app) icon = app.create_icon_texture(size); 
                                return icon;
                              }
                        });
        }

        callback(metas);

    },

    activateResult: function(command) {
        Util.spawnCommandLine(command);
    },

    createResultActor: function (resultMeta, terms) {
        return null;
    }

});


