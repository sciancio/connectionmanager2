#!/usr/bin/env python
#
#   ConnectionManager 3 - Simple GUI app for Gnome 3 that provides a menu
#   for initiating SSH/Telnet/Custom Apps connections.
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
import gi

from gi.repository import GLib

# Set program name for gnome shell (before importing gtk, which seems to
# call set_prgname on its own)
if hasattr(GLib, "set_prgname"):
    GLib.set_prgname('Connection Manager')


gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, Gdk, Gio
from io import StringIO

import os.path
import shutil
import json

import itertools
import re
import sys

VERSION = '0.8.4'

supportedTerms = ["Gnome Terminal", "Terminator", "Guake", "TMux", "urxvt", "urxvt256c", "LilyTerm", "Mate Terminal", "XFCE Terminal", "Terminix"]
supportedTermsCmd = ["gnome-terminal", "terminator", "guake", "tmux", "urxvt", "urxvt256c", "lilyterm", "mate-terminal", "xfce4-terminal", "terminix"]
supportedTermsSite = ["http://library.gnome.org/users/gnome-terminal/stable/",
                      "http://www.tenshu.net/p/terminator.html",
                      "http://guake.org/",
                      "http://tmux.sourceforge.net/",
                      "http://software.schmorp.de/pkg/rxvt-unicode.html",
                      "http://software.schmorp.de/pkg/rxvt-unicode.html",
                      "http://lilyterm.luna.com.tw/index.html",
                      "http://www.mate-desktop.org",
                      "http://www.xfce.org/",
                      "https://github.com/gnunn1/terminix"
                      ]


# TreeStore object:
# Type, Name, Host, Profile, Protocol
treestore = Gtk.TreeStore(str, str, str, str, str)
Root = treestore.append(None, ['__folder__', 'Root', "", "", ""])

# Global settings
GlobalSettings = {}
GlobalSettings['menu_open_tabs'] = True
GlobalSettings['menu_open_windows'] = True
GlobalSettings['terminal'] = 0


# I/O class
class ConfIO(str):

    json_output = ""

    def __init__(self, conf_file):
        self.configuration_file = conf_file

    # Decode JSON configuration
    def custom_decode(self, dct, parent=Root):
        global GlobalSettings

        if 'Global' in dct:
            for setting in dct['Global']:

                if (type(dct['Global'][setting]) == bool):
                    GlobalSettings[setting] = (dct['Global'][setting] == True)

                if (type(dct['Global'][setting]) == int):
                    GlobalSettings[setting] = dct['Global'][setting]

        if 'Root' in dct:
            dct = dct['Root']

        for child in dct:
            child = child[0]

            if child['Type'] == '__item__' or \
                 child['Type'] == '__app__' or \
                 child['Type'] == '__sep__':
                treestore.append(parent, [child['Type'], child['Name'],
                            child['Host'], child['Profile'], child['Protocol']])

            if child['Type'] == '__folder__':
                parent_prec = parent
                parent = treestore.append(parent, ['__folder__',
                            child['Name'], "", "", ""])
                self.custom_decode(child['Children'], parent)
                parent = parent_prec

        return treestore

    def get_item(self, t, iter):
        return '[{"Type":'+json.dumps(t.get_value(iter, 0))+','+ \
        '"Name":'+json.dumps(t.get_value(iter, 1))+','+ \
        '"Host":'+json.dumps(t.get_value(iter, 2))+','+ \
        '"Profile":'+json.dumps(t.get_value(iter, 3))+','+ \
        '"Protocol":'+json.dumps(t.get_value(iter, 4))+','+ \
        '"Children":[]' \
        '}]'

    def get_folder(self, t, iter):
        return '"Type":'+json.dumps(t.get_value(iter, 0))+','+ \
        '"Name":'+json.dumps(t.get_value(iter, 1))+','+ \
        '"Host":'+json.dumps(t.get_value(iter, 2))+','+ \
        '"Profile":'+json.dumps(t.get_value(iter, 3))+','+ \
        '"Protocol":'+json.dumps(t.get_value(iter, 4))+','+ \
        '"Children":'

    def is_folder(self, treestore, iter):
        if treestore.get_value(iter, 0) == '__folder__':
            return True
        else:
            return False

    # Encode JSON configuration
    def custom_encode(self, t, iter):

        # If node has children
        if t.iter_has_child(iter):

            # Foreach child ...
            for index in range(0, t.iter_n_children(iter)):

                # Child pointer
                child = t.iter_nth_child(iter, index)
                if not self.is_folder(t, child):
                    # Item
                    self.json_output += self.get_item(t, child)
                    if index+1 != t.iter_n_children(iter):
                        self.json_output += ","
                else:
                    # Folder
                    self.json_output += "[{"+self.get_folder(t, child)+"["
                    self.custom_encode(t, child)
                    self.json_output += "]}]"
                    if index+1 != t.iter_n_children(iter):
                        self.json_output += ","

        return self.json_output

    # Read configuration
    def read(self):
        configuration = ""
        if (os.path.exists(self.configuration_file) and \
            os.path.isfile(self.configuration_file)):

            in_file = open(self.configuration_file, "r")

            configuration = self.custom_decode(json.load(in_file))
            in_file.close()

        else:
            print ("Configuration file not exists")
            configuration = self.custom_decode(json.loads('{"Root": []}'))

        return configuration

    # Write configuration
    def write(self, treestore1):
        global GlobalSettings

        self.json_output = ''
        self.custom_encode(treestore1, Root)
        self.json_output = '{"Root": ['+self.json_output+'], \
            "Global": { \
                "menu_open_tabs": '+ json.dumps((GlobalSettings['menu_open_tabs'])) + ', \
                "menu_open_windows": ' + json.dumps((GlobalSettings['menu_open_windows'])) + ', \
                "terminal": ' + json.dumps((GlobalSettings['terminal'])) + '} \
        }'

        out_file = open(self.configuration_file, "w")
        json.dump(json.loads(self.json_output), out_file, indent=2)
        out_file.close()


# Main class
class ConnectionManager(Gtk.Window):

    first_time_changes = True

    tv = Gtk.TreeView()
    bad_path = None
    terminal_site = Gtk.LinkButton(supportedTermsSite[0], "Visit Terminal Homepage ")

    def fixTree(self, model, path, iter, user_data):
        piter = model.iter_parent(iter)

        if piter:
            if (self.is_item(piter) or self.is_sep(piter)):
                self.bad_path = model.get_path(iter)

        elif (self.treestore.get_value(iter, 1) != 'Root'):  # Root
            self.bad_path = model.get_path(iter)

    # Check if a program exists
    def checkProgram(self, program):
        import os
        def is_exe(fpath):
            return os.path.isfile(fpath) and os.access(fpath, os.X_OK)

        fpath, fname = os.path.split(program)
        if fpath:
            if is_exe(program):
                return program
        else:
            for path in os.environ["PATH"].split(os.pathsep):
                exe_file = os.path.join(path, program)
                if is_exe(exe_file):
                    return True

        return False


    def checkValidity(self):
        model, iter = self.tv.get_selection().get_selected()

        self.conf_modified()

        self.bad_path = None
        treestore.foreach(self.fixTree, '')

        if self.bad_path:
            dialog = Gtk.MessageDialog(self, 0, Gtk.MessageType.ERROR,
                Gtk.ButtonsType.OK, "Configuration Error! ")
            dialog.format_secondary_text("The destination is not a folder. \
This involves loss of information, it is recommended to revert it.")
            dialog.show_all()
            response = dialog.run()
            if response == Gtk.ResponseType.OK:
                dialog.destroy()
                return False

    def drag_drop_cb(self, treeview, dragcontext, x, y, time):
        GLib.timeout_add(50, self.checkValidity)

    ## ------------------------------------------------------

    def __init__(self):
        global GlobalSettings

        Gtk.Window.__init__(self, title="ConnectionManager 3 - Preferences")

        # Icon
        try:
            self.set_icon_from_file(sys.argv[1] + "/emblem-cm-symbolic.svg")
        except:
            try:
                self.set_icon_from_file("emblem-cm-symbolic.svg")
            except:
                pass

        self.set_default_size(450, 400)
        self.connect("delete-event", self.on_click_me_close)

        # ---------------------------------------------
        # Define input
        self.treestore = Gtk.TreeStore(str, str, str, str)
        # ---------------------------------------------

        self.conf_file = os.getenv("HOME") + "/.connmgr"
        self.configuration = ConfIO(self.conf_file)

        # Read Configuration
        self.treestore = self.configuration.read()

        # ---------------------------------------------

        # TreeView
        self.tv.set_model(self.treestore)
        self.tv.set_reorderable(True)
        # self.tv.expand_all()
        self.tv.set_level_indentation(5)
        self.tv.set_show_expanders(True)

        # Signal on TreeView
        self.tv.connect("button_press_event", self.treeview_clicked)
        self.tv.connect("drag_drop", self.drag_drop_cb)

        renderer = [0, 1, 2, 3]
        column = [0, 1, 2, 3]
        title = ["Title"]

        # Design field
        for index, item in enumerate(title):
            renderer[index+1] = Gtk.CellRendererText()
            column[index+1] = Gtk.TreeViewColumn(item, renderer[index+1], text=index+1)
            self.tv.append_column(column[index+1])

        # Buttons
        button1 = Gtk.Button("Add Host")
        button1.connect("clicked", self.on_click_me_addhost)
        button2 = Gtk.Button("Add App")
        button2.connect("clicked", self.on_click_me_addapp)
        button3 = Gtk.Button("Add Separator")
        button3.connect("clicked", self.on_click_me_addsep)
        button4 = Gtk.Button("Add SubMenu")
        button4.connect("clicked", self.on_click_me_addmenu)
        button5 = Gtk.Button("Remove")
        button5.connect("clicked", self.on_click_me_remove)
        button6 = Gtk.Button("Clone it")
        button6.connect("clicked", self.on_click_me_cloneit)
        button7 = Gtk.Button("Import SSHConf")
        button7.connect("clicked", self.on_click_me_importsshconf)

        button8 = Gtk.Button("Close")
        button8.connect("clicked", self.on_click_me_close)

        # Specific Buttons
        SpecButtons = Gtk.VButtonBox(spacing=6)
        SpecButtons.set_layout(3)
        SpecButtons.add(button1)
        SpecButtons.add(button2)
        SpecButtons.add(button3)
        SpecButtons.add(button4)
        SpecButtons.add(button5)
        SpecButtons.add(button6)
        SpecButtons.add(button7)

        ExtButtons = Gtk.HButtonBox(margin_right=15, margin_bottom=3, margin_top=3)
        ExtButtons.set_layout(4)
        ExtButtons.add(button8)
        # ButtonBox

        # UI design
        scrolled_window = Gtk.ScrolledWindow(hadjustment=None, vadjustment=None)
        scrolled_window.add_with_viewport(self.tv)

        mybox = Gtk.HBox()
        mybox.pack_start(scrolled_window, True, True, 6)
        mybox.pack_start(SpecButtons, False, False, 6)

        # Options Label
        labelOpt = Gtk.Label('<span size="15000">Please, choose your configuration</span>')
        labelOpt.set_justify(2)
        labelOpt.set_use_markup(True)
        checkOpt1 = Gtk.CheckButton('Include "Open all windows" selection')
        checkOpt1.set_active(GlobalSettings['menu_open_windows'])
        checkOpt1.connect("toggled", self.on_check_option_toggled, "menu_open_windows")
        checkOpt2 = Gtk.CheckButton('Include "Open all as tabs" selection')
        checkOpt2.set_active(GlobalSettings['menu_open_tabs'])
        checkOpt2.connect("toggled", self.on_check_option_toggled, "menu_open_tabs")

        # Label/Combo of supported terminals
        labelTerm = Gtk.Label('Choose your preferred terminal (first check its installation)', halign="start", margin_left=10)
        labelTerm.set_justify(3)

        objectsList = Gtk.TreeStore(str, bool)
        bExistsTerminal = False
        for index, terminal in enumerate(supportedTerms):
            # Check if terminal exists
            bExistsTerminal = self.checkProgram(supportedTermsCmd[index])
            objectsList.append(None, [terminal, bExistsTerminal])
        terms_combo = Gtk.ComboBox.new_with_model(objectsList)
        terms_combo.set_wrap_width(1)
        terms_combo.set_halign(Gtk.Align.START)
        terms_combo.set_margin_left(10)

        renderer_text = Gtk.CellRendererText()
        terms_combo.pack_start(renderer_text, True)
        terms_combo.add_attribute(renderer_text, "text", 0)
        terms_combo.add_attribute(renderer_text, 'sensitive', 1)
        terms_combo.set_active(GlobalSettings['terminal'])
        terms_combo.connect("changed", self.on_combo_option_toggled, "terminal")

        self.terminal_site.set_uri(supportedTermsSite[GlobalSettings['terminal']])

        options = Gtk.VBox(False, spacing=2)
        options.pack_start(labelOpt, False, False, 10)
        options.pack_start(checkOpt1, False, False, 0)
        options.pack_start(checkOpt2, False, False, 0)
        options.pack_start(labelTerm, False, False, 10)
        options.pack_start(terms_combo, False, False, 0)
        options.pack_end(self.terminal_site, False, False, 10)
        

        # About Label
        about = Gtk.VBox(False, spacing=2)
        label_about = Gtk.Label('<span size="30000">ConnectionManager 3</span>\n<span>Version: '+VERSION+'\n\nSimple GUI app for Gnome 3 that provides\n a menu for initiating SSH/Telnet/Custom Apps connections.\n\nCopyright 2012-2014 Stefano Ciancio</span>')
        label_about.set_justify(2)
        label_about.set_use_markup(True)
        button_about = Gtk.LinkButton("https://github.com/sciancio/connectionmanager2", "Visit GitHub Project Homepage")
        about.pack_start(label_about, False, False, 10)
        about.pack_start(button_about, False, False, 10)

        # Notebook
        notebook = Gtk.Notebook()
        notebook.set_tab_pos(2)
        notebook.set_scrollable(True)

        notebook.append_page(mybox, Gtk.Label("Hosts"))
        notebook.append_page(options, Gtk.Label("Options"))
        notebook.append_page(about, Gtk.Label("About"))
        notebook.set_current_page(0)

        # External Box
        ExtBox = Gtk.VBox()
        ExtBox.pack_start(notebook, True, True, 0)
        ExtBox.pack_end(ExtButtons, False, False, 0)

        self.add(ExtBox)

    def conf_modified(self):

        if self.first_time_changes:

            # Make a copy backup before write
            if os.path.exists(self.conf_file) and \
                    os.path.isfile(self.conf_file):
                shutil.copy(self.conf_file, self.conf_file+'.bak')

            self.first_time_changes = False

        # Save configuratione every time
        self.configuration.write(self.treestore)

    # Add Element (item, separator, folder)
    def __addElement(self, newrow):
        model, current_iter = self.tv.get_selection().get_selected()
        if current_iter:

            if self.is_folder(current_iter):

                if newrow[0] == '__folder__' or newrow[0] == '__item__' or newrow[0] == '__app__':
                    response, row = self.item_dialog(newrow)
                    if response:
                        new_iter = self.treestore.insert_after(current_iter, None, row)
                        self.conf_modified()
                if newrow[0] == '__sep__':
                        new_iter = self.treestore.insert_after(current_iter, None, newrow)
                        self.conf_modified()

            if self.is_item(current_iter) or self.is_app(current_iter) or self.is_sep(current_iter):
                if newrow[0] == '__folder__' or newrow[0] == '__item__' or newrow[0] == '__app__':
                    response, row = self.item_dialog(newrow)
                    if response:
                        new_iter = self.treestore.insert_after(None, current_iter, row)
                        self.conf_modified()
                if newrow[0] == '__sep__':
                    new_iter = self.treestore.insert_after(None, current_iter, newrow)
                    self.conf_modified()

        else:
            dialog = Gtk.MessageDialog(self, 0, Gtk.MessageType.ERROR,
                    Gtk.ButtonsType.OK, "Please, select an element")
            dialog.show_all()
            response = dialog.run()
            if response == Gtk.ResponseType.OK:
                dialog.destroy()
                return True

    # Options
    def on_check_option_toggled(self, button, name):
        global GlobalSettings
        GlobalSettings[name] = button.get_active()
        self.conf_modified()

    def on_combo_option_toggled(self, combo, name):
        global GlobalSettings
        GlobalSettings[name] = combo.get_active()
        
        self.terminal_site.set_uri(supportedTermsSite[GlobalSettings['terminal']])
        self.conf_modified()

    # Add Host
    def on_click_me_addhost(self, button):
        newrow = ['__item__', 'New Host ...', '-AX ...', 'Unnamed', 'ssh']
        self.__addElement(newrow)

    # Add App
    def on_click_me_addapp(self, button):
        newrow = ['__app__', 'New App ...', '', '', '']
        self.__addElement(newrow)

    # Add Separator
    def on_click_me_addsep(self, button):
        newrow = ['__sep__', '_____________________', '', '', '']
        self.__addElement(newrow)

    # Add SubMenu
    def on_click_me_addmenu(self, button):
        newrow = ['__folder__', 'New Folder ...', '', '', '']
        self.__addElement(newrow)

    # Remove element (item or folder)
    def on_click_me_remove(self, button):
        model, current_iter = self.tv.get_selection().get_selected()

        if current_iter:
            if model.iter_parent(current_iter) == None:
                return

            if self.is_folder(current_iter):
                dialog = Gtk.MessageDialog(self, 0, Gtk.MessageType.WARNING,
                Gtk.ButtonsType.YES_NO, "Are you sure remove folder?")

                response = dialog.run()
                if response == Gtk.ResponseType.YES:
                    self.treestore.remove(current_iter)
                    self.conf_modified()

                dialog.destroy()

            else:
                self.treestore.remove(current_iter)
                self.conf_modified()

        else:
            dialog = Gtk.MessageDialog(self, 0, Gtk.MessageType.ERROR,
                    Gtk.ButtonsType.OK, "Please, select an element")
            dialog.show_all()
            response = dialog.run()
            if response == Gtk.ResponseType.OK:
                dialog.destroy()
                return True

    # Clone it - clone only Host / App
    def on_click_me_cloneit(self, button):
        model, current_iter = self.tv.get_selection().get_selected()

        if current_iter and (self.is_item(current_iter) or self.is_app(current_iter)):

            clonedRow = []
            for index in range(0, self.treestore.get_n_columns()):
                clonedRow.append(self.treestore.get_value(current_iter, index))
            self.__addElement(clonedRow)

        else:
            dialog = Gtk.MessageDialog(self, 0, Gtk.MessageType.ERROR,
                    Gtk.ButtonsType.OK, "Please, select an Host/App")
            dialog.show_all()
            response = dialog.run()
            if response == Gtk.ResponseType.OK:
                dialog.destroy()
                return True

    # Close
    def on_click_me_close(self, button, event=None):
        Gtk.main_quit()

    def on_click_me_importsshconf(self, button):
        imported_from_SSH_config_folder = '__Imported_from_SSH_config__'
        model, current_iter = self.tv.get_selection().get_selected()

        # Check if import folder already exists
        if model.iter_has_child(Root):
            iter = model.iter_children(Root)

            import_found = False
            import_iter = ''
            while (iter):
                if (model.get_value(iter, 0) == '__folder__' and
                        model.get_value(iter, 1) == imported_from_SSH_config_folder):
                    import_found = True
                    import_iter = iter

                iter = model.iter_next(iter)
                
        else:
            import_found = False

        if (import_found):

            # User dialog
            dialog = Gtk.MessageDialog(self, 0, Gtk.MessageType.ERROR,
                    Gtk.ButtonsType.YES_NO, "Imported folder content will be overwritten \nfrom a new ssh config import.\n\nConfirm?")
            dialog.show_all()
            response = dialog.run()
            if response == Gtk.ResponseType.YES:
                dialog.destroy()

            if response == Gtk.ResponseType.NO:
                dialog.destroy()
                return True

            # Remove imported folder
            self.treestore.remove(import_iter)

            # Read and import ssh config
            self.import_ssh_config(imported_from_SSH_config_folder)
            self.conf_modified()

        else:
            # Read and import ssh config
            self.import_ssh_config(imported_from_SSH_config_folder)
            self.conf_modified()

    def import_ssh_config(self, imported_from_SSH_config_folder):

        SSH_CONFIG_FILE = os.getenv("HOME") + '/.ssh/config'

        def get_value(line, key_arg):
            m = re.search(r'^\s*%s\s+(.+)\s*$' % key_arg, line, re.I)
            if m:
                return m.group(1)
            else:
                return ''

        def remove_comment(line):
            return re.sub(r'#.*$', '', line)

        def not_a_host(line):
            return get_value(line, 'Host') == ''

        def a_host(line):
            return get_value(line, 'Host') != ''

        import_iter = treestore.append(Root, ['__folder__',
                    imported_from_SSH_config_folder, "", "", ""])

        lines = [line.strip() for line in file(SSH_CONFIG_FILE)]
        comments_removed = [remove_comment(line) for line in lines]
        blanks_removed = [line for line in comments_removed if line]
        non_hosts_removed = [line for line in blanks_removed if a_host(line)]

        for line in non_hosts_removed:
            importedHosts = line.split(None)[1:]
            for importedHost in importedHosts:
                if importedHost != '*':
                    treestore.append(import_iter, ['__item__',
                        importedHost, importedHost, 'Unnamed', 'ssh'])

    def is_folder(self, iter):
        if self.treestore.get_value(iter, 0) == '__folder__':
            return True
        else:
            return False

    def is_item(self, iter):
        if self.treestore.get_value(iter, 0) == '__item__':
            return True
        else:
            return False

    def is_app(self, iter):
        if self.treestore.get_value(iter, 0) == '__app__':
            return True
        else:
            return False

    def is_sep(self, iter):
        if self.treestore.get_value(iter, 0) == '__sep__':
            return True
        else:
            return False

    def item_dialog(self, row):

        model, current_iter = self.tv.get_selection().get_selected()

        dialog = Gtk.Dialog("Connection Details", self, 0,
        (Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
        Gtk.STOCK_OK, Gtk.ResponseType.OK))

        dialog.set_default_size(150, 100)
        dialog.set_modal(True)

        box = dialog.get_content_area()
        box.set_border_width(8)

        label1 = Gtk.Label("Title")
        entry1 = Gtk.Entry()
        entry1.set_text(row[1])

        label2 = Gtk.Label("Host")
        entry2 = Gtk.Entry()
        entry2.set_text(row[2])

        # Profile Combo ----------------------------
        label3 = Gtk.Label("Profile")
        
        entry3 = Gtk.ComboBoxText()
        
        if "org.gnome.Terminal.ProfilesList" in Gio.Settings.list_schemas():
            profilesList = Gio.Settings.new("org.gnome.Terminal.ProfilesList").get_value("list")

            Gio.Settings.new("org.gnome.Terminal.ProfilesList").get_value("list")

            for index, item in enumerate(profilesList):
                profile = Gio.Settings.new_with_path("org.gnome.Terminal.Legacy.Profile",
                                                     "/org/gnome/terminal/legacy/profiles:/:"+item+"/")
                profileName = profile.get_string("visible-name")

                entry3.append_text(profileName)
                if profileName == row[3]:
                    entry3.set_active(index)

        else:
            entry3.append_text("Profiles Not Available")

        entry3.set_entry_text_column(0)
        # ----------------------------

        label4 = Gtk.Label("Protocol")
        entry4 = Gtk.ComboBoxText()
        protocol = ['ssh', 'telnet', 'mosh']
        for index, item in enumerate(protocol):
            entry4.append_text(item)
            if item == row[4]:
                entry4.set_active(index)

        entry4.set_entry_text_column(0)

        label5 = Gtk.Label("Command")
        entry5 = Gtk.Entry()
        entry5.set_text(row[2])
        button5 = Gtk.Button("Choose File")
        button5.connect("clicked", self.on_choose_file, entry5)

        check7 = Gtk.CheckButton("Execute in shell")
        if row[4] == 'True':
            check7.set_active(True)

        if row[0] == '__folder__':
            table = Gtk.Table(1, 2, True,
            margin_right=15, margin_bottom=15, margin_top=15)
            table.attach(label1, 0, 1, 0, 1)
            table.attach(entry1, 1, 2, 0, 1)

        if row[0] == '__item__':
            table = Gtk.Table(4, 2, True,
                margin_right=15, margin_bottom=15,
                margin_top=15)
            table.set_row_spacings(6)
            table.set_col_spacings(6)

            table.attach(label1, 0, 1, 0, 1)
            table.attach(entry1, 1, 2, 0, 1)

            table.attach(label2, 0, 1, 1, 2)
            table.attach(entry2, 1, 2, 1, 2)

            table.attach(label3, 0, 1, 2, 3)
            table.attach(entry3, 1, 2, 2, 3)
            table.attach(label4, 0, 1, 3, 4)
            table.attach(entry4, 1, 2, 3, 4)

        if row[0] == '__app__':
            table = Gtk.Table(4, 2, True,
                margin_right=15, margin_bottom=15,
                margin_top=15)
            table.set_row_spacings(6)
            table.set_col_spacings(6)

            table.attach(label1, 0, 1, 0, 1)
            table.attach(entry1, 1, 2, 0, 1)

            table.attach(label5, 0, 1, 1, 2)
            table.attach(entry5, 1, 2, 1, 2)
            table.attach(button5, 1, 2, 2, 3)
            table.attach(check7, 1, 2, 3, 4)

        box.add(table)
        dialog.show_all()

        while 1:
            response = dialog.run()
            if response == Gtk.ResponseType.OK:

                if row[0] == '__folder__':
                    newrow = [row[0], entry1.get_text(), row[2], row[3], row[4]]
                    if entry1.get_text() != '':
                        dialog.destroy()
                        return True, newrow
                    else:
                        edialog = Gtk.MessageDialog(self, 0, Gtk.MessageType.ERROR,
                            Gtk.ButtonsType.OK, "You must enter a title")
                        edialog.show_all()
                        eresponse = edialog.run()
                        if eresponse == Gtk.ResponseType.OK:
                            edialog.destroy()

                if row[0] == '__item__':
                    newrow = [row[0], entry1.get_text(), entry2.get_text(),
                        entry3.get_active_text(), entry4.get_active_text()]
                    if entry1.get_text() != '' and entry2.get_text() != '' and entry3.get_active_text() != None:
                        dialog.destroy()
                        return True, newrow
                    else:
                        edialog = Gtk.MessageDialog(self, 0, Gtk.MessageType.ERROR,
                            Gtk.ButtonsType.OK, "You must enter a title/host/profile")
                        edialog.show_all()
                        eresponse = edialog.run()
                        if eresponse == Gtk.ResponseType.OK:
                            edialog.destroy()

                if row[0] == '__app__':
                    newrow = [row[0], entry1.get_text(), entry5.get_text(),
                        row[3], str(check7.get_active())]
                    if entry1.get_text() != '' and entry5.get_text() != '':
                        dialog.destroy()
                        return True, newrow
                    else:
                        edialog = Gtk.MessageDialog(self, 0, Gtk.MessageType.ERROR,
                            Gtk.ButtonsType.OK, "You must enter a title/command")
                        edialog.show_all()
                        eresponse = edialog.run()
                        if eresponse == Gtk.ResponseType.OK:
                            edialog.destroy()

            if response == Gtk.ResponseType.CANCEL:
                newrow = row
                dialog.destroy()
                return False, row

    def treeview_clicked(self, treeview, event=None):
        if event.button == 1 and event.type == Gdk.EventType._2BUTTON_PRESS:
            model, current_iter = treeview.get_selection().get_selected()

            # Root
            if model.iter_parent(current_iter) == None:
                return

            # Separator
            if model.get_value(current_iter, 0) == '__sep__':
                return

            currentrow = [(model.get_value(current_iter, 0)),
                (model.get_value(current_iter, 1)),
                (model.get_value(current_iter, 2)),
                (model.get_value(current_iter, 3)),
                (model.get_value(current_iter, 4))]

            response, newrow = self.item_dialog(currentrow)

            if response:
                model.set_value(current_iter, 1, newrow[1])
                model.set_value(current_iter, 2, newrow[2])
                model.set_value(current_iter, 3, newrow[3])
                model.set_value(current_iter, 4, newrow[4])
                self.conf_modified()

            return True

    def on_choose_file(self, widget, entry):
        dialog = Gtk.FileChooserDialog("Please choose a file", self,
            Gtk.FileChooserAction.OPEN,
            (Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
            Gtk.STOCK_OPEN, Gtk.ResponseType.OK))

        response = dialog.run()
        if response == Gtk.ResponseType.OK:
            entry.set_text(dialog.get_filename())

        dialog.destroy()


def main():
    win = ConnectionManager()
    win.show_all()
    Gtk.main()


if __name__ == '__main__':
    main()
