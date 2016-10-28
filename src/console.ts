/// <reference types="node" />

/**
   vs-remote-debugger (https://github.com/mkloubert/vs-remote-debugger)
   Copyright (c) Marcel Joachim Kloubert <marcel.kloubert@gmx.net>
   
   This program is free software: you can redistribute it and/or modify
   it under the terms of the GNU General Public License as published by
   the Free Software Foundation, either version 3 of the License, or
   (at your option) any later version.

   This program is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU General Public License for more details.

   You should have received a copy of the GNU General Public License
   along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import * as vscode_dbg_adapter from 'vscode-debugadapter';
import * as vsrd_contracts from './contracts';
import { DebugProtocol } from 'vscode-debugprotocol';
import FS = require('fs');
import OS = require('os');
import Path = require('path');
import Net = require('net');

const REGEX_CMD_ADD = /^(add)([\s]?)([0-9]*)$/i;
const REGEX_CMD_GOTO = /^(goto)([\s]+)([0-9]+)$/i;
const REGEX_CMD_LIST = /^(list)([\s]*)([0-9]*)([\s]*)([0-9]*)$/i;
const REGEX_CMD_LOAD = /^(load)([\s]*)([\S]*)$/i;
const REGEX_CMD_SAVE = /^(save)([\s]*)([\S]*)$/i;
const REGEX_CMD_SHARE = /^(share)([\s]*)(.*)$/i;
const REGEX_CMD_SEND = /^(send)([\s]+)([\S]+)([\s]*)([0-9]*)$/i;
const REGEX_CMD_SET = /^(set)([\s])(.*)$/i;
const REGEX_CMD_UNSET = /^(unset)([\s]*)([0-9]*)$/i;

export interface ExecuteCommandResponseBody {
    /** The number of indexed child variables.
        The client can use this optional information to present the variables in a paged UI and fetch them in chunks.
    */
    indexedVariables?: number;

    /** The number of named child variables.
        The client can use this optional information to present the variables in a paged UI and fetch them in chunks.
    */
    namedVariables?: number;

    /** The result of the evaluate request. */
    result?: string;

    /** The optional type of the evaluate result. */
    type?: string;

    /** If variablesReference is > 0, the evaluate result is structured and its children can be retrieved by passing variablesReference to the VariablesRequest. */
    variablesReference?: number;
}

/**
 * Describes on object for handling a command execution result.
 */
export interface ExecuteCommandResult {
    /**
     * The request arguments.
     */
    args: DebugProtocol.EvaluateArguments;

    /**
     * Gets or sets the body object of the underlying response.
     */
    body(newValue?: ExecuteCommandResponseBody | string): ExecuteCommandResponseBody;

    /**
     * Gets the current entry.
     */
    currentEntry(): vsrd_contracts.RemoteDebuggerEntry;

    /**
     * Gets or sets the index of the current entry.
     */
    currentIndex(newValue?: number): number;

    /**
     * Gets or sets the list of entries.
     */
    entries(entries?: vsrd_contracts.RemoteDebuggerEntry[]): vsrd_contracts.RemoteDebuggerEntry[];

    /**
     * Gets or sets the list of favorites.
     */
    favorites(favorites?: vsrd_contracts.RemoteDebuggerFavorite[]): vsrd_contracts.RemoteDebuggerFavorite[];

    /**
     * Gets the list of friends.
     */
    friends(): vsrd_contracts.Friend[];

    /**
     * Jumps to a specific entry.
     */
    gotoIndex(newIndex?: number, response?: DebugProtocol.EvaluateResponse): void;

    /**
     * Command was handled or not.
     */
    handled: boolean;

    /**
     * Gets or sets if debugger runs in debug mode or not.
     */
    isDebug(newValue?: boolean): boolean;

    /**
     * Gets or sets if debugger runs in debug mode or not.
     */
    isPaused(newValue?: boolean): boolean;

    /**
     * Sends an event.
     */
    sendEvent: (event?: DebugProtocol.Event) => void;

    /**
     * Gets the root directory of the sources of the current workspace / project.
     */
    sourceRoot(): string;

    /**
     * Writes to output.
     */
    write(msg?: any);

    /**
     * Writes to output and adds a new line.
     */
    writeLine(msg?: any);

    /**
     * Sends a response.
     */
    sendResponse: (response?: DebugProtocol.EvaluateResponse) => void;
}

/**
 * A debugger console manager.
 */
export class ConsoleManager {
    /**
     * The underlying debugger context.
     */
    protected _context: vsrd_contracts.DebuggerContext;

    /**
     * Initializes a new instance of that class.
     * 
     * @param {vscode_dbg_adapter.DebugSession} session The underlying session.
     */
    constructor(session: vsrd_contracts.DebuggerContext) {
        this._context = session;
    }

    /**
     * 'add' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     * @param {RegExpExecArray} match Matches of the execution of a regular expression.
     */
    protected cmd_add(result: ExecuteCommandResult, match: RegExpExecArray): void {
        let index = result.currentIndex() + 1;
        if ('' != match[3]) {
            index = parseInt(match[3]);
        }

        let entries = result.entries();
        let favorites = result.favorites();

        let entry: vsrd_contracts.RemoteDebuggerEntry;
        if (index <= entries.length) {
            entry = entries[index - 1];
        }

        if (entry) {
            let fav: vsrd_contracts.RemoteDebuggerFavorite = { 
                index: index,
                entry: entry,
            };

            let exists = false;
            for (let i = 0; i < favorites.length; i++) {
                if (favorites[i].index == index) {
                    // do not add duplicates

                    exists = true;
                    break;
                }
            }

            if (!exists) {
                favorites.push(fav);

                favorites.sort((x, y) => {
                    if (x.index > y.index) {
                        return 1;
                    }
                    if (x.index < y.index) {
                        return -1;
                    }

                    return 0;
                });
            }

            result.body(`Added ${fav.index} as favorite`);
        }
        else {
            if (entries.length > 0) {
                result.body(`Please select a valid index from 1 to ${entries.length}!`);
            }
            else {
                result.body('Please select an entry!');
            }
        }

        result.sendResponse();
    }

    /**
     * 'all' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     */
    protected cmd_all(result: ExecuteCommandResult): void {
        let entries = result.entries();
        
        let favorites: vsrd_contracts.RemoteDebuggerFavorite[] = [];
        for (let i = 0; i < entries.length; i++) {
            favorites.push({
                entry: entries[i],
                index: i + 1,
            });
        }

        result.favorites(favorites);

        result.body(`All ${favorites.length} entries were added as favorites`);
        result.sendResponse();
    }

    /**
     * 'clear' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     */
    protected cmd_clear(result: ExecuteCommandResult): void {
        result.entries([]);
        result.favorites([]);

        result.body('Cleared');
        result.sendResponse();

        result.gotoIndex(0);
    }

    /**
     * 'continue' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     */
    protected cmd_continue(result: ExecuteCommandResult): void {
        result.isPaused(false);

        result.body('Running');
        result.sendResponse();
    }

    /**
     * 'current' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     */
    protected cmd_current(result: ExecuteCommandResult): void {
        result.body(`Current index: ${result.currentIndex() + 1}`);

        result.sendResponse();
    }

    /**
     * 'debug' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     */
    protected cmd_debug(result: ExecuteCommandResult): void {
        result.isDebug(true);

        result.body('Debug mode');
        result.sendResponse();
    }

    /**
     * 'favs' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     * @param {ConsoleManager} me The underlying console manager.
     */
    protected cmd_favs(result: ExecuteCommandResult, me: ConsoleManager): void {
        let output = '';

        let favorites = result.favorites();
        if (favorites && favorites.length > 0) {
            for (let i = 0; i < favorites.length; i++) {
                let fav = favorites[i];

                output += me.toListEntryString(fav.entry, fav.index) + "\n";
            }
        }
        else {
            output = null;
            result.body('No favorites found.');
        }

        result.sendResponse();

        if (output) {
            result.write(output);
        }
    }

    /**
     * 'first' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     */
    protected cmd_first(result: ExecuteCommandResult): void {
        result.body("New index: 1");
        result.sendResponse();

        result.gotoIndex(0);        
    }

    /**
     * 'friends' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     */
    protected cmd_friends(result: ExecuteCommandResult): void {
        let friends = result.friends();

        if (friends.length > 0) {
            result.sendResponse();

            let output = '';

            for (let i = 0; i < friends.length; i++) {
                let f = friends[i];

                output += `[${i + 1}] ${f.name} => ${f.address}:${f.port}\n`;
            }

            result.write(output);
        }
        else {
            result.body('No friends found.');
            result.sendResponse();
        }
    }

    /**
     * 'goto' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     * @param {RegExpExecArray} match Matches of the execution of a regular expression.
     */
    protected cmd_goto(result: ExecuteCommandResult, match: RegExpExecArray): void {
        let newIndex = parseInt(match[3].trim());

        result.body(`New index: ${newIndex}`);
        result.sendResponse();

        result.gotoIndex(newIndex - 1);
    }

    /**
     * 'help' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     */
    protected cmd_help(result: ExecuteCommandResult): void {
        let output = ' Command                                     | Description\n';
           output += '---------------------------------------------|-----------------\n';
           output += ' ?                                           | Shows that help screen\n';
           output += ' +                                           | Goes to next entry\n';
           output += ' -                                           | Goes to previous entry\n';
           output += ' add [$INDEX]                                | Adds the current or a specific entry as favorite\n';
           output += ' all                                         | Adds all entries as favorites\n';
           output += ' clear                                       | Removes all loaded entries and favorites\n';
           output += ' continue                                    | Continues debugging\n';
           output += ' current                                     | Displays current index\n';
           output += ' debug                                       | Runs debugger itself in "debug mode"\n'; 
           output += ' favs                                        | Lists all favorites\n';
           output += ' friends                                     | Displays the list of friends\n';
           output += ' first                                       | Jumps to first item\n';
           output += ' goto $INDEX                                 | Goes to a specific entry (beginning at 1)\n';
           output += ' last                                        | Jumps to last entry\n';
           output += ' list [$ITEMS_TO_SKIP] [$ITEMS_TO_DISPLAY]   | Lists a number of entries\n';
           output += ' load [$FILE]                                | Loads entries from a local JSON file\n';
           output += ' me                                          | Lists all network interfaces of that machine\n';
           output += ' nodebug                                     | Stops running debugger itself in "debug mode"\n';
           output += ' none                                        | Clears all favorites"\n';
           output += ' pause                                       | Pauses debugging (skips incoming messages)\n';
           output += ' refresh                                     | Refreshes the view\n';
           output += ' save [$FILE]                                | Saves the favorites to a local JSON file\n';
           output += ' send $ADDR [$PORT]                          | Sends your favorites to a remote machine\n';
           output += ' set $TEXT                                   | Sets additional information like a "note" value for the current entry\n';
           output += ' share [$FRIEND]*                            | Sends your favorites to one or more friend\n';
           output += ' state                                       | Displays the current debugger state\n';
           output += ' toggle                                      | Toggles "paused" state\n';
           output += ' unset [$INDEX]                              | Removes the additional information that is stored in an entry\n';
           output += ' wait                                        | Starts waiting for an entry\n';
            
        result.body('');
        result.sendResponse();

        result.write(output);
    }

    /**
     * 'last' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     */
    protected cmd_last(result: ExecuteCommandResult): void {
        let newIndex = result.entries().length - 1;
            
        result.body(`New index: ${newIndex + 1}`);
        result.sendResponse();

        result.gotoIndex(newIndex);
    }

    /**
     * 'list' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     * @param {RegExpExecArray} match Matches of the execution of a regular expression.
     * @param {ConsoleManager} me The underlying manager.
     */
    protected cmd_list(result: ExecuteCommandResult, match: RegExpExecArray, me: ConsoleManager): void {
        let entries = result.entries();

        let itemsToSkip: number = 0;
        if ('' != match[3]) {
            itemsToSkip = parseInt(match[3]);
        }

        let itemsToDisplay: number = 50;
        if ('' != match[5]) {
            itemsToDisplay = parseInt(match[5]);
        }

        let newIndex = parseInt(match[3].trim());

        let output: string = '';

        let numberOfDisplayedItems = 0;
        for (let i = 0; i < itemsToDisplay; i++) {
            let index = itemsToSkip + i;
            if (index >= entries.length) {
                // no more items to display
                break;
            }

            let entry = entries[index];
            if (!entry) {
                break;
            }

            ++numberOfDisplayedItems;
            output += me.toListEntryString(entry, index + 1) + "\n";
        }

        if (numberOfDisplayedItems < 1) {
            output = null;
            result.body("No items found!");
        }

        result.sendResponse();
        
        if (output) {
            result.write(output);
        }
    }

    /**
     * 'load' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     * @param {RegExpExecArray} match Matches of the execution of a regular expression.
     * @param {ConsoleManager} me The underlying console manager.
     */
    protected cmd_load(result: ExecuteCommandResult, match: RegExpExecArray, me: ConsoleManager): void {
        let entries = result.entries();
        let file = match[3].trim();

        let showError = (err) => {
            //TODO: me.log('[ERROR :: save()]: ' + err);
        };

        try {
            if ('' == file) {
                let existingFileNames = FS.readdirSync(result.sourceRoot());
                let existingFiles: { path: string, stats: FS.Stats}[] = [];
                for (let i = 0; i < existingFileNames.length; i++) {
                    let fileName = existingFileNames[i];
                    if (!/^(vsrd_favs_)([0-9]+)(\.json)$/i.test(fileName.trim())) {
                        continue;
                    }

                    let fullPath = Path.join(result.sourceRoot(), fileName);
                    
                    let ls = FS.lstatSync(fullPath);
                    if (ls.isFile()) {
                        existingFiles.push({
                            path: fullPath,
                            stats: ls,
                        });
                    }
                }

                if (existingFiles.length > 0) {
                    existingFiles.sort((x, y) => {
                        if (x.stats.birthtime.getTime() > y.stats.birthtime.getTime()) {
                            return -1;
                        }

                        if (x.stats.birthtime.getTime() < y.stats.birthtime.getTime()) {
                            return 1;
                        }

                        return 0;
                    });

                    file = existingFiles[0].path;
                }
            }

            if ('' == file) {
                result.writeLine("Please select a file!");
                return;
            }

            if (!Path.isAbsolute(file)) {
                file = Path.join(result.sourceRoot(), file);
            }

            let loadedEntries: vsrd_contracts.RemoteDebuggerEntry[] = require(file);
            if (loadedEntries && loadedEntries.length) {
                let loadedEntryCount = 0;
                for (let i = 0; i < loadedEntries.length; i++) {
                    let entry = loadedEntries[i];
                    if (entry) {
                        entries.push(entry);
                        ++loadedEntryCount;
                    }
                }

                if (loadedEntries.length > 0) {
                    result.writeLine(`Loaded ${loadedEntryCount} entries from '${file}'`);

                    result.gotoIndex(result.currentIndex());
                }
            }
        }
        catch (e) {
            showError(e);
        }
    }

    /**
     * 'me' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     */
    protected cmd_me(result: ExecuteCommandResult): void {
        let foundInterfaces: OS.NetworkInterfaceInfo[] = [];
        
        let netInterfaces = OS.networkInterfaces();
        for (let i in netInterfaces) {
            let infos = netInterfaces[i];
            infos.forEach((netInterface) => {
                if (netInterface.internal) {
                    return;
                }

                foundInterfaces.push(netInterface);
            });
        }

        if (foundInterfaces.length > 0) {
            let output = '';
            
            for (let i = 0; i < foundInterfaces.length; i++) {
                let ni = foundInterfaces[i];

                output += `[${i + 1}] (${ni.family}) ${ni.address} / ${ni.netmask} (${ni.mac})`;
                output += "\n";
            }

            result.write(output);
        }
        else {
            result.body('No network interfaces found!');
        }

        result.sendResponse();
    }

    /**
     * 'next' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     */
    protected cmd_next(result: ExecuteCommandResult): void {
        let newIndex = result.currentIndex() + 1;
        
        result.body(`New index: ${newIndex + 1}`);
        result.sendResponse();

        result.gotoIndex(newIndex);
    }

    /**
     * 'nodebug' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     */
    protected cmd_nodebug(result: ExecuteCommandResult): void {
        result.isDebug(false);

        result.body('Debug mode leaved');
        result.sendResponse();
    }

    /**
     * 'none' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     */
    protected cmd_none(result: ExecuteCommandResult): void {
        result.favorites([]);
        
        result.body('Favorites cleared');
        result.sendResponse();
    }

    /**
     * 'pause' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     */
    protected cmd_pause(result: ExecuteCommandResult): void {
        result.isPaused(true);

        result.body('Paused');
        result.sendResponse();
    }

    /**
     * 'prev' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     */
    protected cmd_prev(result: ExecuteCommandResult): void {
        let newIndex = result.currentIndex() - 1;
        
        result.body(`New index: ${newIndex + 1}`);
        result.sendResponse();

        result.gotoIndex(newIndex);
    }

    /**
     * 'refresh' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     */
    protected cmd_refresh(result: ExecuteCommandResult): void {
        let newIndex = result.currentIndex();

        result.body(`New index: ${newIndex + 1}`);
        result.sendResponse();

        result.gotoIndex(newIndex);
    }

    /**
     * 'save' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     * @param {RegExpExecArray} match Matches of the execution of a regular expression.
     * @param {ConsoleManager} me The underlying console manager.
     */
    protected cmd_save(result: ExecuteCommandResult, match: RegExpExecArray, me: ConsoleManager): void {
        let favorites = result.favorites();
        let file = match[3].trim();

        let showError = (err) => {
            //TODO: me.log('[ERROR :: save()]: ' + err);
        };

        if (favorites.length > 0) {
            try {
                
                if ('' == file) {
                    // auto save

                    let now = new Date();

                    let index: number = -1;
                    let baseName = 'vsrd_favs_' + now.getTime();
                    let fullPath: string;
                    let stats: FS.Stats;
                    
                    let exists: boolean;
                    do {
                        exists = false;

                        try {
                            let fileName = baseName;
                            if (index > -1) {
                                fileName += '_' + index;
                            }
                            fileName += '.json';

                            fullPath = Path.join(result.sourceRoot(), fileName);

                            exists = FS.lstatSync(fullPath).isFile();
                        }
                        catch (e) {
                            exists = false;
                        }
                    }
                    while (exists);

                    file = fullPath;
                }

                if (!Path.isAbsolute(file)) {
                    file = Path.join(result.sourceRoot(), file);
                }

                let saveFavs = () => {
                    result.sendResponse();

                    try {
                        let jsons: string[] = [];

                        for (let i = 0; i < favorites.length; i++) {
                            let fav = favorites[i];
                            if (!fav) {
                                continue;
                            }

                            jsons.push(JSON.stringify(fav.entry, null, 2));
                        }

                        FS.writeFileSync(file, '[\n' + jsons.join(', ') + '\n]', {
                            encoding: 'utf8'
                        });

                        result.writeLine(`Saved favorites to '${file}'`);
                    }
                    catch (e) {
                        showError(e);
                    }
                };

                try {
                    let stats = FS.lstatSync(file);
                    
                    if (stats.isFile()) {
                        FS.unlinkSync(file);
                    }
                }
                catch (e) {
                }

                saveFavs();
            }
            catch (e) {
                result.sendResponse();
                
                showError(e);
            }
        }
        else {
            result.body("No favorites available!");            
            result.sendResponse();
        }
    }

    /**
     * 'send' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     * @param {RegExpExecArray} match Matches of the execution of a regular expression.
     * @param {ConsoleManager} me The underlying manager.
     */
    protected cmd_send(result: ExecuteCommandResult, match: RegExpExecArray, me: ConsoleManager): void {
        let favs = result.favorites();
        
        let host = match[3].toLowerCase().trim();
    
        let port = vsrd_contracts.DEFAULT_PORT;
        if ('' !== match[5]) {
            port = parseInt(match[5]);
        }

        let output = '';

        if (favs && favs.length > 0) {
            let finished = () => {
                result.writeLine(`Send favorites to '${host}:${port}'`);

                result.sendResponse();
            };

            let i = -1;
            let sendNext: () => void;
            sendNext = function() {
                ++i;
                
                if (!favs) {
                    finished();
                    return;
                }

                if (i >= favs.length) {
                    finished();
                    return;
                }

                me.sendEntryTo(favs[i].entry, host, port)
                  .then((e) => {
                            sendNext();
                        },
                        () => {
                            sendNext();
                        });
            };

            // start sending
            sendNext();
        }
        else {
            result.body('Nothing to send!');
            result.sendResponse();
        }
    }

    /**
     * 'set' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     * @param {RegExpExecArray} match Matches of the execution of a regular expression.
     */
    protected cmd_set(result: ExecuteCommandResult, match: RegExpExecArray): void {
        let text = match[3].trim();

        let index = result.currentIndex();
        let entry = result.currentEntry();
        if (entry) {
            entry.n = text;

            result.body(`Set information for ${index + 1}: ${text}`);
        }
        else {
            result.body('Please select an entry!');
        }

        result.sendResponse();
    }

    /**
     * 'share' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     * @param {RegExpExecArray} match Matches of the execution of a regular expression.
     * @param {ConsoleManager} me The underlying console manager.
     */
    protected cmd_share(result: ExecuteCommandResult, match: RegExpExecArray, me: ConsoleManager): void {
        let favs = result.favorites();
        if (favs.length > 0) {
            let listOfFriends = match[3].trim();

            let friendNames: string[] = [];
            let parts = listOfFriends.split(' ');
            for (let i = 0; i < parts.length; i++) {
                let fn = parts[i].toLowerCase().trim();
                if ('' != fn) {
                    friendNames.push(fn);
                }
            }

            let allFriends = result.friends();

            let friends: vsrd_contracts.Friend[];
            if (friendNames.length > 0) {
                friends = [];
                for (let i = 0; i < friendNames.length; i++) {
                    let fn = friendNames[i];

                    for (let j = 0; j < allFriends.length; j++) {
                        let f = allFriends[j];
                        if (f.name == fn) {
                            friends.push(f);
                        }
                    }
                }
            }
            else {
                friends = allFriends;
            }

            if (friends.length > 0) {
                let sendToFriend = (f: vsrd_contracts.Friend) => {
                    let finished = () => {
                        result.writeLine(`Send favorites to '${f.name}' (${f.address}:${f.port})`);
                    };
                    
                    let i = -1;
                    let sendNext: () => void;
                    sendNext = function() {
                        ++i;
                        
                        if (!favs) {
                            finished();
                            return;
                        }

                        if (i >= favs.length) {
                            finished();
                            return;
                        }

                        me.sendEntryTo(favs[i].entry, f.address, f.port)
                          .then((e) => {
                                    sendNext();
                                },
                                () => {
                                    sendNext();
                                });
                    };

                    // start sending
                    sendNext();
                };

                for (let i = 0; i < friends.length; i++) {
                    sendToFriend(friends[i]);  
                }

                result.sendResponse();
            }
            else {
                result.body('No friends defined or found!');
                result.sendResponse();
            }
        }
        else {
            result.body('Nothing to send!');
            result.sendResponse();
        }
    }

    /**
     * 'state' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     */
    protected cmd_state(result: ExecuteCommandResult): void {
        result.body(result.isPaused() ? 'Paused' : 'Running');
        result.sendResponse();
    }

    /**
     * 'toggle' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     */
    protected cmd_toggle(result: ExecuteCommandResult): void {
        let toggledIsPaused = !result.isPaused();
        result.isPaused(toggledIsPaused);

        result.body(toggledIsPaused ? 'Paused' : 'Running');
        result.sendResponse();
    }

    /**
     * 'unset' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     * @param {RegExpExecArray} match Matches of the execution of a regular expression.
     */
    protected cmd_unset(result: ExecuteCommandResult, match: RegExpExecArray): void {
        let index = result.currentIndex() + 1;
        if ('' != match[3]) {
            index = parseInt(match[3]);
        }

        let entries = result.entries();
        let favorites = result.favorites();

        let entry: vsrd_contracts.RemoteDebuggerEntry;
        if (index <= entries.length) {
            entry = entries[index - 1];
        }

        if (entry) {
            entry.n = null;

            result.body(`Removed information from ${index}`);
        }
        else {
            if (entries.length > 0) {
                result.body(`Please select a valid index from 1 to ${entries.length}!`);
            }
            else {
                result.body('Please select an entry!');
            }
        }

        result.sendResponse();
    }

    /**
     * 'last' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     */
    protected cmd_wait(result: ExecuteCommandResult): void {
        let newIndex = result.entries().length;

        result.body(`New index: ${newIndex + 1}`);
        result.sendResponse();

        result.gotoIndex(newIndex);
    }

    /**
     * Executes a command.
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     */
    public evaluateRequest(result: ExecuteCommandResult): void {
        let expr = result.args.expression;
        if (!expr) {
            expr = '';
        }

        let action: (result: ExecuteCommandResult, me: ConsoleManager) => void;
        
        let toRegexAction: (actionToWrap: (result: ExecuteCommandResult, match: RegExpExecArray, me: ConsoleManager) => void,
                            regex: RegExp, expr: string) => (result: ExecuteCommandResult, me: ConsoleManager) => void;
        toRegexAction = (actionToWrap, regex, expr) => {
            let match = regex.exec(expr);

            return (result, me) => {
                if (actionToWrap) {
                    actionToWrap(result, match, me);
                }
            };
        };

        let trimmedExpr = expr.trim();
        let lowerExpr = trimmedExpr.toLowerCase();

        if ('+' == lowerExpr || 'next' == lowerExpr) {
            action = this.cmd_next;
        }
        else if ('-' == lowerExpr || 'prev' == lowerExpr) {
            action = this.cmd_prev;
        }
        else if ('all' == lowerExpr) {
            action = this.cmd_all;
        }
        else if ('clear' == lowerExpr) {
            action = this.cmd_clear;
        }
        else if ('continue' == lowerExpr) {
            action = this.cmd_continue;
        }
        else if ('current' == lowerExpr) {
            action = this.cmd_current;
        }
        else if ('debug' == lowerExpr) {
            action = this.cmd_debug;
        }
        else if ('favs' == lowerExpr) {
            action = this.cmd_favs;
        }
        else if ('first' == lowerExpr) {
            action = this.cmd_first;
        }
        else if ('friends' == lowerExpr) {
            action = this.cmd_friends;
        }
        else if ('help' == lowerExpr || '?' == lowerExpr) {
            action = this.cmd_help;
        }
        else if ('last' == lowerExpr) {
            action = this.cmd_last;
        }
        else if ('me' == lowerExpr) {
            action = this.cmd_me;
        }
        else if ('nodebug' == lowerExpr) {
            action = this.cmd_nodebug;
        }
        else if ('nofavs' == lowerExpr || 'none' == lowerExpr) {
            action = this.cmd_none;
        }
        else if ('pause' == lowerExpr) {
            action = this.cmd_pause;
        }
        else if ('refresh' == lowerExpr) {
            action = this.cmd_refresh;
        }
        else if ('state' == lowerExpr) {
            action = this.cmd_state;
        }
        else if ('toggle' == lowerExpr) {
            action = this.cmd_toggle;
        }
        else if ('wait' == lowerExpr) {
            action = this.cmd_wait;
        }
        else if (REGEX_CMD_ADD.test(trimmedExpr)) {
            // add
            action = toRegexAction(this.cmd_add,
                                   REGEX_CMD_ADD, trimmedExpr);
        }
        else if (REGEX_CMD_GOTO.test(trimmedExpr)) {
            // goto
            action = toRegexAction(this.cmd_goto,
                                   REGEX_CMD_GOTO, trimmedExpr);
        }
        else if (REGEX_CMD_LIST.test(trimmedExpr)) {
            // list
            action = toRegexAction(this.cmd_list,
                                   REGEX_CMD_LIST, trimmedExpr);
        }
        else if (REGEX_CMD_LOAD.test(trimmedExpr)) {
            // load
            action = toRegexAction(this.cmd_load,
                                   REGEX_CMD_LOAD, trimmedExpr);
        }
        else if (REGEX_CMD_SAVE.test(trimmedExpr)) {
            // save
            action = toRegexAction(this.cmd_save,
                                   REGEX_CMD_SAVE, trimmedExpr);
        }
        else if (REGEX_CMD_SEND.test(trimmedExpr)) {
            // send
            action = toRegexAction(this.cmd_send,
                                   REGEX_CMD_SEND, trimmedExpr);
        }
        else if (REGEX_CMD_SET.test(trimmedExpr)) {
            // set
            action = toRegexAction(this.cmd_set,
                                   REGEX_CMD_SET, trimmedExpr);
        }
        else if (REGEX_CMD_SHARE.test(trimmedExpr)) {
            // share
            action = toRegexAction(this.cmd_share,
                                   REGEX_CMD_SHARE, trimmedExpr);
        }
        else if (REGEX_CMD_UNSET.test(trimmedExpr)) {
            // unset
            action = toRegexAction(this.cmd_unset,
                                   REGEX_CMD_UNSET, trimmedExpr);
        }

        if (action) {
            result.handled = true;
            result.body('');

            action(result, this);
        }
    }

    /**
     * Sends a debugger entry to another machine.
     * 
     * @param {vsrd_contracts.RemoteDebuggerEntry} entry The entry to send.
     * @param {string} host The host address.
     * @param {number} The TCP port.
     * 
     * @return {Promise<T>} The promise.
     */
    protected sendEntryTo(entry: vsrd_contracts.RemoteDebuggerEntry,
                          host: string, port: number): Promise<vsrd_contracts.RemoteDebuggerEntry> {

        return new Promise((resolve, reject) => {
            let showError = (err) => {
                reject({
                    'entry': entry,
                    'error': err,
                });
            };

            let json = new Buffer(JSON.stringify(entry),
                                  'utf8');

            let dataLength = Buffer.alloc(4);
            dataLength.writeUInt32LE(json.length, 0);

            let client = new Net.Socket();

            client.on('error', function(err) {
                showError(err);
            });

            client.connect(port, host, () => {
                try {
                    client.write(dataLength);
                    client.write(json);

                    client.destroy();

                    resolve(entry);
                }
                catch (e) {
                    showError(e);
                }
            });
        });
    }

    /**
     * Converts a value to a Date object.
     * 
     * @param {any} [val] The input value.
     * 
     * @return {Date} The output value.
     */
    protected toDate(val?: Date | string): Date {
        try {
            if (val) {
                if (val instanceof Date) {
                    return val;
                }

                val = ('' + val).trim();
            }
            
            if (!val) {
                return;
            }
            
            return new Date(<string>val);
        }
        catch (e) {
            return;  // ignore
        }
    }

    /**
     * Creates a "list entry" string for an entry.
     * 
     * @param {vsrd_contracts.RemoteDebuggerEntry} [entry] The entry.
     * @param {number} [index] The index to display.
     */
    protected toListEntryString(entry?: vsrd_contracts.RemoteDebuggerEntry, index?: number): string {
        if (!entry) {
            return;
        }

        let str: string = '';

        let file = '<???>';
        let line = '';
        if (entry.s) {
            if (entry.s.length > 0) {
                let firstStackFrame = entry.s[0];

                file = firstStackFrame.f;
                if (firstStackFrame.l) {
                    line = ` (${firstStackFrame.l})`;
                }
            }
        }

        // prefix
        let prefix = '';
        if (arguments.length > 1) {
            prefix += `[${index}] `;
        }

        let prefixSpaces = ' '.repeat(prefix.length);

        let origin = '';
        if (entry.__origin) {
            let sendTime: any = this.toDate(entry.__origin.time);
            if (sendTime) {
                sendTime = ` (${sendTime})`;
            }
            else {
                sendTime = '';
            }

            origin += `\n${prefixSpaces}From:  '${entry.__origin.address}:${entry.__origin.port}'${sendTime}`;
        }

        // additional information / notes
        let notes = '';
        if (entry.n) {
            notes += `\n${prefixSpaces}Notes: ${entry.n}`;
        }

        str += `${prefix}${file}${line}${notes}${origin}`;

        return str;
    }
}
