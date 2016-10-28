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
import Path = require('path');
import Net = require('net');


const REGEX_CMD_ADD = /^(add)([\s]?)([0-9]*)$/i;
const REGEX_CMD_GOTO = /^(goto)([\s]+)([0-9]+)$/i;
const REGEX_CMD_LIST = /^(list)([\s]*)([0-9]*)([\s]*)([0-9]*)$/i;
const REGEX_CMD_LOAD = /^(load)([\s]*)([\S]*)$/i;
const REGEX_CMD_SAVE = /^(save)([\s]*)([\S]*)$/i;
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
 * Describes on object for a command execution result.
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
     * Stores the underlying session.
     */
    protected _session: vscode_dbg_adapter.DebugSession;

    /**
     * Initializes a new instance of that class.
     * 
     * @param {vscode_dbg_adapter.DebugSession} session The underlying session.
     */
    constructor(session: vscode_dbg_adapter.DebugSession) {
        this._session = session;
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
     * 'favs' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     */
    protected cmd_favs(result: ExecuteCommandResult): void {
        let output = '';

        let favorites = result.favorites();
        if (favorites && favorites.length > 0) {
            for (let i = 0; i < favorites.length; i++) {
                let fav = favorites[i];

                let file = '<???>';
                let line = '';
                if (fav.entry.s) {
                    if (fav.entry.s.length > 0) {
                        let firstStackFrame = fav.entry.s[0];

                        file = firstStackFrame.f;
                        if (firstStackFrame.l) {
                            line = ` (${firstStackFrame.l})`;
                        }
                    }
                }

                let prefix = `[${fav.index + 1}] `;

                output += `${prefix}${file}${line}`;

                // additional information / notes
                let notes = fav.entry.n;
                if (notes) {
                    output += '\n';
                    for (let j = 0; j < prefix.length; j++) {
                        output += ' ';
                    }

                    output += notes;
                }

                output += "\n";
            }
        }
        else {
            output = 'No favorites found!\n';
        }

        result.sendResponse();

        result.write(output);
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
           output += ' -                                           | Goes to next entry\n';
           output += ' add [$INDEX]                                | Adds the current or a specific entry as favorite\n';
           output += ' all                                         | Adds all entries as favorites\n';
           output += ' clear                                       | Removes all loaded entries and favorites\n';
           output += ' continue                                    | Continues debugging\n';
           output += ' current                                     | Displays current index\n';
           output += ' debug                                       | Runs debugger itself in "debug mode"\n'; 
           output += ' favs                                        | Lists all favorites\n';
           output += ' first                                       | Jumps to first item\n';
           output += ' goto $INDEX                                 | Goes to a specific entry (beginning at 1) \n';
           output += ' last                                        | Jumps to last entry\n';
           output += ' list [$ITEMS_TO_SKIP] [$ITEMS_TO_DISPLAY]   | Goes to a specific entry (beginning at 1) \n';
           output += ' load [$FILE]                                | Loads entries from a local JSON file\n';
           output += ' nodebug                                     | Stops running debugger itself in "debug mode"\n';
           output += ' none                                        | Clears all favorites"\n';
           output += ' pause                                       | Pauses debugging (skips incoming messages)\n';
           output += ' refresh                                     | Refreshes the view\n';
           output += ' save [$FILE]                                | Saves the favorites to a local JSON file\n';
           output += ' send $ADDR [$PORT]                          | Sends your favorites to a remote machine\n';
           output += ' set $TEXT                                   | Sets additional information like a "note" value for the current entry\n';
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
     */
    protected cmd_list(result: ExecuteCommandResult, match: RegExpExecArray): void {
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

            let prefix = `[${index + 1}] `;

            output += `${prefix}${file}${line}`;

            // additional information / notes
            let notes = entry.n;
            if (notes) {
                output += '\n';
                for (let j = 0; j < prefix.length; j++) {
                    output += ' ';
                }

                output += notes;
            }

            output += "\n";
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
     */
    protected cmd_load(result: ExecuteCommandResult, match: RegExpExecArray): void {
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
                        if (x.stats.ctime.getTime() > y.stats.ctime.getTime()) {
                            return -1;
                        }

                        if (x.stats.ctime.getTime() < y.stats.ctime.getTime()) {
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
     */
    protected cmd_save(result: ExecuteCommandResult, match: RegExpExecArray): void {
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
     */
    protected cmd_send(result: ExecuteCommandResult, match: RegExpExecArray): void {
        let favs = result.favorites();
        
        let host = match[3].toLowerCase().trim();
    
        let port = vsrd_contracts.DEFAULT_PORT;
        if ('' !== match[5]) {
            port = parseInt(match[5]);
        }

        let output = '';

        if (favs && favs.length > 0) {
            result.sendResponse();

            let showError = (err) => {
                result.writeLine('[ERROR :: send()]: ' + err + '\n');
            };

            let finished = () => {
                result.writeLine(`Send favorites to '${host}:${port}'`);
            };

            let i = -1;
            let sendNext: () => void;
            sendNext = () => {
                ++i;
                
                if (!favs) {
                    finished();
                    return;
                }

                if (i >= favs.length) {
                    finished();
                    return;
                }
                
                try {
                    let json = new Buffer(JSON.stringify(favs[i].entry),
                                            'utf8');

                    let dataLength = Buffer.alloc(4);
                    dataLength.writeUInt32LE(json.length, 0);

                    let client = new Net.Socket();

                    client.on('error', function(err) {
                        showError(err);

                        sendNext();
                    });

                    client.connect(port, host, () => {
                        try {
                            client.write(dataLength);
                            client.write(json);

                            client.destroy();
                        }
                        catch (e) {
                            showError(e);
                        }

                        sendNext();
                    });
                }
                catch (e) {
                    showError(e);
                }
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
        let me = this;
        let session: any = this._session;

        let expr = result.args.expression;
        if (!expr) {
            expr = '';
        }

        let action: (result: ExecuteCommandResult) => void;
        
        let toRegexAction: (actionToWrap: (result: ExecuteCommandResult, match: RegExpExecArray) => void,
                            regex: RegExp, expr: string) => (result: ExecuteCommandResult) => void;
        toRegexAction = (actionToWrap, regex, expr) => {
            let match = regex.exec(expr);

            return (r) => {
                if (actionToWrap) {
                    actionToWrap(r, match);
                }
            };
        };

        if ('+' == expr.toLowerCase().trim() ||
            'next' == expr.toLowerCase().trim()) {
            action = me.cmd_next;
        }
        else if ('-' == expr.toLowerCase().trim() ||
                 'prev' == expr.toLowerCase().trim()) {
            action = me.cmd_prev;
        }
        else if ('all' == expr.toLowerCase().trim()) {
            action = me.cmd_all;
        }
        else if ('clear' == expr.toLowerCase().trim()) {
            action = me.cmd_clear;
        }
        else if ('continue' == expr.toLowerCase().trim()) {
            action = me.cmd_continue;
        }
        else if ('current' == expr.toLowerCase().trim()) {
            action = me.cmd_current;
        }
        else if ('debug' == expr.toLowerCase().trim()) {
            action = me.cmd_debug;
        }
        else if ('favs' == expr.toLowerCase().trim()) {
            action = me.cmd_favs;
        }
        else if ('first' == expr.toLowerCase().trim()) {
            action = me.cmd_first;
        }
        else if ('help' == expr.toLowerCase().trim() ||
                 '?' == expr.toLowerCase().trim()) {
            action = me.cmd_help;
        }
        else if ('last' == expr.toLowerCase().trim()) {
            action = me.cmd_last;
        }
        else if ('nodebug' == expr.toLowerCase().trim()) {
            action = me.cmd_nodebug;
        }
        else if ('nofavs' == expr.toLowerCase().trim() ||
                 'none' == expr.toLowerCase().trim()) {
            action = me.cmd_none;
        }
        else if ('pause' == expr.toLowerCase().trim()) {
            action = me.cmd_pause;
        }
        else if ('refresh' == expr.toLowerCase().trim()) {
            action = me.cmd_refresh;
        }
        else if ('state' == expr.toLowerCase().trim()) {
            action = me.cmd_state;
        }
        else if ('toggle' == expr.toLowerCase().trim()) {
            action = me.cmd_toggle;
        }
        else if ('wait' == expr.toLowerCase().trim()) {
            action = me.cmd_wait;
        }
        else if (REGEX_CMD_ADD.test(expr.trim())) {
            // add
            action = toRegexAction(me.cmd_add,
                                   REGEX_CMD_ADD, expr.trim());
        }
        else if (REGEX_CMD_GOTO.test(expr.trim())) {
            // goto
            action = toRegexAction(me.cmd_goto,
                                   REGEX_CMD_GOTO, expr.trim());
        }
        else if (REGEX_CMD_LIST.test(expr.trim())) {
            // list
            action = toRegexAction(me.cmd_list,
                                   REGEX_CMD_LIST, expr.trim());
        }
        else if (REGEX_CMD_LOAD.test(expr.trim())) {
            // load
            action = toRegexAction(me.cmd_load,
                                   REGEX_CMD_LOAD, expr.trim());
        }
        else if (REGEX_CMD_SAVE.test(expr.trim())) {
            // save
            action = toRegexAction(me.cmd_save,
                                   REGEX_CMD_SAVE, expr.trim());
        }
        else if (REGEX_CMD_SEND.test(expr.trim())) {
            // send
            action = toRegexAction(me.cmd_send,
                                   REGEX_CMD_SEND, expr.trim());
        }
        else if (REGEX_CMD_SET.test(expr.trim())) {
            // set
            action = toRegexAction(me.cmd_set,
                                   REGEX_CMD_SET, expr.trim());
        }
        else if (REGEX_CMD_UNSET.test(expr.trim())) {
            // unset
            action = toRegexAction(me.cmd_unset,
                                   REGEX_CMD_UNSET, expr.trim());
        }

        if (action) {
            result.handled = true;
            result.body('');

            action(result);
        }
    }
}
