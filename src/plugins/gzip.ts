/// <reference types="node" />

// The MIT License (MIT)
// 
// vs-remote-debugger (GZIP plugin) (https://github.com/mkloubert/vs-remote-debugger)
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

import * as vsrd_contracts from '../contracts';
import ZLib = require("zlib");

/**
 * A plugin for (un)compressing debugger messages.
 * 
 * @author Marcel Joachim Kloubert <marcel.kloubert@gmx.net>
 */
class GZipPlugin implements vsrd_contracts.DebuggerPlugin {
    /**
     * Stores the debugger context.
     */
    protected _context: vsrd_contracts.DebuggerContext;
    
    /**
     * Initializes a new instance of that class.
     * 
     * @param {vsrd_contracts.DebuggerContext} ctx The underlying debugger context.
     */
    constructor(ctx: vsrd_contracts.DebuggerContext) {
        this._context = ctx;
    }

    /** @inheritdoc */
    public info(): vsrd_contracts.DebuggerPluginInfo {
        return {
            constributors: [
                // Marcel Kloubert
                {
                    email: 'marcel.kloubert@gmx.net',
                    name: 'Marcel J. Kloubert',
                    github: 'mkloubert',
                    twitter: 'mjkloubert',
                },
            ],
            name: "GZip",
            description: "Compresses or decompresses debugger messages with GZIP",
            version: "1.0.0",
            homepage: "https://github.com/mkloubert/vs-remote-debugger",
            license: 'MIT',
        };
    }
    
    /** @inheritdoc */
    public restoreMessage(transformed: Buffer): Buffer {
        if (!transformed) {
            return;
        }

        return ZLib.gunzipSync(transformed);
    }

    /** @inheritdoc */
    public transformMessage(msg: Buffer): Buffer {
        if (!msg) {
            return;
        }

        return ZLib.gzipSync(msg);
    }
}

/**
 * Creates a new plugin instance.
 * 
 * @param {vsrd_contracts.DebuggerContext} ctx The underlying debugger context.
 * 
 * @return {vsrd_contracts.DebuggerPlugin} The new instance.
 */
export function create(ctx: vsrd_contracts.DebuggerContext): vsrd_contracts.DebuggerPlugin {
    return new GZipPlugin(ctx);
}
