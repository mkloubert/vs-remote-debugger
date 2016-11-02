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

import * as vsrd_contracts from '../contracts';
import * as vsrd_helpers from '../helpers';
import Net = require('net');

/**
 * A TCP based server.
 */
class TcpServer implements vsrd_contracts.Server {
    /**
     * Stores the debugger context.
     */
    protected _context: vsrd_contracts.DebuggerContext;
    /**
     * The current server.
     */
    protected _server: Net.Server;

    /**
     * Initializes a new instance of that class.
     * 
     * @param {vsrd_contracts.DebuggerContext} ctx The underlying debugger context.
     */
    constructor(ctx: vsrd_contracts.DebuggerContext) {
        this._context = ctx;
    }

    /** @inheritdoc */
    public start(ctx: vsrd_contracts.StartServerContext): Promise<TcpServerStartedEventArguments> {
        let me = this;

        let port: number = vsrd_contracts.DEFAULT_PORT;
        if (ctx.port) {
            port = ctx.port;
        }

        let maxMsgSize = vsrd_contracts.DEFAULT_MAX_MESSAGE_SIZE;
        if (ctx.maxMessageSize) {
            maxMsgSize = ctx.maxMessageSize;
        }

        return new Promise<TcpServerStartedEventArguments>((resolve, reject) => {
            let invokeCompleted = (err?: vsrd_contracts.ErrorContext) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve({
                        port: port,
                        server: me,
                    });
                }
            };
            
            let showError = (err, category: string) => {
                ctx.log('[ERROR :: TCP Server :: ' + category + '] ' + err);
            };

            try {
                let newServer = Net.createServer((socket) => {
                    try {
                        let remoteAddr = socket.remoteAddress;
                        let remotePort = socket.remotePort;

                        let closeSocket = () => {
                            try {
                                socket.destroy();
                            }
                            catch (e) {
                                showError(e, 'createServer.closeSocket');
                            }
                        };

                        // first read dataLength
                        vsrd_helpers.readSocket(socket, 4).then((dlBuff) => {
                            if (4 != dlBuff.length) {  // must have the size of 4
                                closeSocket();
                                return;
                            }

                            let dataLength = dlBuff.readUInt32LE(0);
                            if (dataLength < 0 || dataLength > maxMsgSize) {  // out of range
                                closeSocket();
                                return;
                            }

                            // now read the debugger message
                            vsrd_helpers.readSocket(socket, dataLength).then((buff) => {
                                closeSocket();
                                
                                if (buff.length != dataLength) {  // non-exptected data length
                                    return;
                                }

                                ctx.entryReceived({
                                    entry: buff,
                                    remote: {
                                        address: remoteAddr,
                                        port: remotePort,
                                    },
                                    sender: me,
                                });
                            }, (err) => {
                                // could not read debugger message

                                showError(err, "createServer.readSocket(2)");
                                closeSocket();
                            });
                        }, (err) => {
                            // could not read dataLength

                            showError(err, "createServer.readSocket(1)");
                            closeSocket();
                        });
                    }
                    catch (e) {
                        // fatal error
                        showError(e, "createServer");
                    }
                });

                newServer.on('listening', (err) => {
                    if (err) {
                        me._server = newServer;

                        invokeCompleted({
                            category: 'listening',
                            error: err,
                        });
                    }
                    else {
                        invokeCompleted();
                    }
                });

                newServer.on('error', (err) => {
                    if (err) {
                        showError(err, "error");
                    }
                });

                newServer.listen(port);
            }
            catch (e) {
                invokeCompleted({
                    category: 'listen',
                    error: e,
                });
            }
        });
    }

    /** @inheritdoc */
    public stop(opts: vsrd_contracts.StopServerContext): Promise<TcpServerStoppedEventArguments> {
        let me = this;
        
        return new Promise<TcpServerStoppedEventArguments>((resolve, reject) => {
            let invokeCompleted = (err?: vsrd_contracts.ErrorContext) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve({
                        server: me,
                    });
                }
            };

            let srv = me._server;
            if (!srv) {
                invokeCompleted();
                return;
            }

            try {
			    srv.close(function(err) {
                    if (err) {
                        invokeCompleted({
                            category: 'close.2',
                            error: err,
                        });

                        return;
                    }

                    me._server = null;
                    invokeCompleted();
                });
            }
            catch (e) {
                invokeCompleted({
                    category: 'close.1',
                    error: e,
                });
            }
        });
    }
}

class TcpServerStartedEventArguments implements vsrd_contracts.ServerStartedEventArguments {
    /** @inheritdoc */
    public port: number;

    /** @inheritdoc */
    public server: TcpServer;
}

class TcpServerStoppedEventArguments implements vsrd_contracts.ServerStoppedEventArguments {
    /** @inheritdoc */
    public server: TcpServer;
}

/** @inheritdoc */
export function create(ctx): vsrd_contracts.Server {
    return new TcpServer(ctx);
}
