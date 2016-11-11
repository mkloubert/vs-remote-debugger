/// <reference types="node" />

// The MIT License (MIT)
// 
// vs-remote-debugger (https://github.com/mkloubert/vs-remote-debugger)
// Copyright (c) Marcel Joachim Kloubert <marcel.kloubert@gmx.net>
// 
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
// 
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
// 
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
// DEALINGS IN THE SOFTWARE.

import * as vscode_dbg_adapter from 'vscode-debugadapter';
import * as vsrd_contracts from './contracts';
import * as vsrd_helpers from './helpers';
import { DebugProtocol } from 'vscode-debugprotocol';
import FS = require('fs');
import OS = require('os');
import Path = require('path');
import Net = require('net');

const DEFAULT_FILENAME_FORMAT = 'vsrd_favs_${timestamp}';

// List of wiki pages for commands
// 
// key: command name
// value: if defined: the suffix of the page name
const COMMAND_WIKI_PAGES = {
    '?': 'help_screen',
    '+': 'next_message',
    '-': 'prev_message',
    'add': null,
    'all': null,
    'clear': null,
    'continue': null,
    'counter': null,
    'current': null,
    'debug': null,
    'disable': null,
    'donate': null,
    'exec': null,
    'favs': null,
    'find': null,
    'first': null,
    'friends': null,
    'github': null,
    'goto': null,
    'help': null,
    'history': null,
    'issue': 'issues',
    'issues': null,
    'last': null,
    'list': null,
    'load': null,
    'log': null,
    'me': null,
    'new': null,
    'next': null,
    'nodebug': null,
    'nofavs': 'none',
    'none': null,
    'pause': null,
    'plugins': null,
    'refresh': null,
    'regex': null,
    'remove': null,
    'reset': null,
    'save': null,
    'search': 'find',
    'send': null,
    'set': null,
    'share': null,
    'sort': null,
    'state': null,
    'toggle': null,
    'trim': null,
    'twitter': null,
    'unset': null,
};

const REGEX_CMD_ADD = /^(add)(\s+.*)?$/i;
const REGEX_CMD_COUNTER = /^(counter)([\s]*)([0-9]*)([\s]*)(pause)?$/i;
const REGEX_CMD_DISABLE = /^(disable)([\s]*)(pause)?$/i;
const REGEX_CMD_EXEC = /^(exec)([\s]+)([\S]+)([\s]?)(.*)$/i;
const REGEX_CMD_FIND = /^(find|search)(\s+.*)?$/i;
const REGEX_CMD_GOTO = /^(goto)([\s]+)([0-9]+)$/i;
const REGEX_CMD_HELP = /^(help)(\s+.*)?$/i;
const REGEX_CMD_HISTORY = /^(history)(\s+.*)?$/i;
const REGEX_CMD_LIST = /^(list)([\s]*)([0-9]*)([\s]*)([0-9]*)$/i;
const REGEX_CMD_LOAD = /^(load)(\s+.*)?$/i;
const REGEX_CMD_LOG = /^(log)(\s+.*)?$/i;
const REGEX_CMD_NEW = /^(new)([\s]*)([0-9]*)([\s]*)([0-9]*)$/i;
const REGEX_CMD_REGEX = /^(regex)(\s+.*)?$/i;
const REGEX_CMD_REMOVE = /^(remove)(\s+.*)?$/
const REGEX_CMD_RESET = /^(reset)([\s]*)(pause)?$/i;
const REGEX_CMD_SAVE = /^(save)(\s+.*)?$/i;
const REGEX_CMD_SHARE = /^(share)([\s]*)(.*)$/i;
const REGEX_CMD_SEND = /^(send)([\s]+)([\S]+)([\s]*)([0-9]*)$/i;
const REGEX_CMD_SET = /^(set)(\s+.*)?$/i;
const REGEX_CMD_TEST = /^(test)([\s]?)(.*)$/i;  //TODO: test code
const REGEX_CMD_UNSET = /^(unset)(\s+.*)?$/i;
const REGEX_UNKNOWN_CMD = /^([\S]*)(\s+.*)?$/i;

const URL_ISSUES_GITHUB = 'https://github.com/mkloubert/vs-remote-debugger/issues';
const URL_PAYPAL_DONATE = 'https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=GFV9X2A64ZK3Y';
const URL_PROJECT_GITHUB = 'https://github.com/mkloubert/vs-remote-debugger';
const URL_TWITTER = 'https://twitter.com/mjkloubert';

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
     * Gets or sets the current counter value.
     */
    counter: (newValue?: number | boolean) => number | boolean;

    /**
     * Gets the initial counter value from the config.
     */
    counterStart: () => number | boolean;

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
    entries(entries?: vsrd_contracts.RemoteDebuggerEntry[]): vsrd_contracts.Enumerable<vsrd_contracts.RemoteDebuggerEntry>;

    /**
     * Gets or sets the list of favorites.
     */
    favorites(favorites?: vsrd_contracts.RemoteDebuggerFavorite[]): vsrd_contracts.Enumerable<vsrd_contracts.RemoteDebuggerFavorite>;

    /**
     * Gets the format that is used to generate names for message files.
     */
    filenameFormat(): string;

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
     * Gets the nickname.
     */
    nick(): string;

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
    write(msg: any);

    /**
     * Writes to output and adds a new line.
     */
    writeLine(msg?: any);

    /**
     * Sends a response.
     */
    sendResponse: (response?: DebugProtocol.EvaluateResponse) => void;
}

interface DisplayableEntry {
    entry: vsrd_contracts.RemoteDebuggerEntry;
    index: number;
}

interface VariableFinder {
    findNext(): Promise<VariableFinderResult>
}

interface VariableFinderResult {
    entry: vsrd_contracts.RemoteDebuggerEntry;
    index: number;
    variables: vsrd_contracts.RemoteDebuggerVariable[];
}

/**
 * A debugger console manager.
 */
export class ConsoleManager {
    /**
     * The underlying debugger context.
     */
    protected _context: vsrd_contracts.DebuggerContext;
    private _currentFindIndex;
    private _varFinder: VariableFinder;

    /**
     * Initializes a new instance of that class.
     * 
     * @param {vscode_dbg_adapter.DebugSession} session The underlying session.
     */
    constructor(session: vsrd_contracts.DebuggerContext) {
        this._context = session;
    }

    /**
     * 'about' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     */
    protected cmd_about(result: ExecuteCommandResult): void {
        // version
        let appVersion: string;
        let displayName: string;
        try {
             let packageFile = JSON.parse(FS.readFileSync(Path.join(__dirname, '../../package.json'), 'utf8'));

             appVersion = packageFile.version;
             displayName = packageFile.displayName;
        }
        catch (e) {
            // ignore
        }

        if (appVersion) {
            appVersion = ' v' + ('' + appVersion).trim();
        }
        else {
            appVersion = '';
        }

        if (!displayName) {
            displayName = 'Generic Remote Debugger';
        }

        let firstLine = `${displayName} (vs-remote-debugger)${appVersion}`;
        let secondLine = '='.repeat(firstLine.length + 5);

        let output = `\n${firstLine}\n`;
        output += `${secondLine}\n`;
        output += 'Created by Marcel Joachim Kloubert <marcel.kloubert@gmx.net>\n';
        output += '\n';
        output += 'Twitter: @mjkloubert\n';
        output += 'GitHub: https://github.com/mkloubert\n';

        result.writeLine(output);

        result.body(Path.join(__dirname, '../../package.json'));
        result.sendResponse();
    }

    /**
     * 'add' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     * @param {RegExpExecArray} match Matches of the execution of a regular expression.
     * @param {ConsoleManager} me The underlying console manager.
     */
    protected cmd_add(result: ExecuteCommandResult, match: RegExpExecArray, me: ConsoleManager): void {
        let entries = result.entries().toArray();
        let favorites = result.favorites().toArray();

        let listOfRanges = match[2];
        if (listOfRanges) {
            listOfRanges = listOfRanges.trim();
        }
        if (!listOfRanges) {
            listOfRanges = '';
        }

        let ranges = me.toNumberRanges(listOfRanges);
        if (ranges.length < 1) {
            if (result.currentEntry()) {
                ranges = me.toNumberRanges(`${result.currentIndex() + 1}`);
            }
            else {
                ranges = null;

                if (entries.length > 0) {
                    result.body(`Please select valid indexes from 1 to ${entries.length}!`);
                }
                else {
                    result.body('Please select an entry!');
                }
            }
        }

        if (null !== ranges) {
            let addedFavs: number[] = [];

            for (let i = 0; i < ranges.length; i++) {
                let r = ranges[i];

                for (let j = 0; j < entries.length; j++) {
                    let index = j + 1;
                    if (!r.isInRange(index)) {
                        continue;
                    }

                    let exists = false;
                    for (let k = 0; k < favorites.length; k++) {
                        if (favorites[k].index == index) {
                            // do not add duplicates

                            exists = true;
                            break;
                        }
                    }

                    if (exists) {
                        continue;   
                    }

                    let fav: vsrd_contracts.RemoteDebuggerFavorite = { 
                        index: index,
                        entry: entries[j],
                    };

                    favorites.push(fav);
                    addedFavs.push(fav.index);
                }
            }

            if (addedFavs.length > 0) {
                favorites.sort((x, y) => {
                    if (x.index > y.index) {
                        return 1;
                    }
                    if (x.index < y.index) {
                        return -1;
                    }

                    return 0;
                });

                result.body(`The following ${addedFavs.length} favorites were added: ${addedFavs.sort().join(',')}`);
            }
            else {
                result.body('No favorites added');
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
        let entries = result.entries().toArray();
        
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
     * 'counter' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     * @param {RegExpExecArray} match Matches of the execution of a regular expression.
     * @param {ConsoleManager} me The underlying console manager.
     */
    protected cmd_counter(result: ExecuteCommandResult, match: RegExpExecArray, me: ConsoleManager): void {
        let newValue: any = <number>result.counterStart();
        if (match[3] && match[3].trim()) {
            newValue = parseInt(match[3].trim());
        }

        if (false !== newValue && !isNaN(newValue)) {
            result.counter(newValue);
        
            let suffix: string = " and continued debugging";
            let isPaused = false;

            if (match[5]) {
                if ('pause' == match[5].toLowerCase().trim()) {
                    isPaused = true;
                    suffix = " and switch to 'pause' mode";
                }
            }

            result.isPaused(isPaused);

            result.body(`Enabled counter with ${newValue}${suffix}`);
        }
        else {
            result.body('Please define a counter value!');
        }
        
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
     * 'disable' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     * @param {RegExpExecArray} match Matches of the execution of a regular expression.
     * @param {ConsoleManager} me The underlying console manager.
     */
    protected cmd_disable(result: ExecuteCommandResult, match: RegExpExecArray, me: ConsoleManager): void {
        result.counter(false);

        let suffix: string = " and continued debugging";
        let isPaused = false;

        if (match[3]) {
            if ('pause' == match[3].toLowerCase().trim()) {
                isPaused = true;
                suffix = " and switch to 'pause' mode";
            }
        }

        result.isPaused(isPaused);

        result.body('Disabled counter' + suffix);
        result.sendResponse();
    }

    /**
     * 'donate' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     */
    protected cmd_donate(result: ExecuteCommandResult): void {
        try {
            const opn = require('opn');
            opn(URL_PAYPAL_DONATE);

            result.body(`Opening donation page on PayPal (${URL_PAYPAL_DONATE})...`);
        }
        catch (e) {
            result.body('Could not open donation page! Try opening the following url manually: ' + URL_PAYPAL_DONATE);
        }

        result.sendResponse();
    }

    /**
     * 'exec' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     * @param {RegExpExecArray} match Matches of the execution of a regular expression.
     * @param {ConsoleManager} me The underlying console manager.
     */
    protected cmd_exec(result: ExecuteCommandResult, match: RegExpExecArray, me: ConsoleManager): void {
        try {
            let cmd = match[3];
            if (cmd) {
                cmd = cmd.toLowerCase().trim();
            }
            if (!cmd) {
                cmd = '';
            }
            
            let args = match[5];
            if (!args) {
                args = '';
            }

            let executedCommands = 0;
            let plugins = me._context.plugins().toArray();
            for (let i = 0; i < plugins.length; i++) {
                let p = plugins[i].plugin;
                if (p.commands && p.execute) {
                    let execCtx: vsrd_contracts.DebuggerPluginExecutionContext;
                    
                    let supportedCommands = p.commands();
                    if (supportedCommands) {
                        for (let j = 0; j < supportedCommands.length; j++) {
                            let originalName = supportedCommands[j];
                            if (!originalName) {
                                continue;
                            }

                            let name = originalName.toLowerCase().trim();
                            if (name == cmd) {
                                execCtx = {
                                    arguments: args,
                                    name: originalName,

                                    write: function(msg) {
                                        result.write(msg);
                                        return this;
                                    },

                                    writeLine: function(msg) {
                                        result.writeLine(msg);
                                        return this;
                                    }
                                };

                                break;
                            }
                        }
                    }

                    if (execCtx) {
                        ++executedCommands;

                        let r = p.execute(execCtx);
                        if (r) {
                            result.body(r);
                        }
                    }
                }
            }

            if (executedCommands < 1) {
                let bestMatch: {
                    command: string;
                    plugin: vsrd_contracts.DebuggerPluginEntry,
                    similarity: number,
                };

                // try find similar commands
                for (let i = 0; i < plugins.length; i++) {
                    let pe = plugins[i];
                    let p = pe.plugin;

                    if (p.commands && p.execute) {
                        let supportedCommands = p.commands();
                        if (supportedCommands) {
                            for (let j = 0; j < supportedCommands.length; j++) {
                                let sc = supportedCommands[j];
                                if (sc) {
                                    sc = ('' + sc).toLowerCase().trim();
                                }

                                if (!sc) {
                                    continue;
                                }

                                let sim = vsrd_helpers.getStringSimilarity(cmd, sc);
                                if (sim < 0.5) {
                                    continue;
                                }

                                let updateMatch = true;
                                if (bestMatch) {
                                    updateMatch = sim > bestMatch.similarity;
                                }

                                if (updateMatch) {
                                    bestMatch = {
                                        command: sc,
                                        plugin: pe,
                                        similarity: sim,
                                    };
                                }
                            }
                        }
                    }
                }

                if (bestMatch) {
                    let pluginName: string;
                    if (bestMatch.plugin.plugin.info) {
                        let pluginInfo = bestMatch.plugin.plugin.info();

                        if (pluginInfo && pluginInfo.name) {
                            pluginName = ('' + pluginInfo.name).trim();
                        }
                    }
                        
                    if (!pluginName) {
                       pluginName = bestMatch.plugin.name;
                    }

                    result.body(`Plugin command '${cmd}' was not found! Did you mean '${bestMatch.command}' by '${pluginName}' (${bestMatch.plugin.file.name})?`);
                }
                else {
                    result.body(`Plugin command '${cmd}' was not found!`);
                }
            }
        }
        catch (e) {
            result.body('Execution error: ' + e);
        }

        result.sendResponse();
    }

    /**
     * 'favs' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     * @param {ConsoleManager} me The underlying console manager.
     */
    protected cmd_favs(result: ExecuteCommandResult, me: ConsoleManager): void {
        let favorites = result.favorites().toArray();
        let totalCount = 0;
        
        let entriesToDisplay: DisplayableEntry[] = [];
        if (favorites) {
            totalCount = favorites.length;

            for (let i = 0; i < favorites.length; i++) {
                let fav = favorites[i];
                if (fav && fav.entry) {
                    entriesToDisplay.push({
                        entry: fav.entry,
                        index: fav.index,
                    });
                }
            }
        }
        
        me.displayEntries(result,
                          entriesToDisplay, totalCount);

        result.sendResponse();
    }

    /**
     * 'find' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     * @param {RegExpExecArray} match Matches of the execution of a regular expression.
     * @param {ConsoleManager} me The underlying console manager.
     */
    protected cmd_find(result: ExecuteCommandResult, match: RegExpExecArray, me: ConsoleManager): void {
        let expr =  vsrd_helpers.normalizeString(match[2]);
        if (expr) {
            let parts = expr.split(' ').map((x) => {
                return x.toLowerCase().trim();
            }).filter((x) => {
                return x ? true : false;
            });

            me._currentFindIndex = -1;

            me._varFinder = {
                findNext: () => {
                    return new Promise<VariableFinderResult>((resolve, reject) => {
                        try {
                            let findRes: VariableFinderResult;

                            let entries = result.entries().toArray();
                            if (entries.length > 0) {
                                ++me._currentFindIndex;
                                if (me._currentFindIndex >= entries.length) {
                                    me._currentFindIndex = 0;
                                }

                                for (let i = 0; i < entries.length; i++) {
                                    let index = (me._currentFindIndex + i) % entries.length;
                                    
                                    let e = entries[index];
                                    if (!e) {
                                        continue;
                                    }

                                    let vars = e.v;
                                    if (!vars) {
                                        continue;
                                    }

                                    let matchingVars: vsrd_contracts.RemoteDebuggerVariable[] = [];

                                    for (let j = 0; j < vars.length; j++) {
                                        let v = vars[j];
                                        if (!v) {
                                            continue;
                                        }

                                        let allDoMatch = true;
                                        let strToSearchIn = JSON.stringify(v).toLowerCase().trim();
                                        for (let k = 0; k < parts.length; k++) {
                                            let p = parts[k];
                                            
                                            if (strToSearchIn.indexOf(p) < 0) {
                                                allDoMatch = false;
                                                break;
                                            }
                                        }

                                        if (allDoMatch) {
                                            matchingVars.push(v);
                                        }
                                    }

                                    if (matchingVars.length > 0) {
                                        me._currentFindIndex = index;
                                        findRes = {
                                            entry: e,
                                            index: index,
                                            variables: matchingVars,
                                        };

                                        break;
                                    }
                                }
                            }

                            resolve(findRes);
                        }
                        catch (e) {
                            reject(e);
                        }
                    });
                },
            };

            me.findNextVariables(result);
        }
        else {
            if (!me._varFinder) {
                result.body('Please define a search expression!');
                result.sendResponse();
            }
            else {
                me.findNextVariables(result);
            }
        }
    }

    /**
     * 'next' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     * @param {ConsoleManager} me The underlying console manager.
     */
    protected cmd_find_next(result: ExecuteCommandResult, me: ConsoleManager): void {
        me.findNextVariables(result);
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
            let output = '';

            const Table = require('easy-table');
            let t = new Table();

            for (let i = 0; i < friends.length; i++) {
                let f = friends[i];

                t.cell('#', i + 1);
                t.cell('Name', f.name);
                t.cell('Address', `${f.address}:${f.port}`);
                t.newRow();
            }

            result.body(`Found ${friends.length} friend${1 != friends.length ? 's' : ''}`);
            result.writeLine(t.toString());
        }
        else {
            result.body('No friends found');
        }

        result.sendResponse();
    }

    /**
     * 'github' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     */
    protected cmd_github(result: ExecuteCommandResult): void {
        try {
            const opn = require('opn');
            opn(URL_PROJECT_GITHUB);

            result.body(`Opening project page on GitHub (${URL_PROJECT_GITHUB})...`);
        }   
        catch (e) {
            result.body(`[ERROR] Could not open URL '${URL_PROJECT_GITHUB}': ` + e);
        }   

        result.sendResponse();
    }

    /**
     * 'issue' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     */
    protected cmd_issues(result: ExecuteCommandResult): void {
        try {
            const opn = require('opn');
            opn(URL_ISSUES_GITHUB);

            result.body(`Opening issue page on GitHub (${URL_ISSUES_GITHUB})...`);
        }   
        catch (e) {
            result.body(`[ERROR] Could not open URL '${URL_ISSUES_GITHUB}': ` + e);
        }   

        result.sendResponse();
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
     * @param {RegExpExecArray} match Matches of the execution of a regular expression.
     * @param {ConsoleManager} me The underlying console manager.
     */
    protected cmd_help(result: ExecuteCommandResult, match: RegExpExecArray, me: ConsoleManager): void {
        let cmd = match[2];
        if (cmd) {
            cmd = cmd.toLowerCase().trim();
        }

        try {
            const opn = require('opn');

            let listOfCommands: string[];
            if (cmd) {
                listOfCommands = cmd.split(' ').map(x => {
                    return x.toLowerCase().trim();
                }).filter(x => {
                    return x ? true : false;
                });
            }

            if (listOfCommands && listOfCommands.length > 0) {
                for (let i = 0; i < listOfCommands.length; i++) {
                    let c = listOfCommands[i];

                    try {
                        if (undefined !== COMMAND_WIKI_PAGES[c]) {
                            let wikiPage = COMMAND_WIKI_PAGES[c];
                            if (!wikiPage) {
                                wikiPage = c;
                            }

                            let url = `https://github.com/mkloubert/vs-remote-debugger/wiki/${encodeURIComponent('command_' + wikiPage)}`;
                            opn(url);

                            result.writeLine(`Opening wiki page of command '${c}': ${url}`);
                        }
                        else {
                            let bestMatch: {
                                command: string;
                                similarity: number,
                            };

                            for (let cmd in COMMAND_WIKI_PAGES) {
                                let s = vsrd_helpers.getStringSimilarity(c, cmd, true, true);
                                if (s < 0.5) {
                                    continue;
                                }

                                let updateMatch = true;
                                if (bestMatch) {
                                    updateMatch = s > bestMatch.similarity;
                                }

                                if (updateMatch) {
                                    bestMatch = {
                                        command: cmd,
                                        similarity: s,
                                    };
                                }
                            }

                            if (bestMatch) {
                                result.body(`Unknown command '${c}'! Did you mean '${bestMatch.command}'?`);
                            }
                            else {
                                result.body(`Unknown command '${c}'!`);
                            }
                        }
                    }
                    catch (e) {
                        result.writeLine(`[ERROR] Could not open wiki page of '${c}' command: ` + e);
                    }
                }
            }
            else {
                let url = `https://github.com/mkloubert/vs-remote-debugger/wiki#commands`;
                opn(url);

                result.writeLine(`Opening wiki page with all commands: ${url}`);
            }
        }
        catch (e) {
            result.body(`[ERROR] Could not open wiki page(s): ` + e);
        }

        result.sendResponse();
    }

    /**
     * '?' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     */
    protected cmd_help_screen(result: ExecuteCommandResult): void {
        let output = ' Command                                     | Description\n';
           output += '---------------------------------------------|-----------------------------------------------------------------------------------\n';
           output += ' ?                                           | Shows that help screen\n';
           output += ' +                                           | Goes to next entry\n';
           output += ' -                                           | Goes to previous entry\n';
           output += ' about                                       | Displays information about the plugin and the author\n';
           output += ' add [$INDEXES]                              | Adds the current or specific entries as favorites\n';
           output += ' all                                         | Adds all entries as favorites\n';
           output += ' clear                                       | Removes all loaded entries and favorites\n';
           output += ' continue                                    | Continues debugging\n';
           output += ' counter [$VALUE] [pause]                    | Sets the counter value and disables "pause mode" by default\n';
           output += ' current                                     | Displays current index\n';
           output += ' debug                                       | Runs debugger itself in "debug mode"\n';
           output += ' disable [pause]                             | Disables the counter and disables "pause mode" by default\n';
           output += ' donate                                      | If you like that extension, you can send me a donation via PayPal :-)\n';
           output += ' exec $COMMAND [$ARGS]                       | Executes a command of a plugin\n';
           output += ' favs                                        | Lists all favorites\n';
           output += ' find [$EXPR]                                | Starts a search for an expression inside the "Debugger" variables\n';
           output += ' first                                       | Jumps to first item\n';
           output += ' friends                                     | Displays the list of friends\n';
           output += ' github                                      | Opens the project page on GitHub\n';
           output += ' goto $INDEX                                 | Goes to a specific entry (beginning at 1)\n';
           output += ' help [$COMMANDS]                            | Opens the wiki page of one or more command with details information\n';
           output += ' history [$INDEXES]                          | Lists the logs of one or more entry\n';
           output += ' issues                                      | Opens the "issues" page of the project on GitHub\n';
           output += ' last                                        | Jumps to last entry\n';
           output += ' list [$ITEMS_TO_SKIP] [$ITEMS_TO_DISPLAY]   | Lists a number of entries\n';
           output += ' load [$FILE]                                | Loads entries from a local JSON file\n';
           output += ' log $MESSAGE                                | Adds a log message to the current entry\n';
           output += ' me                                          | Lists all network interfaces of that machine\n';
           output += ' new [$ITEMS_TO_SKIP] [$ITEMS_TO_DISPLAY]    | Lists a number of entries (backward)\n';
           output += ' next                                        | Continues a "Debugger" variable search\n';
           output += ' nodebug                                     | Stops running debugger itself in "debug mode"\n';
           output += ' none                                        | Clears all favorites\n';
           output += ' pause                                       | Pauses debugging (skips incoming messages)\n';
           output += ' plugins                                     | Lists all loaded plugins\n';
           output += ' refresh                                     | Refreshes the view\n';
           output += ' regex $PATTERN                              | Starts a search inside the "Debugger" variables by using a regular expression\n';
           output += ' remove [$INDEXES]                           | Removes one or more entry from the list of favorites\n';
           output += ' reset [pause]                               | Resets the counter with the start value from the debugger config\n';
           output += '                                             | and disables "pause mode" by default\n';  
           output += ' save [$FILE]                                | Saves the favorites to a local JSON file\n';
           output += ' search [$EXPR]                              | Alias for "find" command\n';
           output += ' send $ADDR [$PORT]                          | Sends your favorites to a remote machine\n';
           output += ' set $TEXT                                   | Sets additional information like a "note" value for the current entry\n';
           output += ' share [$FRIENDS]*                           | Sends your favorites to one or more friend\n';
           output += ' sort                                        | Sorts all entries by timestamp\n';
           output += ' state                                       | Displays the current debugger state\n';
           output += ' toggle                                      | Toggles "paused" state\n';
           output += ' trim                                        | Removes all entries that are NOT marked as "favorites"\n';
           output += ' twitter                                     | Opens my twitter page\n';
           output += ' unset [$INDEXES]                            | Removes the additional information that is stored in one or more entry\n';

        result.write(output);

        result.sendResponse();
    }

    /**
     * 'cmd_history' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     * @param {RegExpExecArray} match Matches of the execution of a regular expression.
     * @param {ConsoleManager} me The underlying console manager.
     */
    protected cmd_history(result: ExecuteCommandResult, match: RegExpExecArray, me: ConsoleManager): void {
        let entries = result.entries().toArray();

        let listOfRanges =  vsrd_helpers.normalizeString(match[2]);

        let ranges = me.toNumberRanges(listOfRanges);
        if (ranges.length < 1) {
            if (result.currentEntry()) {
                ranges = me.toNumberRanges(`${result.currentIndex() + 1}`);
            }
            else {
                ranges = null;

                if (entries.length > 0) {
                    result.body(`Please select valid indexes from 1 to ${entries.length}!`);
                }
                else {
                    result.body('Please select an entry!');
                }
            }
        }

        if (null !== ranges) {
            let addFavs: number[] = [];

            for (let i = 0; i < ranges.length; i++) {
                let r = ranges[i];

                for (let j = 0; j < entries.length; j++) {
                    let index = j + 1;
                    if (!r.isInRange(index)) {
                        continue;
                    }

                    let e = entries[j];
                    result.writeLine(me.toShortListEntryString(e, index));

                    if (e.__logs && e.__logs.length && e.__logs.length > 0) {
                        let logIndex = 0;
                        for (let k = 0; k < e.__logs.length; k++) {
                            let log = e.__logs[k];
                            if (!log) {
                                continue;
                            }

                            if (!log.message) {
                                continue;
                            }

                            ++logIndex;
                            
                            let author = '';
                            if (log.author) {
                                author = ` - ${log.author.trim()}`;
                            }

                            let time = '';
                            let logTime = me.toDateString(log.time);
                            if (logTime) {
                                time = ` [${logTime}]`;
                            }

                            let prefix = `    #${logIndex}`;

                            result.writeLine(`${prefix}${time}${author}`);
                            result.writeLine(`${' '.repeat(prefix.length + 1)}${log.message}`);
                        }
                    }
                    else {
                        result.writeLine('\tNo logs!');
                    }
                }
            }
        }

        result.sendResponse();
    }

    /**
     * 'last' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     */
    protected cmd_last(result: ExecuteCommandResult): void {
        let newIndex = result.entries().count() - 1;
            
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
        let entries = result.entries().toArray();

        let itemsToSkip: number = 0;
        if (match[3]) {
            itemsToSkip = parseInt(('' + match[3]).trim());
        }

        let itemsToDisplay: number = 50;
        if (match[5]) {
            itemsToDisplay = parseInt(('' + match[5]).trim());
        }

        let entriesToDisplay: DisplayableEntry[] = [];
        for (let i = 0; i < itemsToDisplay; i++) {
            let index = itemsToSkip + i;
            if (index >= entries.length) {
                // no more items to display
                break;
            }

            let entry = entries[index];
            if (entry) {
                entriesToDisplay.push({
                    entry: entry,
                    index: index + 1,
                });
            }
        }

        me.displayEntries(result,
                          entriesToDisplay, entries.length);

        result.sendResponse();
    }

    /**
     * 'load' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     * @param {RegExpExecArray} match Matches of the execution of a regular expression.
     * @param {ConsoleManager} me The underlying console manager.
     */
    protected cmd_load(result: ExecuteCommandResult, match: RegExpExecArray, me: ConsoleManager): void {
        let entries = result.entries().toArray();
        let file = vsrd_helpers.normalizeString(match[2]);

        let finish = () => {
            result.sendResponse();
        };

        let showError = (err) => {
            result.body('Could not load file: ' + err);
        };

        try {
            if (!file) {
                // use auto name

                let pattern = result.filenameFormat();
                if (pattern) {
                    pattern = ('' + pattern).trim();
                }
                if (!pattern) {
                    pattern = DEFAULT_FILENAME_FORMAT;
                }

                // process placeholders
                pattern = pattern.replace('${timestamp}', '([0-9]+)');
                pattern = pattern.replace('${year}', '([0-9]{4})');
                pattern = pattern.replace('${month}', '(0[0-9]|1[0-2])');
                pattern = pattern.replace('${day}', '(0[0-9]|1[0-9]|2[0-9]|3[0-1])');
                pattern = pattern.replace('${hours}', '(0[0-9]|1[0-9]|2[0-3])');
                pattern = pattern.replace('${minutes}', '([0-5][0-9])');
                pattern = pattern.replace('${seconds}', '([0-5][0-9])');
                pattern = pattern.replace('${timezone}', '([\\-]?)([0-9]+)');
                pattern = pattern.replace('${rand}', '([0-9]+)');

                pattern = '^' + pattern + '(\\.json)$';

                let existingFiles: { path: string, stats: FS.Stats}[] = [];
                try {
                    let regex = new RegExp(pattern, 'i');

                    let existingFileNames = FS.readdirSync(result.sourceRoot());
                    for (let i = 0; i < existingFileNames.length; i++) {
                        let fileName = existingFileNames[i];
                        if (!regex.test(fileName.trim())) {
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
                }
                catch (e) {
                    // ignore
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

            if (!file) {
                result.body("Please select a file!");
            }
            else {
                if (!Path.isAbsolute(file)) {
                    file = Path.join(result.sourceRoot(), file);
                }

                let loadedEntries: vsrd_contracts.RemoteDebuggerEntry[]
                    = JSON.parse(FS.readFileSync(file, 'utf8'));

                if (loadedEntries && loadedEntries.length) {
                    let loadedEntryCount = 0;
                    for (let i = 0; i < loadedEntries.length; i++) {
                        let entry = loadedEntries[i];
                        if (entry) {
                            entries.push(entry);
                            ++loadedEntryCount;
                        }
                    }

                    if (loadedEntryCount > 0) {
                        result.body(`Loaded ${loadedEntryCount} entries from '${file}'`);

                        result.gotoIndex(result.currentIndex());
                    }
                    else {
                        result.body('No entries loaded!');
                    }
                }
            }
        }
        catch (e) {
            showError(e);
        }

        result.sendResponse();
    }

    /**
     * 'log' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     * @param {RegExpExecArray} match Matches of the execution of a regular expression.
     * @param {ConsoleManager} me The underlying console manager.
     */
    protected cmd_log(result: ExecuteCommandResult, match: RegExpExecArray, me: ConsoleManager): void {
        let now = new Date();
        
        let msg = vsrd_helpers.normalizeString(match[2]);
        if (msg) {
            let index = result.currentIndex();
            let entry = result.currentEntry();
            if (entry) {
                if (!entry.__logs) {
                    entry.__logs = [];
                }

                entry.__logs.push({
                    author: result.nick(),
                    message: msg,
                    time: now,
                });

                result.body(`Add log for ${index + 1}`);
            }
            else {
                result.body('Please select an entry!');
            }
        }
        else {
            result.body('Nothing to log!');
        }

        result.sendResponse();
    }

    /**
     * 'me' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     * @param {ConsoleManager} me The underlying console manager.
     */
    protected cmd_me(result: ExecuteCommandResult, me: ConsoleManager): void {
        let port = me._context.port();

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
            const Table = require('easy-table');
            let t = new Table();
            
            for (let i = 0; i < foundInterfaces.length; i++) {
                let ni = foundInterfaces[i];

                t.cell('#', i + 1);
                t.cell('Family', ni.family);
                t.cell('Address', `${ni.address}:${port}`);
                t.cell('Mask', ni.netmask);
                t.cell('MAC', ni.mac);
                t.newRow();
            }

            result.write(t.toString());
            result.body(`Found ${foundInterfaces.length} network interface${1 != foundInterfaces.length ? 's' : ''}`);
        }
        else {
            result.body('No network interfaces found');
        }

        result.sendResponse();
    }

    /**
     * 'new' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     * @param {RegExpExecArray} match Matches of the execution of a regular expression.
     * @param {ConsoleManager} me The underlying manager.
     */
    protected cmd_new(result: ExecuteCommandResult, match: RegExpExecArray, me: ConsoleManager): void {
        let entries = result.entries().toArray();

        let itemsToSkip: number = 0;
        if ('' != match[3]) {
            itemsToSkip = parseInt(match[3]);
        }

        let itemsToDisplay: number = 50;
        if ('' != match[5]) {
            itemsToDisplay = parseInt(match[5]);
        }

        let entriesToDisplay: DisplayableEntry[] = [];
        for (let i = 0; i < itemsToDisplay; i++) {
            let index = entries.length - (itemsToSkip + i) - 1;
            if (index < 0) {
                // no more items to display
                break;
            }

            let entry = entries[index];
            if (entry) {
                entriesToDisplay.push({
                    entry: entry,
                    index: index + 1,
                })
            }
        }

        me.displayEntries(result,
                          entriesToDisplay, entries.length);

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
     * 'plugins' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     * @param {ConsoleManager} me The underlying console manager.
     */
    protected cmd_plugins(result: ExecuteCommandResult, me: ConsoleManager): void {
        try {
            let plugins = me._context.plugins().toArray();

            if (plugins.length > 0) {
                let output = '';

                const Table = require('easy-table');
                let t;
                
                t = new Table();
                for (let i = 0; i < plugins.length; i++) {
                    let pe = plugins[i];
                    let p = pe.plugin;
                    
                    let info: vsrd_contracts.DebuggerPluginInfo;
                    if (p.info) {
                        info = p.info();
                    }

                    let hp: string;
                    let lic: string;
                    let name: string = pe.name;
                    let ver: string;
                    if (info) {
                        hp = info.homepage;
                        lic = info.license;

                        if (name) {
                            name = info.name;
                        }

                        ver = info.version;
                    }

                    if (!hp) {
                        hp = 'n/a';
                    }
                    if (!lic) {
                        lic = 'n/a';
                    }
                    if (!name) {
                        name = 'n/a';
                    }
                    if (!ver) {
                        ver = 'n/a';
                    }

                    let commands: string[] = [];
                    let implementedFeatures: string[] = [];
                    let pluginCommands: string[];
                    if (p.execute && p.commands) {
                        pluginCommands = p.commands();
                        
                        implementedFeatures.push('E');
                    }
                    if (p.dropEntry) {
                        implementedFeatures.push('DE');
                    }
                    if (p.processEntry) {
                        implementedFeatures.push('PE');
                    }
                    if (p.restoreMessage) {
                        implementedFeatures.push('RM');
                    }
                    if (p.transformMessage) {
                        implementedFeatures.push('TM');
                    }

                    t.cell('#', i + 1);
                    t.cell('Name', name);
                    t.cell('File', pe.file.name);
                    t.cell('Version', ver);

                    let commandList: string = '';
                    if (pluginCommands) {
                        if (pluginCommands.length > 0) {
                            commandList = '"' + pluginCommands
                                .map(x => x ? ('' + x) : '')
                                .map(x => x.toLowerCase().trim())
                                .filter(x => x ? true : false)
                                .sort()
                                .join('", "') + '"';
                        }
                    }

                    t.cell('Features*', implementedFeatures.join(', '));
                    t.cell('Commands', commandList);
                    t.cell('License', lic);
                    t.cell('Homepage', hp);

                    t.newRow();
                }
                output += t.toString() + "\n";

                output += "\n";
                output += "*\n";
                t = new Table();
                {
                    t.cell('Feature', 'DE');
                    t.cell('Description', 'Checks if an incoming entry should be dropped');
                    t.newRow();
                    
                    t.cell('Feature', 'E');
                    t.cell('Description', 'Can execute commands');
                    t.newRow();

                    t.cell('Feature', 'PE');
                    t.cell('Description', 'Processes incoming entries');
                    t.newRow();

                    t.cell('Feature', 'RM');
                    t.cell('Description', 'Restores transformed JSON messages');
                    t.newRow();

                    t.cell('Feature', 'TM');
                    t.cell('Description', 'Transforms JSON messages into new data');
                    t.newRow();
                }
                output += t.toString();

                result.writeLine(output);

                result.body(`Found ${plugins.length} plugin${1 != plugins.length ? 's' : ''}`);
            }
            else {
                result.body('No plugins loaded');
            }
        }
        catch (e) {
            result.body('ERROR: ' + e);
        }

        result.sendResponse();
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
     * 'regex' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     * @param {RegExpExecArray} match Matches of the execution of a regular expression.
     * @param {ConsoleManager} me The underlying console manager.
     */
    protected cmd_regex(result: ExecuteCommandResult, match: RegExpExecArray, me: ConsoleManager): void {
        let pattern = vsrd_helpers.normalizeString(match[2]);
        if (pattern) {
            let regex: RegExp;
            try {
                regex = new RegExp(pattern);
            }
            catch (e) {
                result.body('No valid regular expression: ' + e);
                result.sendResponse();
                
                return;
            }

            me._currentFindIndex = -1;

            me._varFinder = {
                findNext: () => {
                    return new Promise<VariableFinderResult>((resolve, reject) => {
                        try {
                            let findRes: VariableFinderResult;

                            let entries = result.entries().toArray();
                            if (entries.length > 0) {
                                ++me._currentFindIndex;
                                if (me._currentFindIndex >= entries.length) {
                                    me._currentFindIndex = 0;
                                }

                                for (let i = 0; i < entries.length; i++) {
                                    let index = (me._currentFindIndex + i) % entries.length;
                                    
                                    let e = entries[index];
                                    if (!e) {
                                        continue;
                                    }

                                    let vars = e.v;
                                    if (!vars) {
                                        continue;
                                    }

                                    let matchingVars: vsrd_contracts.RemoteDebuggerVariable[] = [];

                                    for (let j = 0; j < vars.length; j++) {
                                        let v = vars[j];
                                        if (!v) {
                                            continue;
                                        }

                                        let strToSearchIn = '';
                                        if (v.v) {
                                            strToSearchIn = JSON.stringify(v.v);
                                        }

                                        if (regex.test(strToSearchIn)) {
                                            matchingVars.push(v);
                                        }
                                    }

                                    if (matchingVars.length > 0) {
                                        me._currentFindIndex = index;
                                        findRes = {
                                            entry: e,
                                            index: index,
                                            variables: matchingVars,
                                        };

                                        break;
                                    }
                                }
                            }

                            resolve(findRes);
                        }
                        catch (e) {
                            reject(e);
                        }
                    });
                },
            };

            me.findNextVariables(result);
        }
        else {
            if (!me._varFinder) {
                result.body('Please define a regular expression!');
                result.sendResponse();
            }
            else {
                me.findNextVariables(result);
            }
        }
    }

    /**
     * 'remove' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     * @param {RegExpExecArray} match Matches of the execution of a regular expression.
     * @param {ConsoleManager} me The underlying console manager.
     */
    protected cmd_remove(result: ExecuteCommandResult, match: RegExpExecArray, me: ConsoleManager): void {
        let entries = result.favorites().toArray();
        let favorites = result.favorites().toArray();

        let listOfRanges = match[2];
        if (listOfRanges) {
            listOfRanges = listOfRanges.trim();
        }
        if (!listOfRanges) {
            listOfRanges = '';
        }

        let ranges = me.toNumberRanges(listOfRanges);
        if (ranges.length < 1) {
            if (result.currentEntry()) {
                ranges = me.toNumberRanges(`${result.currentIndex() + 1}`);
            }
            else {
                ranges = null;

                if (entries.length > 0) {
                    result.body(`Please select valid indexes from 1 to ${entries.length}!`);
                }
                else {
                    result.body('Please select an entry!');
                }
            }
        }

        if (null !== ranges) {
            let removedFavs: number[] = [];

            let newFavs: vsrd_contracts.RemoteDebuggerFavorite[] = favorites;
            for (let i = 0; i < ranges.length; i++) {
                let r = ranges[i];

                for (let j = 0; j < entries.length; j++) {
                    let index = j + 1;
                    if (!r.isInRange(index)) {
                        continue;
                    }

                    newFavs = newFavs.filter(x => {
                        if (x.index == index) {
                            removedFavs.push(x.index);
                            return false;
                        }

                        return true;
                    });
                }
            }

            result.favorites(newFavs);

            if (removedFavs.length > 0) {
                result.body(`The following ${removedFavs.length} favorites were removed: ${removedFavs.sort().join(',')}`);
            }
            else {
                result.body('No favorites removed');
            }
        }

        result.sendResponse();
    }

    /**
     * 'reset' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     * @param {RegExpExecArray} match Matches of the execution of a regular expression.
     * @param {ConsoleManager} me The underlying console manager.
     */
    protected cmd_reset(result: ExecuteCommandResult, match: RegExpExecArray, me: ConsoleManager): void {
        let newValue = result.counterStart();
        result.counter(newValue);
        
        let body: string;
        if (false !== newValue) {
            body = `Reset counter to ${newValue}`;
        }
        else {
            body = `Disabled counter`;
        }

        let suffix: string = " and continued debugging";
        let isPaused = false;

        if (match[3]) {
            if ('pause' == match[3].toLowerCase().trim()) {
                isPaused = true;
                suffix = " and switch to 'pause' mode";
            }
        }

        result.isPaused(isPaused);

        result.body(`${body}${suffix}`);
        result.sendResponse();
    }

    /**
     * 'save' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     * @param {RegExpExecArray} match Matches of the execution of a regular expression.
     * @param {ConsoleManager} me The underlying console manager.
     */
    protected cmd_save(result: ExecuteCommandResult, match: RegExpExecArray, me: ConsoleManager): void {
        let now = new Date();
        
        let favorites = result.favorites().toArray();
        
        let file = vsrd_helpers.normalizeString(match[2]);

        let padLeft = (n: number): string => {
            let s = '' + n;
            if (n < 10) {
                s = '0' + s;
            }

            return s;
        };

        let showError = (err) => {
            //TODO: me.log('[ERROR :: save()]: ' + err);
        };

        if (favorites.length > 0) {
            try {
                if (!file) {
                    // auto save

                    let baseName = result.filenameFormat();
                    if (baseName) {
                        baseName = ('' + baseName).trim();
                    }
                    if (!baseName) {
                        baseName = DEFAULT_FILENAME_FORMAT;
                    }

                    // process placeholders
                    baseName = baseName.replace('${timestamp}', '' + now.getTime());
                    baseName = baseName.replace('${year}', '' + now.getFullYear());
                    baseName = baseName.replace('${month}', '' + padLeft(now.getMonth() + 1));
                    baseName = baseName.replace('${day}', '' + padLeft(now.getDate()));
                    baseName = baseName.replace('${hours}', '' + padLeft(now.getHours()));
                    baseName = baseName.replace('${minutes}', '' + padLeft(now.getMinutes()));
                    baseName = baseName.replace('${seconds}', '' + padLeft(now.getSeconds()));
                    baseName = baseName.replace('${timezone}', '' + now.getTimezoneOffset());
                    baseName = baseName.replace('${rand}', '' + Math.floor(Math.random() * 597923979));

                    let index: number = -1;
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
        let favs = result.favorites().toArray();
        
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

                me.sendEntryTo(favs[i].entry, host, port, me)
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
        let text = vsrd_helpers.normalizeString(match[2]);

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
        let favs = result.favorites().toArray();
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

                        me.sendEntryTo(favs[i].entry, f.address, f.port, me)
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
     * 'sort' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     * @param {ConsoleManager} me The underlying console manager.
     */
    protected cmd_sort(result: ExecuteCommandResult, me: ConsoleManager): void {
        let entries = result.entries().toArray().sort((x, y) => {
            let sortX = me.toDateString(x.__time);
            let sortY = me.toDateString(y.__time);

            if (sortX > sortY) {
                return 1;
            }
            
            if (sortX < sortY) {
                return -1;
            }

            return 0;
        });

        result.entries(entries);

        if (entries.length > 0) {
            result.body(`Sorted ${entries.length} entries by timestamp`);
        }
        else {
            result.body('Nothing sorted!');
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

    //TODO: test code
    protected cmd_test(result: ExecuteCommandResult, match: RegExpExecArray, me: ConsoleManager): void {
        try {
            result.body('A test');
        }
        catch (e) {
            result.body('ERROR: ' + e);
        }

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
     * 'trim' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     */
    protected cmd_trim(result: ExecuteCommandResult): void {
        let entries = result.entries().toArray();
        let favorites = result.favorites().toArray();

        // find entries that are marked as favorites
        let newEntries: vsrd_contracts.RemoteDebuggerEntry[] = [];
        for (let i = 0; i < favorites.length; i++) {
            let f = favorites[i];

            for (let j = 0; j < entries.length; j++) {
                let e = entries[j];
                let index = j + 1;

                if (index == f.index) {
                    // is favorite
                    newEntries.push(e);
                    break;
                }
            }
        }

        // refresh favorite list
        let newFavs: vsrd_contracts.RemoteDebuggerFavorite[] = [];
        for (let i = 0; i < newEntries.length; i++) {
            let e = newEntries[i];
            let index = i + 1;
            
            newFavs.push({
                index: index,
                entry: e,
            });
        }

        result.entries(newEntries);
        result.favorites(newFavs);

        result.body(`List trimmed to ${newEntries.length} entries`);
        result.sendResponse();

        result.gotoIndex(0);
    }

    /**
     * 'twitter' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     */
    protected cmd_twitter(result: ExecuteCommandResult): void {
        try {
            const opn = require('opn');
            opn(URL_TWITTER);

            result.body(`Opening Twitter page (${URL_TWITTER})...`);
        }
        catch (e) {
            result.body('Could not open Twitter page! Try opening the following url manually: ' + URL_TWITTER);
        }

        result.sendResponse();
    }

    /**
     * 'unset' command
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     * @param {RegExpExecArray} match Matches of the execution of a regular expression.
     * @param {ConsoleManager} me The underlying console manager.
     */
    protected cmd_unset(result: ExecuteCommandResult, match: RegExpExecArray, me: ConsoleManager): void {
        let entries = result.entries().toArray();

        let listOfRanges = vsrd_helpers.normalizeString(match[2]);
        
        let ranges = me.toNumberRanges(listOfRanges);
        if (ranges.length < 1) {
            if (result.currentEntry()) {
                ranges = me.toNumberRanges(`${result.currentIndex() + 1}`);
            }
            else {
                ranges = null;

                if (entries.length > 0) {
                    result.body(`Please select valid indexes from 1 to ${entries.length}!`);
                }
                else {
                    result.body('Please select an entry!');
                }
            }
        }

        if (null !== ranges) {
            let unsetEntries: number[] = [];

            for (let i = 0; i < ranges.length; i++) {
                let r = ranges[i];

                for (let j = 0; j < entries.length; j++) {
                    let e = entries[j];
                    let index = j + 1;

                    if (r.isInRange(index)) {
                        e.n = null;

                        if (unsetEntries.indexOf(index) < 0) {
                            unsetEntries.push(index);
                        }
                    }
                }
            }

            if (unsetEntries.length > 0) {
                result.body(`The following ${unsetEntries.length} entries were unset: ${unsetEntries.sort().join(',')}`);
            }
            else {
                result.body('No entries unset!');
            }
        }

        result.sendResponse();
    }

    /**
     * Displays a list of entries as table.
     * 
     * @param {ExecuteCommandResult} result The result context.
     * @param {DisplayableEntry[]} entries The entries to display.
     * @param {Number} totalCount The total number of entries.
     */
    protected displayEntries(result: ExecuteCommandResult,
                             entries: DisplayableEntry[],
                             totalCount: number) {
        if (entries) {
            entries = entries.filter(x => x ? true : false);
        }

        if (entries && entries.length > 0) {
            const Table = require('easy-table');
            let t = new Table();

            for (let i = 0; i < entries.length; i++) {
                let de = entries[i];
                let e = de.entry;

                let time = this.toDateString(e.__time);
                if (!time) {
                    time = '';
                }

                let file: string;
                let line: number;
                if (e.s && e.s.length > 0) {
                    let firstStackFrame = e.s[0];

                    file = firstStackFrame.f;
                    if (firstStackFrame.l) {
                        line = firstStackFrame.l;
                    }
                }

                if (file) {
                    file = '<' + ('' + file).trim() + '>';
                }
                if (!file) {
                    file = '';
                }

                let notes = e.n;
                if (notes) {
                    notes = ('' + e.n).trim();
                }
                if (!notes) {
                    notes = '';
                }

                let sendBy: string;
                if (e.__origin) {
                    let sendTime = this.toDateString(e.__origin.time);
                    if (sendTime) {
                        time = sendTime;
                    }

                    let addr = e.__origin.address;
                    if (addr) {
                        addr = ('' + e.__origin.address).trim();
                    }
                    if (addr) {
                        let port: string;
                        if (e.__origin.port) {
                            port = ('' + e.__origin.port).trim();
                        }
                        if (!port) {
                            port = '';
                        }

                        sendBy = `${addr}:${port}`;
                    }
                }
                if (!sendBy) {
                    sendBy = '';
                }

                t.cell('#', de.index);
                t.cell('File', file);
                t.cell('Line', line ? ('' + line).trim() : '');
                t.cell('Time', time);
                t.cell('Notes', notes);
                t.cell('From', sendBy);
                t.newRow();
            }

            result.writeLine(t.toString());

            result.body(`Total number of items: ${totalCount}`);
        }
        else {
            result.body('No items found');
        }
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

        let leftTrimmerExpr = expr.replace(/^\s*/, '');
        let trimmedExpr = expr.trim();
        let lowerExpr = trimmedExpr.toLowerCase();

        if ('?' == lowerExpr) {
            action = this.cmd_help_screen;
        }
        else if ('+' == lowerExpr) {
            action = this.cmd_next;
        }
        else if ('-' == lowerExpr) {
            action = this.cmd_prev;
        }
        else if ('about' == lowerExpr) {
            action = this.cmd_about;
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
        else if ('donate' == lowerExpr ||
                 'paypal' == lowerExpr) {
            action = this.cmd_donate;
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
        else if ('github' == lowerExpr) {
            action = this.cmd_github;
        }
        else if ('issues' == lowerExpr ||
                 'issue' == lowerExpr) {
            action = this.cmd_issues;
        }
        else if ('last' == lowerExpr) {
            action = this.cmd_last;
        }
        else if ('me' == lowerExpr) {
            action = this.cmd_me;
        }
        else if ('next' == lowerExpr) {
            action = this.cmd_find_next;
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
        else if ('plugins' == lowerExpr) {
            action = this.cmd_plugins;
        }
        else if ('refresh' == lowerExpr) {
            action = this.cmd_refresh;
        }
        else if ('sort' == lowerExpr) {
            action = this.cmd_sort;
        }
        else if ('state' == lowerExpr) {
            action = this.cmd_state;
        }
        else if ('toggle' == lowerExpr) {
            action = this.cmd_toggle;
        }
        else if ('trim' == lowerExpr) {
            action = this.cmd_trim;
        }
        else if ('twitter' == lowerExpr) {
            action = this.cmd_twitter;
        }
        else if (REGEX_CMD_ADD.test(trimmedExpr)) {
            // add
            action = toRegexAction(this.cmd_add,
                                   REGEX_CMD_ADD, trimmedExpr);
        }
        else if (REGEX_CMD_COUNTER.test(trimmedExpr)) {
            // counter
            action = toRegexAction(this.cmd_counter,
                                   REGEX_CMD_COUNTER, trimmedExpr);
        }
        else if (REGEX_CMD_DISABLE.test(leftTrimmerExpr)) {
            // disable
            action = toRegexAction(this.cmd_disable,
                                   REGEX_CMD_DISABLE, trimmedExpr);
        }
        else if (REGEX_CMD_EXEC.test(leftTrimmerExpr)) {
            // exec
            action = toRegexAction(this.cmd_exec,
                                   REGEX_CMD_EXEC, leftTrimmerExpr);
        }
        else if (REGEX_CMD_FIND.test(trimmedExpr)) {
            // find
            action = toRegexAction(this.cmd_find,
                                   REGEX_CMD_FIND, trimmedExpr);
        }
        else if (REGEX_CMD_GOTO.test(trimmedExpr)) {
            // goto
            action = toRegexAction(this.cmd_goto,
                                   REGEX_CMD_GOTO, trimmedExpr);
        }
        else if (REGEX_CMD_HELP.test(trimmedExpr)) {
            // help
            action = toRegexAction(this.cmd_help,
                                   REGEX_CMD_HELP, trimmedExpr);
        }
        else if (REGEX_CMD_HISTORY.test(trimmedExpr)) {
            // history
            action = toRegexAction(this.cmd_history,
                                   REGEX_CMD_HISTORY, trimmedExpr);
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
        else if (REGEX_CMD_LOG.test(trimmedExpr)) {
            // log
            action = toRegexAction(this.cmd_log,
                                   REGEX_CMD_LOG, trimmedExpr);
        }
        else if (REGEX_CMD_NEW.test(trimmedExpr)) {
            // new
            action = toRegexAction(this.cmd_new,
                                   REGEX_CMD_NEW, trimmedExpr);
        }
        else if (REGEX_CMD_REGEX.test(trimmedExpr)) {
            // regex
            action = toRegexAction(this.cmd_regex,
                                   REGEX_CMD_REGEX, trimmedExpr);
        }
        else if (REGEX_CMD_REMOVE.test(trimmedExpr)) {
            // remove
            action = toRegexAction(this.cmd_remove,
                                   REGEX_CMD_REMOVE, trimmedExpr);
        }
        else if (REGEX_CMD_RESET.test(leftTrimmerExpr)) {
            // reset
            action = toRegexAction(this.cmd_reset,
                                   REGEX_CMD_RESET, trimmedExpr);
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
        else if (REGEX_CMD_TEST.test(trimmedExpr)) {
            // test
            action = toRegexAction(this.cmd_test,
                                   REGEX_CMD_TEST, trimmedExpr);
        }
        else if (REGEX_CMD_UNSET.test(trimmedExpr)) {
            // unset
            action = toRegexAction(this.cmd_unset,
                                   REGEX_CMD_UNSET, trimmedExpr);
        }
        else {
            // unknown command

            action = toRegexAction(this.handleUnknownCommand,
                                   REGEX_UNKNOWN_CMD, trimmedExpr);
        }

        if (action) {
            try {
                result.handled = true;
                result.body('');

                action(result, this);
            }
            catch (e) {
                result.body('[FATAL COMMAND ERROR]: ' + e);
                result.sendResponse();
            }
        }
    }

    /**
     * Continues a variable search.
     * 
     * @param {ExecuteCommandResult} The result context.
     */
    protected findNextVariables(result: ExecuteCommandResult) {
        try {
            let vf = this._varFinder;
            if (!vf) {
                result.body('No search started yet!');
                result.sendResponse();

                return;
            }

            vf.findNext()
              .then((findRes) => {
                        if (findRes) {
                            let varNames = findRes.variables.map(x => x.n);

                            result.body(`Found ${findRes.variables.length} variables in entry ${findRes.index + 1}: ${varNames.join(',')}`);
                            result.sendResponse();

                            result.gotoIndex(findRes.index);
                        }
                        else {
                            result.body('Nothing found!');
                            result.sendResponse();
                        }
                    },
                    (err) => {
                        result.body('Search error (2): ' + err);
                        result.sendResponse();
                    });
        }
        catch (e) {
            result.body('Search error (1): ' + e);
            result.sendResponse();
        }
    }

    /**
     * Handles an unknown command.
     * 
     * @param {ExecuteCommandResult} result The object for handling the result.
     * @param {RegExpExecArray} match Matches of the execution of a regular expression.
     * @param {ConsoleManager} me The underlying console manager.
     */
    protected handleUnknownCommand(result: ExecuteCommandResult, match: RegExpExecArray, me: ConsoleManager): void {
        let unknownCommand = vsrd_helpers.normalizeString(match[1]);

        let bestMatch: {
            command: string;
            similarity: number,
        };

        for (let cmd in COMMAND_WIKI_PAGES) {
            let s = vsrd_helpers.getStringSimilarity(unknownCommand, cmd, true, true);
            if (s < 0.5) {
                continue;
            }

            let updateMatch = true;
            if (bestMatch) {
                updateMatch = s > bestMatch.similarity;
            }

            if (updateMatch) {
                bestMatch = {
                    command: cmd,
                    similarity: s,
                };
            }
        }

        if (bestMatch) {
            result.body(`Command '${unknownCommand}' is NOT available or implemented! Did you mean '${bestMatch.command}'?`);
        }
        else {
            result.body(`Command '${unknownCommand}' is NOT available or implemented!`);
        }
        
        result.sendResponse();
    }

    /**
     * Sends a debugger entry to another machine.
     * 
     * @param {vsrd_contracts.RemoteDebuggerEntry} entry The entry to send.
     * @param {string} host The host address.
     * @param {number} The TCP port.
     * @param {ConsoleManager} me The underlying console manager.
     * 
     * @return {Promise<T>} The promise.
     */
    protected sendEntryTo(entry: vsrd_contracts.RemoteDebuggerEntry,
                          host: string, port: number,
                          me: ConsoleManager): Promise<vsrd_contracts.RemoteDebuggerEntry> {

        return new Promise((resolve, reject) => {
            let showError = (err) => {
                reject({
                    'entry': entry,
                    'error': err,
                });
            };

            try {
                let json = new Buffer(JSON.stringify(entry),
                                      'utf8');

                // prepare JSON data
                let plugins = me._context.plugins().toArray();
                for (let i = plugins.length - 1; i >= 0; i--) {
                    let p = plugins[i].plugin;

                    if (p.transformMessage) {
                        json = p.transformMessage(json);
                    }
                }

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
            }
            catch (e) {
                showError(e);
            }
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
     * Converts a date to a string.
     * 
     * @param {any} [val] The value to convert.
     * @param {boolean} [withTime] With time or not.
     * 
     * @return {string} The value as string.
     */
    protected toDateString(val?: Date | string, withTime: boolean = true): string {
        val = this.toDate(val);
        if (!val) {
            return;
        }

        let padLeft = (n: number): string => {
            let s = '' + n;
            if (n < 10) {
                s = '0' + s;
            }

            return s;
        };

        return `${val.getFullYear()}-${padLeft(val.getMonth() + 1)}-${padLeft(val.getDate())}` + 
               (withTime ? ` ${padLeft(val.getHours())}:${padLeft(val.getMinutes())}:${padLeft(val.getSeconds())}` : '');
    }

    /**
     * Converts a string to a list of number ranges.
     * 
     * @param {String} [str] The input string.
     * 
     * @return {vsrd_contracts.NumberRange[]} The list of ranges.
     */
    protected toNumberRanges(str?: string): vsrd_contracts.NumberRange[] {
        let ranges: vsrd_contracts.NumberRange[] = [];
        
        if (str) {
            str = ('' + str).toLowerCase().trim();
        }

        if (str) {
            const REGEX = /^([\d]*)([\s]*)([\-]?)([\s]*)([\d]*)$/i;

            let parts = str.split(',');
            for (let i = 0; i < parts.length; i++) {
                let p = parts[i].trim();
                if (!p || !REGEX.test(p)) {
                    continue;
                }

                let m = REGEX.exec(p);

                let newRange: vsrd_contracts.NumberRange = {
                    isInRange: function(v) {
                        let isStartSet = undefined !== this.start;
                        let isEndSet = undefined !== this.end;

                        if (!isStartSet && !isEndSet) {
                            return true;
                        }

                        if (undefined !== v) {
                            if (!isStartSet) {
                                return v <= this.end;
                            }

                            if (!isEndSet) {
                                return v >= this.start;
                            }
                            
                            return v >= this.start &&
                                   v <= this.end;    
                        }

                        return false;
                    }
                };

                if (m[1]) {
                    newRange.start = parseInt(m[1]);
                }
                if (m[5]) {
                    newRange.end = parseInt(m[5]);
                }

                // no separator?
                if (!m[3]) {
                    if (undefined !== newRange.start) {
                        newRange.end = newRange.start;
                    }    
                    else if (undefined !== newRange.end) {
                        newRange.start = newRange.end;
                    }
                }

                if (undefined !== newRange.start &&
                    undefined !== newRange.end) {

                    if (newRange.start > newRange.end) {
                        let temp = newRange.start;
                        newRange.start = newRange.end;
                        newRange.end = temp;
                    }
                }

                ranges.push(newRange);
            }
        }

        return ranges;
    }

    /**
     * Creates a "short list entry" string for an entry.
     * 
     * @param {vsrd_contracts.RemoteDebuggerEntry} [entry] The entry.
     * @param {number} [index] The index to display.
     */
    protected toShortListEntryString(entry?: vsrd_contracts.RemoteDebuggerEntry, index?: number): string {
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

        str += `${prefix}${file}${line}`;

        return str;
    }
}
