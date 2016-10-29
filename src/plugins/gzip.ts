/// <reference types="node" />

/**
   vs-remote-debugger (GZIP plugin) (https://github.com/mkloubert/vs-remote-debugger)
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
