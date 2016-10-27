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
import { basename } from 'path';
import { DebugProtocol } from 'vscode-debugprotocol';
import FS = require('fs');
import Net = require('net');
import OS = require("os");
import Path = require('path');

/**
 * Describes a debugger entry.
 */
export interface RemoteDebuggerEntry {
    /**
     * The name of the app the entry is for.
     */
    a?: string;

    /**
     * The name of the client the entry is for.
     */
    c?: string;

    /**
     * The name of the file.
     */
    f?: string;

    /**
     * The stacktrace.
     */
    s?: RemoteDebuggerStackFrame[];

    /**
     * The list of threads.
     */
    t?: RemoteDebuggerThread[];

    /**
     * The list of variables.
     */
    v?: RemoteDebuggerVariable[];
}

/**
 * A scope.
 */
export interface RemoteDebuggerScope {
    /**
     * The name.
     */
    n?: string;

    /**
     * The reference number.
     */
    r?: number;

    /**
     * The list of debugger variables.
     */
    v?: RemoteDebuggerVariable[];
}

/**
 * A frame of a stacktrace.
 */
export interface RemoteDebuggerStackFrame {
    /**
     * The file path.
     */
    f?: string;

    /**
     * The file name.
     */
    fn?: string;
    
    /**
     * The ID.
     */
    i?: number;

    /**
     * The line in the file.
     */
    l?: number;

    /**
     * The full path of the file on the running machine.
     */
    ln?: string;

    /**
     * The name.
     */
    n?: string;

    /**
     * The list of scopes.
     */
    s?: RemoteDebuggerScope[];

    /**
     * The list of variables.
     */
    v?: RemoteDebuggerVariable[];
}

/**
 * A thread.
 */
export interface RemoteDebuggerThread {
    /**
     * The ID.
     */
    i?: number;

    /**
     * The name.
     */
    n?: string;
}

/**
 * A variable.
 */
export interface RemoteDebuggerVariable {
    /**
     * If type is 'function' this is the function name.
     */
    fn?: string;
    
    /**
     * The name.
     */
    n?: string;

    /**
     * If type is 'object' this is the object name.
     */
    on?: string;

    /**
     * The reference.
     */
    r?: number;

    /**
     * The data type.
     */
    t?: string;
    
    /**
     * The value.
     */
    v?: any;
}

/**
 * Launch request arguments.
 */
export interface LaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
    /**
     * List of allowed apps.
     */
    apps?: string[];

    /**
     * Size of a big step (back).
     */
    bigStepBack?: number;

    /**
     * Number of big steps forward.
     */
    bigStepForward?: number;

    /**
     * Name of the target clients.
     */
    clients?: string[];

    /**
     * Defines if the debugger should start in debug mode or not.
     */
    isDebug?: boolean;
    
    /**
     * Defines if the debugger starts paused or not.
     */
    isPaused?: boolean;

    /**
     * Path of the root directory of the project's sources.
     */
    localSourceRoot: string;

    /**
     * The maximum size in bytes a debug entry can have.
     */
    maxMessageSize?: number;

    /**
     * The TCP port.
     */
    port?: number;
}

/**
 * A debugger session.
 */
class RemoteDebugSession extends vscode_dbg_adapter.DebugSession {
    /**
     * Number of big steps back.
     */
    protected _bigStepBack: number;
    /**
     * Number of big steps forward.
     */
    protected _bigStepForward: number;
    /**
     * The current entry.
     */
    protected _currentEntry: number = -1;
    /**
     * Stores if debug mode is enabled or not.
     */
    protected _isDebug = false;
    /**
     * Stores if the debugger is paused or not.
     */
    protected _isPaused = false;
    /**
     * List of all loaded entries.
     */
    protected _entries: RemoteDebuggerEntry[] = [];
    /**
     * Stores the list of favorites.
     */
    protected _favorites: { index: number, entry: RemoteDebuggerEntry }[] = [];
    /**
     * The current server.
     */
    protected _server: Net.Server;
    /**
     * The root of the sources / workspace.
     */
    protected _sourceRoot: string;

    /**
     * Initializes a new instance of that class.
     */
    public constructor() {
        super();

        this.setDebuggerLinesStartAt1(false);
        this.setDebuggerColumnsStartAt1(false);
    }

    /** @inheritdoc */
    protected continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments): void {
        // this.log('continueRequest');

        this.gotoIndex(this._entries.length - 1, response);
    }

    /**
     * Gets the current entry.
     */
    public get entry(): RemoteDebuggerEntry {
        // this.log('entry');

        var ce = this._currentEntry;
        if (ce < 0 || ce >= this._entries.length) {
            return;
        }

        return this._entries[ce];
    }

    /** @inheritdoc */
    protected evaluateRequest(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments): void {
        let me = this;
        
        let expr = args.expression;
        if (!expr) {
            expr = '';
        }

        let action = () => {
            me.sendResponse(response);
        };
        let noBody = false;
        let result: any;
        let varRef: number = 0;

        let regEx_add = /^(add)([\s]?)([0-9]*)$/i;
        //TODO: let regEx_dump = /^(dump)([\s]?)([0-9]*)$/i;
        let regEx_goto = /^(goto)([\s]+)([0-9]+)$/i;
        let regEx_list = /^(list)([\s]*)([0-9]*)([\s]*)([0-9]*)$/i;
        let regEx_load = /^(load)([\s]*)([\S]*)$/i;
        let regEx_save = /^(save)([\s]*)([\S]*)$/i;
        //TODO: let regEx_send = /^(send)([\s]+)([\S]+)([\s]+)([0-9]+)$/i;

        if ('clear' == expr.toLowerCase().trim()) {
            // clear
            
            this._entries = [];
            this._favorites = [];

            result = 'Cleared';
            action = () => {
                me.gotoIndex(0, response);
            };
        }
        else if ('continue' == expr.toLowerCase().trim()) {
            // continue
            
            result = 'Running';
            action = () => {
                me._isPaused = false;
                
                me.sendResponse(response);
            };
        }
        else if ('current' == expr.toLowerCase().trim()) {
            // current
            
            result = 'Current index: ' + (this._currentEntry + 1);
            action = () => {
                me.sendResponse(response);
            };
        }
        else if ('debug' == expr.toLowerCase().trim()) {
            // debug
            
            result = 'Debug mode';
            action = () => {
                me._isDebug = true;
                
                me.sendResponse(response);
            };
        }
        else if ('favs' == expr.toLowerCase().trim()) {
            // favs

            action = () => {
                let output = '';

                if (this._favorites.length > 0) {
                    for (let i = 0; i < this._favorites.length; i++) {
                        let fav = this._favorites[i];

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

                        output += `[${fav.index}] ${file}${line}`;

                        output += "\n";
                    }
                }
                else {
                    output = 'No favorites found!\n';
                }

                me.sendResponse(response);

                me.sendEvent(new vscode_dbg_adapter.OutputEvent(output));
            };
        }
        else if ('first' == expr.toLowerCase().trim()) {
            // first
            
            let newIndex = 0;

            result = 'New index: ' + (newIndex + 1);
            action = () => {
                me.gotoIndex(newIndex, response);
            };
        }
        else if ('help' == expr.toLowerCase().trim() ||
                 '?' == expr.toLowerCase().trim()) {
            // first

            let output = ' Command                                     | Description\n';
               output += '---------------------------------------------|-----------------\n';
               output += ' ?                                           | Shows that help screen\n';
               output += ' add [$INDEX]                                | Adds the current or a specific entry as favorite\n';
               output += ' clear                                       | Removes all loaded entries and favorites\n';
               output += ' continue                                    | Continues debugging\n';
               output += ' current                                     | Displays current index\n';
               output += ' debug                                       | Runs debugger itself in "debug mode"\n';
               //TODO: output += ' dump [$INDEX]                               | Dumps an entry\n';
               output += ' favs                                        | Lists all favorites\n';
               output += ' first                                       | Jumps to first item\n';
               output += ' goto $INDEX                                 | Goes to a specific entry (beginning at 1) \n';
               output += ' help                                        | Shows that help screen\n';
               output += ' last                                        | Jumps to last entry\n';
               output += ' list [$ITEMS_TO_SKIP] [$ITEMS_TO_DISPLAY]   | Goes to a specific entry (beginning at 1) \n';
               output += ' load [$FILE]                                | Loads entries from a local JSON file\n';
               output += ' nodebug                                     | Stops running debugger itself in "debug mode"\n';
               output += ' nofavs                                      | Clears all favorites"\n';
               output += ' pause                                       | Pauses debugging (skips incoming messages)\n';
               output += ' refresh                                     | Refreshes the view\n';
               output += ' save [$FILE]                                | Saves the favorites to a local JSON file\n';
               //TODO: output += ' send $ADDR $PORT                            | Sends your favorites to a remote machine\n';
               output += ' state                                       | Displays the current debugger state\n';
               output += ' toggle                                      | Toggles "paused" state\n';
               output += ' wait                                        | Starts waiting for an entry\n';
            
            let newIndex = 0;

            action = () => {
                me.sendResponse(response);

                me.sendEvent(new vscode_dbg_adapter.OutputEvent(output));
            };
        }
        else if ('last' == expr.toLowerCase().trim()) {
            // last
            
            let newIndex = me._entries.length - 1;
            
            result = 'New index: ' + (newIndex + 1);
            action = () => {
                me.gotoIndex(newIndex, response);
            };
        }
        else if ('nodebug' == expr.toLowerCase().trim()) {
            // nodebug
            
            result = 'Debug mode leaved';
            action = () => {
                me._isDebug = false;
                
                me.sendResponse(response);
            };
        }
        else if ('nofavs' == expr.toLowerCase().trim()) {
            // nofavs
            
            this._favorites = [];

            result = 'Favorites cleared';
        }
        else if ('pause' == expr.toLowerCase().trim()) {
            // pause
            
            result = 'Paused';
            action = () => {
                me._isPaused = true;
                
                me.sendResponse(response);
            };
        }
        else if ('refresh' == expr.toLowerCase().trim()) {
            // refresh
            
            let newIndex = me._currentEntry;
            
            result = 'Current index: ' + (newIndex + 1);
            action = () => {
                me.gotoIndex(newIndex, response);
            };
        }
        else if ('state' == expr.toLowerCase().trim()) {
            // state
            
            result = me._isPaused ? 'Paused' : 'Running';
            action = () => {
                me.sendResponse(response);
            };
        }
        else if ('toggle' == expr.toLowerCase().trim()) {
            // toggle
            
            result = !me._isPaused ? 'Paused' : 'Running';
            action = () => {
                me._isPaused = !me._isPaused;

                me.sendResponse(response);
            };
        }
        else if ('wait' == expr.toLowerCase().trim()) {
            // wait

            let newIndex = me._entries.length;
            
            result = 'Waiting...';
            action = () => {
                me.gotoIndex(newIndex, response);
            };
        }
        else if (regEx_add.test(expr.trim())) {
            // add

            let match = regEx_add.exec(expr.trim());

            let index = this._currentEntry + 1;
            if ('' != match[3]) {
                index = parseInt(match[3]);
            }

            let entry: RemoteDebuggerEntry;
            if (index <= this._entries.length) {
                entry = this._entries[index - 1];
            }

            if (entry) {
                let fav = { 
                    index: index,
                    entry: entry,
                };

                let exists = false;
                for (let i = 0; i < this._favorites.length; i++) {
                    if (this._favorites[i].index == index) {
                        // do not add duplicates

                        exists = true;
                        break;
                    }
                }

                if (!exists) {
                    this._favorites.push(fav);

                    this._favorites.sort((x, y) => {
                        if (x.index > y.index) {
                            return 1;
                        }
                        if (x.index < y.index) {
                            return -1;
                        }

                        return 0;
                    });
                }

                result = 'Added ' + fav.index + ' as favorite';
            }
            else {
                if (this._entries.length > 0) {
                    result = `Please select a valid index from 1 to ${this._entries.length}!`;
                }
                else {
                    result = 'Please select an entry!';
                }
            }
        }
        /* TODO
        else if (regEx_dump.test(expr.trim())) {
            // dump

            let match = regEx_dump.exec(expr.trim());

            let index = this._currentEntry + 1;
            if ('' != match[3]) {
                index = parseInt(match[3]);
            }

            let entry: RemoteDebuggerEntry;
            if (index <= this._entries.length) {
                entry = this._entries[index - 1];
            }

            if (entry) {
                result = JSON.stringify(entry, null, 2);
            }
            else {
                if (this._entries.length > 0) {
                    result = `Please select a valid index from 1 to ${this._entries.length}!`;
                }
                else {
                    result = 'Please select an entry!';
                }
            }
        }
        */
        else if (regEx_goto.test(expr.trim())) {
            // goto

            let match = regEx_goto.exec(expr.trim());
            let newIndex = parseInt(match[3].trim());

            result = 'New index: ' + (this._currentEntry + 1);
            action = () => {
                me.gotoIndex(newIndex - 1, response);
            };
        }
        else if (regEx_list.test(expr.trim())) {
            // list

            let match = regEx_list.exec(expr.trim());

            let itemsToSkip: number = 0;
            if ('' != match[3]) {
                itemsToSkip = parseInt(match[3]);
            }

            let itemsToDisplay: number = 50;
            if ('' != match[5]) {
                itemsToDisplay = parseInt(match[5]);
            }

            let newIndex = parseInt(match[3].trim());

            action = () => {
                let output: string = '';

                let numberOfDisplayedItems = 0;
                for (let i = 0; i < itemsToDisplay; i++) {
                    let index = itemsToSkip + i;
                    if (index >= me._entries.length) {
                        // no more items to display
                        break;
                    }

                    let entry = me._entries[index];
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

                    output += `[${index + 1}] ${file}${line}`;

                    output += "\n";
                }

                if (numberOfDisplayedItems < 1) {
                    output = "No items found!\n";
                }

                me.sendResponse(response);
                
                me.sendEvent(new vscode_dbg_adapter.OutputEvent(output));
            };
        }
        else if (regEx_load.test(expr.trim())) {
            // load

            let match = regEx_load.exec(expr.trim());
            let file = match[3].trim();

            action = () => {
                let sendResponse = () => {
                    me.sendResponse(response);
                };

                let showError = (err) => {
                    me.log('[ERROR :: save()]: ' + err);
                };

                sendResponse();

                try {
                    if ('' == file) {
                        let existingFileNames = FS.readdirSync(me._sourceRoot);
                        let existingFiles: { path: string, stats: FS.Stats}[] = [];
                        for (let i = 0; i < existingFileNames.length; i++) {
                            let fileName = existingFileNames[i];
                            if (!/^(vsrd_favs_)([0-9]+)(\.json)$/i.test(fileName.trim())) {
                                continue;
                            }

                            let fullPath = Path.join(me._sourceRoot, fileName);
                            
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
                        me.sendEvent(new vscode_dbg_adapter.OutputEvent("Please select a file!"));
                        return;
                    }

                    if (!Path.isAbsolute(file)) {
                        file = Path.join(me._sourceRoot, file);
                    }

                    let loadedEntries: RemoteDebuggerEntry[] = require(file);
                    if (loadedEntries && loadedEntries.length) {
                        let loadedEntryCount = 0;
                        for (let i = 0; i < loadedEntries.length; i++) {
                            let entry = loadedEntries[i];
                            if (entry) {
                                me._entries.push(entry);
                                ++loadedEntryCount;
                            }
                        }

                        if (loadedEntries.length > 0) {
                            me.sendEvent(new vscode_dbg_adapter.OutputEvent(`Loaded ${loadedEntryCount} entries from '${file}'`));

                            me.gotoIndex(me._currentEntry);
                        }
                    }
                }
                catch (e) {
                    showError(e);
                }
            };
        }
        else if (regEx_save.test(expr.trim())) {
            // save

            let match = regEx_save.exec(expr.trim());
            let file = match[3].trim();

            action = () => {
                let sendResponse = () => {
                    me.sendResponse(response);
                };

                let showError = (err) => {
                    me.log('[ERROR :: save()]: ' + err);
                };

                if (me._favorites.length > 0) {
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

                                    fullPath = Path.join(this._sourceRoot, fileName);

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
                            file = Path.join(this._sourceRoot, file);
                        }

                        let saveFavs = () => {
                            sendResponse();

                            try {
                                let jsons: string[] = [];

                                for (let i = 0; i < me._favorites.length; i++) {
                                    let fav = me._favorites[i];
                                    if (!fav) {
                                        continue;
                                    }

                                    jsons.push(JSON.stringify(fav.entry, null, 2));
                                }

                                FS.writeFileSync(file, '[\n' + jsons.join(', ') + '\n]', {
                                    encoding: 'utf8'
                                });

                                me.sendEvent(new vscode_dbg_adapter.OutputEvent(`Saved favorites to '${file}'`));
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
                        sendResponse();
                        
                        showError(e);
                    }
                }
                else {
                    sendResponse();
                    
                    me.sendEvent(new vscode_dbg_adapter.OutputEvent("No favorites available."));
                }
            }
        }
        /* TODO
        else if (regEx_send.test(expr.trim())) {
            // send

            action = () => {
                let match = regEx_send.exec(expr.trim());

                let host = match[3].toLowerCase().trim();
                let port = parseInt(match[5].trim());

                let output = '';

                me.sendResponse(response);

                if (me._favorites.length > 0) {
                    let showError = (err) => {
                        me.sendEvent(new vscode_dbg_adapter.OutputEvent('[ERROR :: send()]: ' + err + '\n'));
                    };

                    for (let i = 0; i < me._favorites.length; i++) {
                        try {
                            let json = new Buffer(JSON.stringify(me._favorites[i].entry),
                                                  'utf8');

                            let dataLength = Buffer.alloc(4);
                            dataLength.writeUInt32LE(json.length, 0);

                            var client = new Net.Socket();

                            client.on('error', function(err) {
                                showError(err);
                            });

                            client.connect(port, host, () => {
                                try {
                                    client.write(dataLength);
                                    client.write(json);

                                    client.destroy();

                                    me.sendEvent(new vscode_dbg_adapter.OutputEvent(`Send favorites to '${host}:${port}'\n`));
                                }
                                catch (e) {
                                    showError(e);
                                }
                            });
                        }
                        catch (e) {
                            showError(e);
                        }
                    }
                }
                else {
                    me.sendEvent(new vscode_dbg_adapter.OutputEvent('Nothing to send!\n'));
                }
            };
        }
        */
        else {
            noBody = true;
        }

        if (!noBody) {
            response.body = {
                result: result,
                variablesReference: varRef,
            };
        }

        if (action) {
            action();
        }
    }

    /**
     * Returns the value and type of a variable to display.
     * 
     * @param {RemoteDebuggerVariable} [ve] The variable.
     * 
     * @return {Object} The type and display.
     */
    protected getDisplayVariable(ve?: RemoteDebuggerVariable): { type?: string, value?: any } {
        if (!ve) {
            return { };
        }

        let t = ve.t;
        let v = ve.v;

        switch (this.normalizeType(ve.t)) {
            case 'array':
                t = "string";
                
                v = "[ARRAY";
                if (ve.v) {
                    v += ` (${ve.v.length})`;    
                }
                v += "]";
                break;
            
            case 'function':
                t = "string";
                
                v = "[FUNCTION ";
                if (ve.fn) {
                    v += ` ${ve.fn}()`;    
                }
                v += "]";
                break;

            case 'object':
                t = "string";
                v = "[OBJECT";
                if (ve.on) {
                    v += ` :: ${ve.on}`;
                }
                v += "]";
                break;
        }
        
        return {
            type: t,
            value: v,
        };
    }

    /**
     * Goes to a specific index.
     * 
     * @param {number} [newIndex] The new index (if defined).
     * @param {DebugProtocol.Response} [response] The response to send.
     */
    protected gotoIndex(newIndex?: number, response?: DebugProtocol.Response) {
        if (arguments.length < 1) {
            newIndex = this._entries.length;
        }
        
        if (newIndex < 0) {
            newIndex = 0;
        }
        if (newIndex > this._entries.length) {
            newIndex = this._entries.length;
        }

        this._currentEntry = newIndex;

        if (response) {
            this.sendResponse(response);
        }

        var newEntry = this.entry;
        if (newEntry) {
            this.sendEvent(new vscode_dbg_adapter.StoppedEvent("step", 1));
        }
        else {
            this.sendEvent(new vscode_dbg_adapter.StoppedEvent("pause", 1));
        }
    }

    /** @inheritdoc */
    protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {
        // this.log('initializeRequest');
        
        response.body.supportsConfigurationDoneRequest = true;

        response.body.supportsCompletionsRequest = false;
        response.body.supportsConditionalBreakpoints = false;
        response.body.supportsConfigurationDoneRequest = false;
        response.body.supportsEvaluateForHovers = false;
        response.body.supportsFunctionBreakpoints = false;
        response.body.supportsGotoTargetsRequest = false;
        response.body.supportsHitConditionalBreakpoints = false;
        response.body.supportsRestartFrame = false;
        response.body.supportsSetVariable = false;
        response.body.supportsStepBack = true;
        response.body.supportsStepInTargetsRequest = false;

        this.sendResponse(response);
    }

    /** @inheritdoc */
    protected launchRequest(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments): void {
        // this.log('launchRequest');
        
        let me = this;

        me._sourceRoot = args.localSourceRoot;

        this.startServer({
            apps: args.apps,
            bigSteps: {
                back: args.bigStepBack,
                forward: args.bigStepForward,
            },
            clients: args.clients,
            completed: () => {
                me.sendEvent(new vscode_dbg_adapter.InitializedEvent());

                me.sendResponse(response);
            },
            isDebug: args.isDebug ? true : false,
            isPaused: args.isPaused ? true : false,
            maxMessageSize: args.maxMessageSize,
            port: args.port,
        });
    }

    /**
     * Logs a message.
     * 
     * @param {any} msg The message to log.
     */
    protected log(msg) {
        this.sendEvent(new vscode_dbg_adapter.OutputEvent('[vs-remote-debugger] ' + msg + '\n'));
    }

    /** @inheritdoc */
    protected nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): void {
        // this.log('nextRequest');
        
        let steps = this._bigStepForward;
        if (!steps) {
            steps = this._bigStepBack;
        }
        if (!steps) {
            steps = 10;
        }

        this.gotoIndex(this._currentEntry + steps, response);
    }

    /**
     * Normalizes a type name.
     * 
     * @param {String} [type] The input value.
     * 
     * @return {String} The output value.
     */
    protected normalizeType(type?: string): string {
        if (!type) {
            return type;
        }

        return ('' + type).toLowerCase().trim();
    }

    /** @inheritdoc */
    protected pauseRequest(response: DebugProtocol.PauseResponse, args: DebugProtocol.PauseArguments): void {
        // this.log('pauseRequest');
    }

    /** @inheritdoc */
    protected scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments): void {
        // this.log('scopesRequest');

        const SCOPES: vscode_dbg_adapter.Scope[] = [];

        let entry = this.entry;
        if (entry && entry.s)
        {
            let index = this._currentEntry;
            let entryCount = this._entries.length;

            for (let i = 0; i < entry.s.length; i++) {
                let sf = entry.s[i];
                if (!sf) {
                    continue;
                }

                if (sf.i == args.frameId) {
                    if (sf.s) {
                        for (let j = 0; j < sf.s.length; j++) {
                            let s = sf.s[j];
                            if (!s) {
                                continue;
                            }

                            let name = s.n;
                            if (!name) {
                                name = '';
                            }

                            SCOPES.push(new vscode_dbg_adapter.Scope(`${name} (${index + 1} / ${entryCount})`,
                                                                     s.r));
                        }
                    }
                }
            }
        }

        response.body = {
            scopes: SCOPES
        };

        this.sendResponse(response);
    }

    /** @inheritdoc */
    protected setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): void {
        this.log('setBreakPointsRequest: ' + args.breakpoints.length);
    }

    /** @inheritdoc */
    protected stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments): void {
        // this.log('stackTraceRequest');

        const FRAMES: vscode_dbg_adapter.StackFrame[] = [];

        let entry = this.entry;
        if (entry && entry.s) {
            for (let i = 0; i < entry.s.length; i++) {
                let sf = entry.s[i];
                if (!sf) {
                    continue;
                }

                let src: vscode_dbg_adapter.Source;
                if (sf.f) {
                    let fileName: string = sf.fn;
                    if (!fileName) {
                        fileName = basename(sf.f);
                    }

                    src = new vscode_dbg_adapter.Source(fileName,
                                                        Path.join(this._sourceRoot, sf.f));
                }

                FRAMES.push(new vscode_dbg_adapter.StackFrame(sf.i, sf.n, src, sf.l));
            }
        }

        response.body = {
            stackFrames: FRAMES,
            totalFrames: FRAMES.length
        };

        this.sendResponse(response);
    }

    /** @inheritdoc */
    protected startServer(opts: any) {
        // this.log('startServer');

        if (!opts) {
            opts = {};
        }

        let me = this;

        let port = 5979;
        if (opts.port) {
            port = opts.port;
        }

        let maxMsgSize = 16777215;
        if (opts.maxMessageSize) {
            maxMsgSize = opts.maxMessageSize;
        }

        // clients
        let clients: string[] = [];
        if (opts.clients) {
            for (let i = 0; i < opts.clients.length; i++) {
                let c = opts.clients[i];
                if (!c) {
                    continue;
                }

                c = ('' + c).toLowerCase().trim();
                if ('' !== c) {
                    clients.push(c);
                }
            }
        }

        // apps
        let apps: string[] = [];
        if (opts.apps) {
            for (let i = 0; i < opts.apps.length; i++) {
                let a = opts.apps[i];
                if (!a) {
                    continue;
                }

                a = ('' + a).toLowerCase().trim();
                if ('' !== a) {
                    apps.push(a);
                }
            }
        }

        me._currentEntry = -1;

        let invokeCompleted = (err?: any) => {
            if (opts.completed) {
                opts.completed(err);
            }
        };

        let showError = (err, category: string) => {
            me.log('[ERROR :: TCP Server :: ' + category + '] ' + err);
        };

        if (opts.bigSteps) {
            me._bigStepBack = opts.bigSteps.back;
            me._bigStepForward = opts.bigSteps.forward;    
        }

        me._isDebug = opts.isDebug ? true : false;
        me._isPaused = opts.isPaused ? true : false;

        let newServer = Net.createServer((socket) => {
            try {
                let closeSocket = () => {
                    try {
                        socket.destroy();
                    }
                    catch (e) {
                        showError(e, 'createServer.closeSocket');
                    }
                };

                let remoteAddr = socket.remoteAddress;
                let remotePort = socket.remotePort;

                let buff: Buffer;

                let buffOffset = 0;
                socket.on('data', (data: Buffer) => {
                    try {
                        if (!data || data.length < 1) {
                            return;
                        }

                        let offset = 0;
                        if (!buff) {
                            let dataLength = data.readUInt32LE(0);
                            if (dataLength < 0 || dataLength > maxMsgSize) {
                                closeSocket();
                                return;
                            }

                            buff = Buffer.alloc(dataLength);
                            offset = 4;
                        }

                        // check for possible overflow
                        let newBufferOffset = buffOffset + data.length;
                        if (newBufferOffset >= maxMsgSize) {
                            closeSocket();
                            return;
                        }

                        buffOffset += data.copy(buff, buffOffset,
                                                offset);
                    }
                    catch (e) {
                        showError(e, 'createServer.data');

                        closeSocket();
                    }
                });

                socket.on('end', () => {
                    try {
                        if (!buff || buff.length < 1) {
                            return;
                        }

                        let json = buff.toString('utf8');

                        let entry: RemoteDebuggerEntry = JSON.parse(json);
                        if (!entry) {
                            return;
                        }

                        if (me._isPaused) {
                            return;
                        }

                        let addEntry = true;

                        // check for client
                        if (addEntry && entry.c) {
                            let targetClient = ('' + entry.c).toLowerCase().trim();
                            if ('' != targetClient) {
                                if (clients.length > 0) {
                                    addEntry = false;
                                    for (let i = 0; i < clients.length; i++) {
                                        if (clients[i] == targetClient) {
                                            addEntry = true;
                                            break;
                                        }
                                    }
                                }
                            }
                        }

                        // check for apps
                        if (addEntry && entry.a) {
                            let appName = ('' + entry.a).toLowerCase().trim();
                            if ('' != appName) {
                                if (apps.length > 0) {
                                    addEntry = false;
                                    for (let i = 0; i < apps.length; i++) {
                                        if (apps[i] == appName) {
                                            addEntry = true;
                                            break;
                                        }
                                    }
                                }
                            }
                        }

                        if (!addEntry) {
                            return;
                        }

                        let makeStep = !me.entry ? true : false;
                        
                        me._entries.push(entry);

                        if (me._isDebug) {
                            me.log(`Got entry #${me._entries.length} from '${remoteAddr}:${remotePort}'`);
                        }
                        
                        if (!makeStep) {
                            return;
                        }

                        // select last entry
                        me._currentEntry = me._entries.length - 1;
                        me.sendEvent(new vscode_dbg_adapter.StoppedEvent("step", 1));
                    }
                    catch (e) {
                        showError(e, 'createServer.end');
                    }
                });
            }
            catch (e) {
                showError(e, "createServer");
            }
        });

        newServer.on('listening', (err) => {
            if (!err) {
                me._server = newServer;

                me.log('TCP server started on port ' + port);

                if (apps.length > 0) {
                    me.log('App filters: ' + apps.join(', '));
                }
                
                if (clients.length > 0) {
                    me.log('Client filters: ' + clients.join(', '));
                }

                if (me._isPaused) {
                    me.log('PAUSED');
                }
            }
            else {
                showError(err, "listening");
            }

            invokeCompleted(err);
        });
        newServer.on('error', (err) => {
            if (err) {
                showError(err, "error");
            }
        });
        newServer.listen(port);
    }

    /** @inheritdoc */
    protected stepBackRequest(response: DebugProtocol.StepBackResponse, args: DebugProtocol.StepBackArguments): void {
        // this.log('stepBackRequest');

        let steps = this._bigStepBack;
        if (!steps) {
            steps = this._bigStepForward;
        }
        if (!steps) {
            steps = 10;
        }

        this.gotoIndex(this._currentEntry - steps, response);
    }

    /** @inheritdoc */
    protected stepInRequest(response: DebugProtocol.StepInResponse, args: DebugProtocol.StepInArguments): void {
        // this.log('stepInRequest');

        this.gotoIndex(this._currentEntry + 1, response);
    }

    /** @inheritdoc */
    protected stepOutRequest(response: DebugProtocol.StepOutResponse, args: DebugProtocol.StepOutArguments): void {
        // this.log('stepOutRequest');
        
        this.gotoIndex(this._currentEntry - 1, response);
    }

    /** @inheritdoc */
    protected stopServer() {
        // this.log('stopServer');

		let me = this;

		let srv = this._server;
		if (!srv) {
			return;
		}

		let showError = (err, category: string) => {
            me.log('[ERROR :: TCP Server :: ' + category + '] ' + err);
        };

		try {
			srv.close(function(err) {
				if (err) {
					showError(err, "close");
					return;
				}

				me._server = null;
				me.log('TCP server has stopped.');
			});
		}
		catch (e) {
			showError(e, "close");
		}
    }
    
    /** @inheritdoc */
    protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
        // this.log('threadsRequest');

        const THREADS = [];

        let entry = this.entry;
        if (entry && entry.t) {
            for (let i = 0; i < entry.t.length; i++) {
                let t = entry.t[i];
                if (!t) {
                    continue;
                }

                THREADS.push(new vscode_dbg_adapter.Thread(t.i, t.n));
            }
        }

        response.body = {
            threads: THREADS
        };

        this.sendResponse(response);
    }

    /** @inheritdoc */
    protected variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments): void {
        // this.log('variablesRequest: ' + args.variablesReference);

        let me = this;

        const VARIABLES: DebugProtocol.Variable[] = [];

        let addVariables = (v?: RemoteDebuggerVariable[]): boolean => {
            if (!v) {
                return false;
            }

            for (let i = 0; i < v.length; i++) {
                let ve = v[i];
                if (!ve) {
                    continue;
                }

                let dv = me.getDisplayVariable(ve);

                VARIABLES.push({
                    name: ve.n,
                    type: dv.type,
                    value: dv.value,
                    variablesReference: ve.r,
                });
            }

            return true;
        };

        let entry = this.entry;
        
        if (1 != args.variablesReference) {
            let findChildVariables: (ve?: RemoteDebuggerVariable) => RemoteDebuggerVariable[];
            findChildVariables = (ve?) => {
                if (ve) {
                    if (ve.r > 1) {
                        if (ve.r == args.variablesReference) {
                            return ve.v;
                        }

                        let foundChildren: RemoteDebuggerVariable[];
                        
                        // first check if special type
                        if (!foundChildren) {
                            switch (me.normalizeType(ve.t)) {
                                case 'array':
                                case 'function':
                                case 'object':
                                    if (!foundChildren && ve.v) {
                                        for (let i = 0; i < ve.v.length; i++) {
                                            foundChildren = findChildVariables(ve.v[i]);
                                            if (foundChildren) {
                                                break;
                                            }
                                        }
                                    }
                                    break;
                            }
                        }

                        if (!foundChildren) {
                            // now search for children

                            let children: RemoteDebuggerVariable[] = ve.v;
                            if (children) {
                                for (let i = 0; i < children.length; i++) {
                                    let c = children[i];

                                    foundChildren = findChildVariables(c);
                                    if (foundChildren) {
                                        break;
                                    }
                                }
                            }
                        }

                        if (foundChildren) {
                            return foundChildren;
                        }
                    }
                }

                return null;
            };

            if (entry) {
                let vars: RemoteDebuggerVariable[];

                if (!vars && entry.v) {
                    for (let i = 0; i < entry.v.length; i++) {
                        let ve = entry.v[i];
                        vars = findChildVariables(ve);

                        if (vars) {
                            break;
                        }
                    }
                }

                if (!vars && entry.s) {
                    // search in stack frames
                    for (let i = 0; i < entry.s.length; i++) {
                        let sf = entry.s[i];
                        if (!sf) {
                            continue;
                        }

                        // search in frame variables
                        if (sf.v) {
                            for (let j = 0; j < sf.v.length; j++) {
                                vars = findChildVariables(sf.v[j]);
                                if (vars) {
                                    break;
                                }
                            }
                        }

                        // now search in scopes
                        if (!vars && sf.s) {
                            for (let j = 0; j < sf.s.length; j++) {
                                let s = sf.s[j];
                                if (!s) {
                                    continue;
                                }

                                // scope itself
                                if (s.r == args.variablesReference) {
                                    vars = s.v;
                                    break;
                                }

                                // its variables
                                if (s.v) {
                                    for (let k = 0; k < s.v.length; k++) {
                                        vars = findChildVariables(s.v[k]);
                                        if (vars) {
                                            break;
                                        }
                                    }
                                }
                            }
                        }

                        if (vars) {
                            break;
                        }
                    }
                }

                addVariables(vars);
            }
        }
        else {
            // 1 => global variables

            if (entry) {
                addVariables(entry.v);
            }
        }

        response.body = {
            variables: VARIABLES
        };

        this.sendResponse(response);
    }
}

vscode_dbg_adapter.DebugSession.run(RemoteDebugSession);
