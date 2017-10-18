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

// Supported terminals. This terminal list must match as in connmgr.py
const TERMINALS = new Array(
    "gnome-terminal", "terminator", "guake", "tmux",
    "urxvt", "urxvt256c", "lilyterm", "mate-terminal", "xfce4-terminal", "terminix");


// ******************************************************
// Base Command Class
// ******************************************************
function TerminalCommand(terminal) {

    switch (terminal) {
        case 0:
            this.resClass = new GnomeTerminalCommand(terminal);
            break;
        case 1:
            this.resClass = new TerminatorCommand(terminal);
            break;
        case 2:
            this.resClass = new GuakeCommand(terminal);
            break;
        case 3:
            this.resClass = new TMuxCommand(terminal);
            break;
        case 4:
            this.resClass = new URXVTCommand(terminal);
            break;
        case 5:
            this.resClass = new URXVT256cCommand(terminal);
            break;
        case 6:
            this.resClass = new LilyTermCommand(terminal);
            break;
        case 7:
            this.resClass = new TerminixCommand(terminal);
            break;
        default:
            this.resClass = new GnomeTerminalCommand(terminal);
            break;
    }

    return this._init(terminal);
}

TerminalCommand.prototype = {

    _init: function(terminal) {

        this.resClass = this.resClass || null;
        this.terminal = terminal;
        this.cmdTerm = TERMINALS[terminal];
        this.child = null;

        this.resetEnv();
        return this.resClass;
    },

    // Reset all variable
    resetEnv: function() {
        this.command = '';
        this.sshparams = '';
        this.sshparams_noenv = '';
    },

    // Get parameters from command line
    _setParams: function() {
            this.sshparams = this.child.Host.match(/^((?:\w+="(?:\\"|[^"])*" +)*)/g)[0];
            this.sshparams_noenv = this.child.Host.match(/^(?:\w+="(?:\\"|[^"])*" +)*(.*)$/)[1];
    },

    // Set a new child
    setChild: function (child) {
        this.child = child;
    },

    get_terminal: function () {
        return this.cmdTerm;
    },

    supportWindows: function () {
        if (!this.createCmd()) return false; else return true;
    },
    supportTabs: function () {
        if (!this.createTabCmd()[0]) return false; else return true;
    },


    // Overload these methods for any new terminal

    createCmd: function () {
        return false;
    },
    createTabCmd: function () {
        return [false, false];
    },

}


// ******************************************************
// Gnome Terminal class derived from base class
// ******************************************************
function GnomeTerminalCommand(terminal) {
    this._init(terminal);
}

GnomeTerminalCommand.prototype = {
    __proto__: TerminalCommand.prototype,

    createCmd: function () {

        if (this.child.Type == '__item__') {
            this._setParams();

            this.command += this.cmdTerm;

            if (this.sshparams && this.sshparams.length > 0) {
                this.command = this.sshparams + ' ' + this.command + ' --disable-factory';
            }

            if (this.child.Profile && this.child.Profile.length > 0) {
                this.command += ' --window-with-profile=' + JSON.stringify(this.child.Profile);
            }

            this.command += ' --title=' + JSON.stringify(this.child.Name);
            this.command += ' -e ' + JSON.stringify("sh -c " + JSON.stringify(this.child.Protocol + " " + this.sshparams_noenv));

            this.command = 'sh -c ' + JSON.stringify(this.command);

        }

        if (this.child.Type == '__app__') {

            if (this.child.Protocol == 'True') {
                this.command += this.cmdTerm + ' --title=' + JSON.stringify(this.child.Name) + ' -e ';
                this.command += JSON.stringify(this.child.Host);
            } else {
                this.command += this.child.Host;
            }
        }

        return this.command;
    },

    createTabCmd: function () {

        if (this.child.Type == '__item__') {
            this._setParams();

            this.command += ' ';

            if (this.child.Profile && this.child.Profile.length > 0) {
                this.command += ' --tab-with-profile=' + JSON.stringify(this.child.Profile);
            }
            else
            {
                this.command = ' --tab ';
            }

            this.command += ' --title=' + JSON.stringify(this.child.Name);
            this.command += ' -e ' + JSON.stringify("sh -c " + JSON.stringify(this.child.Protocol + " " + this.sshparams_noenv));
        }

        if (this.child.Type == '__app__') {

            // Ignore "execute in a shell" when open all as tabs
            this.command += ' --tab --title=' + JSON.stringify(this.child.Name) + ' -e ';
            this.command += JSON.stringify(this.child.Host);
        }

        return [this.command, this.sshparams];
    }

}

// ******************************************************
// Terminator class derived from base class
// ******************************************************
function TerminatorCommand(terminal) {
    this._init(terminal);
}

TerminatorCommand.prototype = {
    __proto__: TerminalCommand.prototype,

    createCmd: function () {

        if (this.child.Type == '__item__') {
            this._setParams();

            this.command += this.cmdTerm;

            if (this.sshparams && this.sshparams.length > 0) {
                this.command = this.sshparams + ' ' + this.command;
            }

            if (this.child.Profile && this.child.Profile.length > 0) {
                this.command += ' --profile=' + JSON.stringify(this.child.Profile);
            }

            this.command += ' --title=' + JSON.stringify(this.child.Name);
            this.command += ' -e ' + JSON.stringify("sh -c " + JSON.stringify(this.child.Protocol + " " + this.sshparams_noenv));

            this.command = 'sh -c ' + JSON.stringify(this.command);

        }

        if (this.child.Type == '__app__') {

            if (this.child.Protocol == 'True') {
                this.command += this.cmdTerm + ' --title=' + JSON.stringify(this.child.Name) + ' -e ';
                this.command += JSON.stringify(this.child.Host);
            } else {
                this.command += this.child.Host;
            }
        }

        return this.command;
    }
}

// ******************************************************
// Guake class derived from base class
// ******************************************************
function GuakeCommand(terminal) {
    this._init(terminal);
}

GuakeCommand.prototype = {
    __proto__: TerminalCommand.prototype,

    createCmd: function () {

        if (this.child.Type == '__item__') {
            this._setParams();

            this.command += this.cmdTerm;

            this.command += ' --new-tab=' + JSON.stringify(this.child.Name);
            this.command += ' --rename-current-tab=' + JSON.stringify(this.child.Name);
            this.command += ' -e ' + JSON.stringify(this.sshparams +" sh -c " + JSON.stringify(this.child.Protocol + " " + this.sshparams_noenv));

        }

        if (this.child.Type == '__app__') {

            if (this.child.Protocol == 'True') {
                this.command += this.cmdTerm + '  --rename-current-tab=' + JSON.stringify(this.child.Name)  + ' --new-tab=' + JSON.stringify(this.child.Name) + ' -e ';
                this.command += JSON.stringify(this.child.Host);
            } else {
                this.command += this.child.Host;
            }
        }

        return this.command;
    }

}

// ******************************************************
// TMux class derived from base class
// ******************************************************
function TMuxCommand(terminal) {
    this._init(terminal);
}

TMuxCommand.prototype = {
    __proto__: TerminalCommand.prototype,

    createCmd: function () {

        if (this.child.Type == '__item__') {
            this._setParams();

            this.command += this.cmdTerm;
            this.command += ' new-window -n ' + JSON.stringify(this.child.Name);
            this.command += ' ' + JSON.stringify(this.sshparams + this.child.Protocol + " " + this.sshparams_noenv);
        }

        if (this.child.Type == '__app__') {

            if (this.child.Protocol == 'True') {
                this.command += this.cmdTerm + ' new-window -n ' + JSON.stringify(this.child.Name);
                this.command += ' ' + JSON.stringify(this.child.Host);
            } else {
                this.command += this.child.Host;
            }
        }

        return this.command;
    }

}

// ******************************************************
// URXVT class derived from base class
// No tabs support from command line
// ******************************************************
function URXVTCommand(terminal) {
    this._init(terminal);
}

URXVTCommand.prototype = {
    __proto__: TerminalCommand.prototype,

    createCmd: function () {

        if (this.child.Type == '__item__') {
            this._setParams();

            this.command += this.cmdTerm;

            if (this.sshparams && this.sshparams.length > 0) {
                this.command = this.sshparams + ' ' + this.command;
            }

            this.command += ' -title ' + JSON.stringify(this.child.Name);
            this.command += ' -e ' + JSON.stringify("sh -c " + (this.child.Protocol + " " + this.sshparams_noenv));

            this.command = 'sh -c ' + JSON.stringify(this.command);

        }

        if (this.child.Type == '__app__') {

            if (this.child.Protocol == 'True') {
                this.command += this.cmdTerm + ' -title ' + JSON.stringify(this.child.Name) + ' -e ';
                this.command += JSON.stringify(this.child.Host);
            } else {
                this.command += this.child.Host;
            }
        }

        return this.command;
    }

}

// ******************************************************
// URXVT256c class derived from URXVTCommand class
// No tabs support from command line
// ******************************************************
function URXVT256cCommand(terminal) {
    this._init(terminal);
}

URXVT256cCommand.prototype = {
    __proto__: URXVTCommand.prototype

}


// ******************************************************
// LilyTerm class derived from base class
// ******************************************************
function LilyTermCommand(terminal) {
    this._init(terminal);
}

LilyTermCommand.prototype = {
    __proto__: TerminalCommand.prototype,

    createCmd: function () {

        if (this.child.Type == '__item__') {
            this._setParams();

            this.command += this.cmdTerm;

            if (this.sshparams && this.sshparams.length > 0) {
                this.command = this.sshparams + ' ' + this.command;
            }

            this.command += ' --title ' + JSON.stringify(this.child.Name);
            this.command += ' -s -e ' + JSON.stringify("sh -c " + (this.child.Protocol + " " + this.sshparams_noenv));

            this.command = 'sh -c ' + JSON.stringify(this.command);

        }

        if (this.child.Type == '__app__') {

            if (this.child.Protocol == 'True') {
                this.command += this.cmdTerm + ' --title ' + JSON.stringify(this.child.Name) + ' -s -e ';
                this.command += JSON.stringify(this.child.Host);
            } else {
                this.command += this.child.Host;
            }
        }

        return this.command;
    },

}


// ******************************************************
// TerminixTerm class derived from base class
// ******************************************************
function TerminixCommand(terminal) {
    this._init(terminal);
}

TerminixCommand.prototype = {
    __proto__: TerminalCommand.prototype,

    createCmd: function () {

        if (this.child.Type == '__item__') {
            this._setParams();

            this.command += this.cmdTerm;

            if (this.sshparams && this.sshparams.length > 0) {
                this.command = this.sshparams + ' ' + this.command;
            }

            this.command += ' --title ' + JSON.stringify(this.child.Name);
            this.command += ' -e ' + JSON.stringify(this.child.Protocol + " " + this.sshparams_noenv);

            this.command = 'sh -c ' + JSON.stringify(this.command);

        }

        if (this.child.Type == '__app__') {

            if (this.child.Protocol == 'True') {
                this.command += this.cmdTerm + ' --title ' + JSON.stringify(this.child.Name) + ' -e ';
                this.command += JSON.stringify(this.child.Host);
            } else {
                this.command += this.child.Host;
            }
        }

        return this.command;
    },

}
