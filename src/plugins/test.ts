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

/**
 * This is a test plugin.
 * 
 * @author Marcel Joachim Kloubert <marcel.kloubert@gmx.net>
 */
class TestPlugin implements vsrd_contracts.DebuggerPlugin {
    /**
     * Stores the debugger context.
     */
    protected _context: vsrd_contracts.DebuggerContext;
    /**
     * The submitted configuration.
     */
    protected _config: string;
    
    /**
     * Initializes a new instance of that class.
     * 
     * @param {vsrd_contracts.DebuggerContext} ctx The underlying debugger context.
     */
    constructor(ctx: vsrd_contracts.DebuggerContext,
                config: string) {
        
        this._context = ctx;
        this._config = config;
    }

    /** @inheritdoc */
    public commands(): string[] {
        return [ "Test" ];
    }

    /** @inheritdoc */
    public execute(ctx: vsrd_contracts.DebuggerPluginExecutionContext): any {
        ctx.writeLine(`You are executing '${ctx.name}' plugin from '${__filename}' file with the following arguments:`)
           .writeLine(ctx.arguments);

        return 'This is a test result.';
    }
}

/**
 * Creates a new plugin instance.
 * 
 * @param {vsrd_contracts.DebuggerContext} ctx The underlying debugger context.
 * @param {String} config The submitted configuration string from debug console.
 * 
 * @return {vsrd_contracts.DebuggerPlugin} The new instance.
 */
export function create(ctx: vsrd_contracts.DebuggerContext,
                       config: string): vsrd_contracts.DebuggerPlugin {

    return new TestPlugin(ctx, config);
}
