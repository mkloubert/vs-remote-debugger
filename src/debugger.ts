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

import * as vsrd_console from './console';
import * as vsrd_contracts from './contracts';
import * as vscode_dbg_adapter from 'vscode-debugadapter';
import { basename } from 'path';
import { DebugProtocol } from 'vscode-debugprotocol';
import FS = require('fs');
import Net = require('net');
import OS = require("os");
import Path = require('path');

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
     * Stores the console manager.
     */
    protected _console: vsrd_console.ConsoleManager;
    /**
     * List of friends.
     */
    protected _friends: vsrd_contracts.Friend[];
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
    protected _entries: vsrd_contracts.RemoteDebuggerEntry[] = [];
    /**
     * Stores the list of favorites.
     */
    protected _favorites: vsrd_contracts.RemoteDebuggerFavorite[] = [];
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
     * Creates and sets up a console manager.
     * 
     * @param {vsrd_contracts.LaunchRequestArgument} args The launch arguments.
     */
    protected createConsoleManager(args: vsrd_contracts.LaunchRequestArguments): vsrd_console.ConsoleManager {
        let me = this;
        
        let mgr = new vsrd_console.ConsoleManager(this);

        return mgr;
    }

    /**
     * Gets the current entry.
     */
    public get entry(): vsrd_contracts.RemoteDebuggerEntry {
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

        let handled = false;
        let responseSend = false;

        let c = me._console;
        if (c) {
            
            let result: vsrd_console.ExecuteCommandResult = {
                args: args,
                body: function(b?) {
                    let r: DebugProtocol.EvaluateResponse = response;
                    if (!r) {
                        return;
                    }

                    if (arguments.length > 0) {
                        let newBody: vsrd_console.ExecuteCommandResponseBody;
                        
                        if (b || '' === b) {
                            if (typeof b === 'string' || b instanceof String) {
                                b = {
                                    result: '' + b,
                                    variablesReference: 0,
                                };
                            }

                            newBody = b;
                            if (!newBody.result) {
                                newBody.result = '';
                            }
                            if (!newBody.variablesReference) {
                                newBody.variablesReference = 0;
                            }
                        }

                        r.body = <any>newBody;
                    }

                    return r.body;
                },
                currentEntry: () => me.entry,
                currentIndex: function(nv?) {
                    if (arguments.length > 0) {
                        me._currentEntry = nv;
                    }

                    return me._currentEntry;
                },
                entries: function(e?) {
                    if (arguments.length > 0) {
                        me._entries = e;
                    }

                    return me._entries;
                },
                favorites: function(f?) {
                    if (arguments.length > 0) {
                        me._favorites = f;
                    }

                    return me._favorites;
                },
                friends: () => me._friends,
                gotoIndex: function(newIndex?: number, response?: DebugProtocol.EvaluateResponse) {
                    if (arguments.length < 1) {
                        me.gotoIndex();
                    }
                    else if (arguments.length < 2) {
                        me.gotoIndex(newIndex);
                    }
                    else {
                        me.gotoIndex(newIndex, response);
                    }
                },
                handled: false,
                isDebug: function(nv?) {
                    if (arguments.length > 0) {
                        me._isDebug = nv;
                    }

                    return me._isDebug;
                },
                isPaused: function(nv?) {
                    if (arguments.length > 0) {
                        me._isPaused = nv;
                    }

                    return me._isPaused;
                },
                sendEvent: function(e?) {
                    if (e) {
                        me.sendEvent(e);
                    }
                },
                sendResponse: function(r?) {
                    if (!responseSend) {
                        responseSend = true;
                    
                        if (arguments.length < 1) {
                            r = response;
                        }

                        if (r) {
                            me.sendResponse(r);
                        }
                    }
                },
                sourceRoot: function() {
                    return me._sourceRoot;
                },
                write: function(m?) {
                    if (m) {
                        this.sendEvent(new vscode_dbg_adapter.OutputEvent('' + m));
                    }
                },
                writeLine: function(m?) {
                    if (!m) {
                        m = '';
                    }

                    this.write(m + '\n');
                }
            };

            try {
                c.evaluateRequest(result);
            }
            catch (e) {
                //TODO: output error
            }

            handled = result.handled;
        }

        if (!handled) {
            response.body = null;
            
            if (!responseSend) {
                me.sendResponse(response);
            }
        }
    }

    /**
     * Returns the value and type of a variable to display.
     * 
     * @param {RemoteDebuggerVariable} [ve] The variable.
     * 
     * @return {Object} The type and display.
     */
    protected getDisplayVariable(ve?: vsrd_contracts.RemoteDebuggerVariable): { type?: string, value?: any } {
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
    protected launchRequest(response: DebugProtocol.LaunchResponse, args: vsrd_contracts.LaunchRequestArguments): void {
        // this.log('launchRequest');
        
        let me = this;

        me._sourceRoot = args.localSourceRoot;
        me._console = me.createConsoleManager(args);

        // load friends
        me._friends = [];

        let findDefaultName = () => {
            let defName: string;
            let i = 0;
            let nameExists: boolean;
            do {
                nameExists = false;

                defName = '#' + ++i;
                
                for (let j = 0; j < me._friends.length; j++) {
                    if (me._friends[j].name == defName) {
                        nameExists = true;
                        break;
                    }
                }    
            }
            while (nameExists);

            return defName;
        };

        if (args.friends) {
            for (let i = 0; i < args.friends.length; i++) {
                let friend = args.friends[i];
                if (friend) {
                    friend = ('' + friend).trim();
                }

                if (!friend) {
                    continue;
                }

                let newEntry: vsrd_contracts.Friend = {
                    address: friend,
                    port: vsrd_contracts.DEFAULT_PORT,
                };

                // friend name
                let addrNameSeparator = newEntry.address.indexOf('=');
                if (addrNameSeparator > -1) {
                    newEntry.name = newEntry.address.substr(addrNameSeparator + 1).trim();

                    newEntry.address = newEntry.address.substr(0, addrNameSeparator).trim();
                }

                // TCP port
                let addrPortSeparator = newEntry.address.indexOf(':');
                if (addrPortSeparator > -1) {
                    let fp = newEntry.address.substr(addrPortSeparator + 1).trim();
                    if (fp) {
                        newEntry.port = parseInt(fp);
                    }

                    newEntry.address = newEntry.address.substr(0, addrPortSeparator).trim();
                }

                if (newEntry.address && !isNaN(newEntry.port)) {
                    // normalize and add entry
                    // if data is valid
                    
                    newEntry.address = newEntry.address.toLowerCase().trim();
                    
                    if (!newEntry.name) {
                        newEntry.name = findDefaultName();
                    }
                    newEntry.name = newEntry.name.toLowerCase().trim();

                    me._friends.push(newEntry);
                }
            }
        }

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
        // this.log('setBreakPointsRequest: ' + args.breakpoints.length);
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

        let port = vsrd_contracts.DEFAULT_PORT;
        if (opts.port) {
            port = opts.port;
        }

        let maxMsgSize = vsrd_contracts.DEFAULT_MAX_MESSAGE_SIZE;
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
                        let now = new Date();

                        if (!buff || buff.length < 1) {
                            return;
                        }

                        let json = buff.toString('utf8');

                        let entry: vsrd_contracts.RemoteDebuggerEntry = JSON.parse(json);
                        if (!entry) {
                            return;
                        }

                        entry.__time = now;
                        if (!entry.__origin) {
                            entry.__origin = {
                                address: socket.remoteAddress,
                                port: socket.remotePort,
                                time: now,
                            };
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

        let addVariables = (v?: vsrd_contracts.RemoteDebuggerVariable[]): boolean => {
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
            let findChildVariables: (ve?: vsrd_contracts.RemoteDebuggerVariable) => vsrd_contracts.RemoteDebuggerVariable[];
            findChildVariables = (ve?) => {
                if (ve) {
                    if (ve.r > 1) {
                        if (ve.r == args.variablesReference) {
                            return ve.v;
                        }

                        let foundChildren: vsrd_contracts.RemoteDebuggerVariable[];
                        
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

                            let children: vsrd_contracts.RemoteDebuggerVariable[] = ve.v;
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
                let vars: vsrd_contracts.RemoteDebuggerVariable[];

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
