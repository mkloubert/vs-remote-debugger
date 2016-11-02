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

import { DebugProtocol } from 'vscode-debugprotocol';

/**
 * Describes a debugger context.
 */
export interface DebuggerContext {
    /**
     * Gets or sets the list of entries.
     */
    entries(entries?: RemoteDebuggerEntry[]): RemoteDebuggerEntry[];

    /**
     * Gets or sets the list of favorites.
     */
    favorites(favorites?: RemoteDebuggerFavorite[]): RemoteDebuggerFavorite[];

    /**
     * Gets the list of friends.
     */
    friends(): Friend[];

    /**
     * Gets the nickname.
     */
    nick(): string;

    /**
     * Returns the list of plugins.
     */
    plugins(): DebuggerPluginEntry[];

    /**
     * Gets the port the server is currently running on.
     */
    port(): number;

    /**
     * Gets the underlying session.
     */
    session: any;
}

/**
 * Describes a debugger plugin.
 */
export interface DebuggerPlugin {
    /**
     * Returns the list of names of supported commands.
     */
    commands?: () => string[];

    /**
     * Checks if an incoming entry should be dropped or not.
     * 
     * @param {RemoteDebuggerEntry} entry The entry to check.
     * 
     * @param {boolean} The entry will be dropped if (true) is returned; otherwise
     *                  it will be added to list.
     */
    dropEntry?: (entry: RemoteDebuggerEntry) => any;

    /**
     * Executes a command.
     * 
     * @param {DebuggerPluginExecutionContext} ctx The execution context.
     * 
     * @return {any} The result of the command that should be displayed in the debug console.
     */
    execute?: (ctx: DebuggerPluginExecutionContext) => any;

    /**
     * Returns information about that plugin.
     * 
     * @return {DebuggerPluginInfo} The information.
     */
    info?: () => DebuggerPluginInfo;

    /**
     * Processes an entry.
     * 
     * @param {RemoteDebuggerEntry} entry The entry to process.
     * 
     * @return {boolean} (true) indicates that no more plugins should
     *                   process the entry (again).
     */
    processEntry?: (entry: RemoteDebuggerEntry) => any;

    /**
     * Restores a transformed / encoded / crypted message.
     * 
     * @param {Buffer} [transformed] The transformed data.
     * 
     * @param {Buffer} The original data.
     */
    restoreMessage?: (transformed: Buffer) => Buffer;

    /**
     * Transforms a message into new data.
     * 
     * @param {Buffer} [msg] The UNtransformed data.
     * 
     * @param {Buffer} The transformed data.
     */
    transformMessage?: (msg: Buffer) => Buffer;
}

/**
 * Describes an entry for a debugger plugin.
 */
export interface DebuggerPluginEntry {
    /**
     * The underlying file.
     */
    file: {
        /**
         * The base name.
         */
        name: string,

        /**
         * The full path.
         */
        path: string,
    },

    /**
     * The name defined by the debugger.
     */
    name: string,

    /**
     * The underlying instance.
     */
    plugin: DebuggerPlugin,
}

/**
 * Provides information about a plugin.
 */
export interface DebuggerPluginInfo {
    /**
     * Information about the constributors.
     */
    constributors?: {
        /**
         * eMail address
         */
        email?: string;

        /**
         * Username on GitHub
         */
        github?: string;

        /**
         * Homepage
         */
        homepage?: string;

        /**
         * Name / nick
         */
        name?: string;

        /**
         * Username on Twitter (without leading @ char!)
         */
        twitter?: string;
    }[],

    /**
     * A short description that the plugin does.
     */
    description?: string;

    /**
     * (Project) homepage.
     */
    homepage?: string;

    /**
     * The name of the license
     */
    license?: string;

    /**
     * Display name.
     */
    name?: string;

    /**
     * Version
     */
    version?: string;
}

/**
 * Describes a context for a plugin execution.
 */
export interface DebuggerPluginExecutionContext {
    /**
     * The arguments from the debug console.
     */
    arguments: string;

    /**
     * The name of the underlying plugin.
     */
    name: string;

    /**
     * Writes something to the output.
     * 
     * @param {any} msg The data to write.
     * 
     * @chainable
     */
    write: (msg: any) => DebuggerPluginExecutionContext;
    
    /**
     * Writes something to the output and adds a "new line".
     * 
     * @param {any} [msg] The data to write.
     * 
     * @chainable
     */
    writeLine: (msg?: any) => DebuggerPluginExecutionContext;
}

/**
 * Describes a debugger plugin module.
 */
export interface DebuggerPluginModule {
    /**
     * Creates a new instance.
     * 
     * @param {DebuggerContext} ctx The debugger context.
     * @param {String} [config] (Serialized) Config data.
     * 
     * @param {DebuggerPlugin} The new instance.
     */
    create?: (ctx: DebuggerContext, config: string) => DebuggerPlugin; 
}

/**
 * A friend entry.
 */
export interface Friend {
    /**
     * The target address.
     */
    address: string;
    
    /**
     * The name.
     */
    name?: string;

    /**
     * The TCP port.
     */
    port?: number;
}

/**
 * Stores a range of numbers.
 */
export interface NumberRange {
    /**
     * The end.
     */
    end?: number;

    /**
     * Checks if a value is in range or not.
     */
    isInRange(val?: number): boolean;

    /**
     * The start.
     */
    start?: number;
}

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
     * List of log messages.
     */
    __logs?: {
        /**
         * The name of the author.
         */
        author?: string;

        /**
         * The message.
         */
        message?: string;

        /**
         * The log time.
         */
        time?: Date,
    }[],

    /**
     * Notes
     */
    n?: string;

    /**
     * The first machine that sends the entry.
     */
    __origin?: {
        /**
         * The address / hostname.
         */
        address?: string;

        /**
         * The TCP port.
         */
        port?: number;

        /**
         * The timestamp.
         */
        time?: Date,
    },

    /**
     * The stacktrace.
     */
    s?: RemoteDebuggerStackFrame[];

    /**
     * The list of threads.
     */
    t?: RemoteDebuggerThread[];

    /**
     * The time the entry has arrived.
     */
    __time?: Date;

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
     * The initial counter value.
     */
    counter?: number;

    /**
     * The format that is used to generate names for message files.
     */
    filenameFormat?: string;

    /**
     * List of friends.
     */
    friends?: string[];

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
     * The nickname of the debugger's user.
     */
    nick?: string;

    /**
     * List of plugins to load.
     */
    plugins?: string[];

    /**
     * The TCP port.
     */
    port?: number;
}

/**
 * Describes a debugger entry favorite.
 */
export interface RemoteDebuggerFavorite {
    /**
     * The underlying entry.
     */
    entry: RemoteDebuggerEntry;
    
    /**
     * The index beginning at 1.
     */
    index: number;
}

/**
 * The default maximum size of a debugger message.
 */
export const DEFAULT_MAX_MESSAGE_SIZE = 16777215;

/**
 * The default TCP port.
 */
export const DEFAULT_PORT = 5979;
