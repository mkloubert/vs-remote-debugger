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

import Net = require('net');

/**
 * Returns the similarity of strings.
 * 
 * @param {string} left The "left" string.
 * @param {string} right The "right" string.
 * @param {boolean} [ignoreCase] Compare case insensitive or not.
 * @param {boolean} [trim] Trim both strings before comparison or not.
 * 
 * @return {Number} The similarity between 0 (0 %) and 1 (100 %).
 */
export function getStringSimilarity(left: string, right: string,
                                    ignoreCase?: boolean, trim?: boolean) {
    if (left === right) {
        return 1;
    }

    if (isNullOrUndefined(left) ||
        isNullOrUndefined(right)) {
        return 0;
    }

    if (arguments.length < 4) {
        if (arguments.length < 3) {
            ignoreCase = false;
        }
        
        trim = false;
    }

    if (ignoreCase) {
        left = left.toLowerCase();
        right = right.toLowerCase();
    }
    
    if (trim) {
        left = left.trim();
        right = right.trim();
    }
    
    let distance = 0;
    
    if (left !== right) {
        let matrix = new Array(left.length + 1);
        for (let i = 0; i < matrix.length; i++) {
            matrix[i] = new Array(right.length + 1);
            
            for (let ii = 0; ii < matrix[i].length; ii++) {
                matrix[i][ii] = 0;
            } 
        }
        
        for (let i = 0; i <= left.length; i++) {
            // delete
            matrix[i][0] = i;
        }
        
        for (let j = 0; j <= right.length; j++) {
            // insert
            matrix[0][j] = j;
        }
        
        for (let i = 0; i < left.length; i++) {
            for (let j = 0; j < right.length; j++) {
                if (left[i] === right[j]) {
                    matrix[i + 1][j + 1] = matrix[i][j];
                }
                else {
                    // delete or insert
                    matrix[i + 1][j + 1] = Math.min(matrix[i][j + 1] + 1,
                                                    matrix[i + 1][j] + 1);

                    // substitution
                    matrix[i + 1][j + 1] = Math.min(matrix[i + 1][j + 1],
                                                    matrix[i][j] + 1);
                }
            }
            
            distance = matrix[left.length][right.length];
        }
    }
    
    return 1.0 - distance / Math.max(left.length,
                                     right.length);
}

/**
 * Checks if a value is (null) or (undefined).
 * 
 * @param {any} val The value to check.
 * 
 * @return {boolean} Is (null)/(undefined) or not.
 */
export function isNullOrUndefined(val: any): boolean {
    return null === val ||
           undefined === val;
}

/**
 * Normalizes a string.
 * 
 * @param {any} The input value.
 * 
 * @return {String} The normalized value.
 */
export function normalizeString(str: any): string {
    if (str) {
        str = ('' + str).trim();
    }
    if (!str) {
        str = '';
    }

    return str;
}

/**
 * Reads a number of bytes from a socket.
 * 
 * @param {Net.Socket} socket The socket.
 * @param {Number} numberOfBytes The amount of bytes to read.
 * 
 * @return {Promise<Buffer>} The promise.
 */
export function readSocket<T>(socket: Net.Socket, numberOfBytes: number, tag?: T): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
        try {
            let buff: Buffer = socket.read(numberOfBytes);
            if (null === buff) {
                socket.once('readable', function() {
                    readSocket(socket, numberOfBytes).then((b) => {
                        resolve(b);
                    }, (err) => {
                        reject(err);
                    });
                });
            }
            else {
                resolve(buff);
            }
        }
        catch (e) {
            reject(e);
        }
    });
}
