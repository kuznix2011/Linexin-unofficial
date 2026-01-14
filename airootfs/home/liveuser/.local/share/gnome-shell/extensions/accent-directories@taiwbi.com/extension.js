/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
export default class AccentColorIconThemeExtension extends Extension {
    _settings;
    _preferences;
    _accentColorChangedId = 0;
    _appIconChangeId = 0;
    _customThemeChangedId = 0;
    iconThemes = Object.values({});
    enable() {
        // Get the interface settings
        this._settings = new Gio.Settings({
            schema: "org.gnome.desktop.interface",
        });
        // Initializing icon themes
        this.iconThemes = Object.values({
            blue: "Adwaita-Blue-Default",
            teal: "Adwaita-Teal",
            green: "Adwaita-Green",
            yellow: "Adwaita-Yellow",
            orange: "Adwaita-Orange",
            red: "Adwaita-Red",
            pink: "Adwaita-Pink",
            purple: "Adwaita-Purple",
            slate: "Adwaita-Slate",
        });
        // Get Preferences
        this._preferences = this.getSettings();
        // Check and install missing icon themes
        this._installMissingIconThemes();
        // Connect to accent color changes
        this._accentColorChangedId = this._settings.connect("changed::accent-color", this._onAccentColorChanged.bind(this));
        // connect to app icons changed
        this._appIconChangeId = this._preferences.connect("changed::change-app-colors", this._onAppIconChanged.bind(this));
        // Initial theme update
        this._onAccentColorChanged();
        // Initial app icons check
        this._onAppIconChanged();
        // Update icon theme on custom themes change
        const themeKeys = ['blue-theme', 'teal-theme', 'green-theme', 'yellow-theme',
            'orange-theme', 'red-theme', 'pink-theme', 'purple-theme', 'slate-theme'];
        this._customThemeChangedId = themeKeys.map(key => this._preferences?.connect(`changed::${key}`, this._onAccentColorChanged.bind(this)))[0];
    }
    disable() {
        // Disconnect the signal handler
        if (this._settings && this._accentColorChangedId) {
            this._settings.disconnect(this._accentColorChangedId);
            this._accentColorChangedId = 0;
        }
        if (this._preferences && this._appIconChangeId) {
            this._preferences.disconnect(this._appIconChangeId);
            this._appIconChangeId = 0;
        }
        if (this._preferences && this._customThemeChangedId) {
            this._preferences.disconnect(this._customThemeChangedId);
            this._customThemeChangedId = 0;
        }
        // Clear the iconThemes array
        this.iconThemes = [];
        // Optionally reset to default icon theme
        this._setIconTheme("Adwaita");
        // Null out settings
        this._settings = null;
        this._preferences = null;
    }
    _installMissingIconThemes() {
        const changeAppIcons = this._preferences?.get_boolean("change-app-colors");
        const localIconsDir = GLib.get_home_dir() + "/.local/share/icons/";
        const extensionIconsDir = this.path + "/icons/";
        // Create the local icons directory if it doesn't exist
        if (!GLib.file_test(localIconsDir, GLib.FileTest.EXISTS)) {
            GLib.mkdir(localIconsDir, 0o755);
        }
        this.iconThemes.forEach((theme) => {
            const themeDir = localIconsDir + theme;
            // check if `version` file is available in themeDir and the number in it is equal than latest ver
            const versionFilePath = `${themeDir}/version`;
            if (GLib.file_test(versionFilePath, GLib.FileTest.EXISTS)) {
                const [success, contents] = GLib.file_get_contents(versionFilePath);
                if (success && parseInt(new TextDecoder().decode(contents)) == 5) {
                    if (!changeAppIcons) {
                        return;
                    }
                    else if (GLib.file_test(themeDir + "/scalable/apps/org.gnome.Nautilus-symbolic.svg", GLib.FileTest.EXISTS)) {
                        return;
                    }
                }
            }
            // Remove the old theme directory if it exists
            if (GLib.file_test(themeDir, GLib.FileTest.EXISTS)) {
                this._removeDirectoryRecursively(themeDir);
            }
            // Copy the theme from icons to local icons directory
            const sourceDir = extensionIconsDir + theme;
            this._copyDirectory(sourceDir, themeDir);
        });
    }
    _copyDirectory(sourceDir, destDir) {
        const sourceFile = Gio.File.new_for_path(sourceDir);
        const destFile = Gio.File.new_for_path(destDir);
        // Create the destination directory
        destFile.make_directory_with_parents(null);
        // Enumerate the contents of the source directory
        const enumerator = sourceFile.enumerate_children("standard::*", 0, null);
        let info;
        while ((info = enumerator.next_file(null)) !== null) {
            const sourcePath = sourceDir + "/" + info.get_name();
            const destPath = destDir + "/" + info.get_name();
            const sourceGioFile = Gio.File.new_for_path(sourcePath);
            const destGioFile = Gio.File.new_for_path(destPath);
            if (info.get_file_type() === Gio.FileType.DIRECTORY) {
                // Recursively copy the directory
                this._copyDirectory(sourcePath, destPath);
            }
            else {
                // Copy the file
                sourceGioFile.copy(destGioFile, Gio.FileCopyFlags.NONE, null, null);
            }
        }
    }
    _removeDirectoryRecursively(path) {
        let file = Gio.File.new_for_path(path);
        // Get the contents of the directory
        let enumerator = file.enumerate_children('standard::*', Gio.FileQueryInfoFlags.NONE, null);
        let info;
        // Iterate through the contents
        while ((info = enumerator.next_file(null)) !== null) {
            let childFile = file.get_child(info.get_name());
            let childPath = childFile.get_path();
            // continue if childPath is null
            if (childPath == null)
                continue;
            // Recursively remove the child file or directory
            if (info.get_file_type() === Gio.FileType.DIRECTORY) {
                this._removeDirectoryRecursively(childPath);
            }
            else {
                childFile.delete(null); // Delete the file
            }
        }
        // Remove the empty directory
        file.delete(null); // Permanently delete the directory
    }
    _onAccentColorChanged() {
        // Get the current accent color
        const accentColor = this._settings?.get_string("accent-color") ?? "blue";
        // Get custom theme from preferences
        const customTheme = this._preferences?.get_string(`${accentColor}-theme`);
        // Get the corresponding icon theme or default to Adwaita
        const iconTheme = customTheme || "Adwaita";
        // Set the icon theme
        this._setIconTheme(iconTheme);
    }
    _onAppIconChanged() {
        const changeAppIcons = this._preferences?.get_boolean("change-app-colors");
        if (changeAppIcons) {
            // Reinstall icon themes
            this._installMissingIconThemes();
        }
        else {
            // Remove app directory from every extensions icon themes in ~/.local/share/icons/
            const localIconsDir = GLib.get_home_dir() + "/.local/share/icons/";
            this.iconThemes.forEach((theme) => {
                const appDir = localIconsDir + theme + "/scalable/apps";
                if (GLib.file_test(appDir, GLib.FileTest.EXISTS)) {
                    this._removeDirectoryRecursively(appDir);
                }
            });
        }
        // reload icon theme for gnome shell
        const iconTheme = this._settings?.get_string("icon-theme");
        this._settings?.reset("icon-theme");
        this._setIconTheme(iconTheme ?? "Adwaita");
    }
    _setIconTheme(themeName) {
        // Set the icon theme
        this._settings?.set_string("icon-theme", themeName);
    }
}
