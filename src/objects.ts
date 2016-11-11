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

import * as vsrd_contracts from './contracts';

/**
 * A sequence based on an array.
 */
export class ArrayEnumerable<T> implements vsrd_contracts.Enumerable<T> {
    /**
     * The underlying array.
     */
    protected _array: T[];
    /**
     * The current index.
     */
    protected _index;
    
    /**
     * Initializes a new instance of that class.
     * 
     * @param {T[]} array The underlying array.
     */
    constructor(arr?: T[]) {
        this._array = arr || [];

        this.reset();
    }

    /** @inheritdoc */
    public count(): number {
        let c = 0;
        while (this.moveNext()) {
            ++c;
        }

        return c;
    }

    /** @inheritdoc */
    public get current(): T {
        return this._array[this._index];
    }

    /** @inheritdoc */
    public moveNext() {
        let newIndex = this._index + 1;
        if (newIndex < this._array.length) {
            this._index = newIndex;
            return true;
        }

        return false;
    }

    /** @inheritdoc */
    public reset(): void {
        this._index = -1;
    }

    /** @inheritdoc */
    public toArray(): T[] {
        let newArray: T[] = [];
        while (this.moveNext()) {
            newArray.push(this.current);
        }

        return newArray;
    }
}

/**
 * A collection based on an array.
 */
export class ArrayCollection<T> extends ArrayEnumerable<T> implements vsrd_contracts.Collection<T> {
    /** @inheritdoc */
    public clear() {
        this._array = [];
    }

    /** @inheritdoc */
    public get length(): number {
        return this._array.length;
    }

    /** @inheritdoc */
    public push(item: T) {
        this._array
            .push(item);
    }
}
