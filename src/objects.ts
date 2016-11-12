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
import FS = require('fs')
import Path = require('path');
var Temp = require('temp');
import ZLib = require("zlib");

/**
 * A basic sequence.
 */
export abstract class EnumerableBase<T> implements vsrd_contracts.Enumerable<T> {
    /** @inheritdoc */
    public abstract clone(): vsrd_contracts.Enumerable<T>;

    /** @inheritdoc */
    public count(): number {
        let c = 0;
        while (this.moveNext()) {
            ++c;
        }

        return c;
    }

    /** @inheritdoc */
    public abstract get current(): T;

    /** @inheritdoc */
    public abstract get key(): any;

    /** @inheritdoc */
    public abstract moveNext(): boolean;

    /** @inheritdoc */
    public abstract reset(): void;

    /** @inheritdoc */
    public toArray(): T[] {
        let newArray: T[] = [];
        while (this.moveNext()) {
            newArray.push(this.current);
        }

        return newArray;
    }

    /** @inheritdoc */
    public toArrayAll(): T[] {
        return this.toArray();
    }
}

/**
 * A sequence that is based on an index.
 */
export abstract class IndexedEnumerableBase<T> extends EnumerableBase<T> {
    /**
     * Stores the current index.
     */
    protected _index: number = -1;

    /**
     * Initializes a new instance of that class.
     */
    constructor() {
        super();
    }

    /** @inheritdoc */
    public get key(): number {
        return this._index;
    }

    /** @inheritdoc */
    public reset(): void {
        this._index = -1;
    }

    /** @inheritdoc */
    public toArrayAll(): T[] {
        let curIndex = this._index;
        try {
            this._index = 0;
            return this.toArray();
        }
        finally {
            this._index = curIndex;
        }
    }
}

/**
 * A basic collection.
 */
export abstract class CollectionBase<T> extends IndexedEnumerableBase<T> implements vsrd_contracts.Collection<T> {
    /**
     * Stores the length of the collection.
     */
    protected _length = 0;

    /** @inheritdoc */
    public abstract clear(): void;

    /** @inheritdoc */
    public get length() {
        return this._length;
    }

    /** @inheritdoc */
    public moveNext(): boolean {
        let newIndex = this._index + 1;
        if (newIndex < this.length) {
            this._index = newIndex;
            return true;
        }

        return false;
    }

    /** @inheritdoc */
    public abstract push(item?: T): void;

    /** @inheritdoc */
    public pushArray(items?: T[]): void {
        let me = this;
        
        if (items) {
            items.forEach(x => me.push(x));
        }
    }
}

/**
 * A collection based on an array.
 */
export class ArrayCollection<T> extends CollectionBase<T> implements vsrd_contracts.Collection<T> {
    /**
     * The underlying array.
     */
    protected _array: T[] = [];
    
    /**
     * Initializes a new instance of that class.
     * 
     * @param {T[]} array The underlying array.
     */
    constructor(arr?: T[]) {
        super();

        if (arr) {
            this._array = arr;
        }
    }

    /** @inheritdoc */
    public clone(): ArrayCollection<T> {
        let clonedColl = new ArrayCollection<T>(this._array);
        clonedColl._index = -1;

        return clonedColl;
    }

    /** @inheritdoc */
    public clear() {
        this._array = [];
    }

    /** @inheritdoc */
    public get current(): T {
        return this._array[this._index];
    }

    /** @inheritdoc */
    public get length(): number {
        return this._array.length;
    }

    /** @inheritdoc */
    public push(item?: T) {
        if (arguments.length > 0) {
            this._array
                .push(item);
        }
    }
}

/**
 * A basic disposable object.
 */
export abstract class DisposableBase implements vsrd_contracts.Disposable {
    protected _isDisposed = false;

    /** @inheritdoc */
    public get isDisposed(): boolean {
        return this._isDisposed;
    }

    /** @inheritdoc */
    public dispose(): void {
        this.disposeInner(true);
    }

    private disposeInner(disposing: boolean): void {
        if (disposing && this._isDisposed) {
            return;
        }

        this.disposing(disposing);

        if (disposing) {
            this._isDisposed = true;
        }
    }

    /**
     * The logic for the 'dispose()' method.
     * 
     * @param {boolean} disposing 'dispose()' method has been invoked or not.
     */
    protected disposing(disposing: boolean) {
        // dummy
    }
}

/**
 * A collection that is based on JSON files.
 */
export class JsonFileCollection<T> extends CollectionBase<T> implements vsrd_contracts.DisposableCollection<T> {
    /**
     * Stores the directory where the JSON files should be stored.
     */
    protected _dir: string;
    protected _lengthFunc: (newValue?: number) => number;

    /**
     * Initializes a new instance of that class.
     */
    constructor(initialize: boolean = true) {
        super();

        if (initialize) {
            this.init();
        }
    }

    /** @inheritdoc */
    public clear() {
        let oldLength = this._lengthFunc();
        for (let i = 0; i < oldLength; i++) {
            try {
                let filePath = this.getFilePathByIndex(i);
                if (FS.existsSync(filePath)) {
                    FS.unlinkSync(filePath);
                }
            }
            catch (e) { }
        }

        this._lengthFunc(0);
    }

    /** @inheritdoc */
    public clone(): JsonFileCollection<T> {
        let clonedColl = new JsonFileCollection<T>(false);
        clonedColl._index = -1;
        clonedColl._lengthFunc = this._lengthFunc;
        clonedColl._dir = this._dir;

        return clonedColl;
    }

    /** @inheritdoc */
    public get current(): any {
        try {
            let filePath = this.getFilePathByIndex(this._index);

            let item: T;
            if (FS.existsSync(filePath)) {
                let buffer = FS.readFileSync(filePath);
                if (buffer.length > 0) {
                    buffer = ZLib.gunzipSync(buffer);
                    if (buffer.length > 0) {
                        let json = buffer.toString('utf8');
                        if (json) {
                            item = JSON.parse(json);
                        }
                    }
                }
            }

            return item;
        }
        catch (e) {
            return false;
        }
    }

    /** @inheritdoc */
    public dispose(): void {
        Temp.cleanupSync();
    }

    /**
     * Returns a full file path by index.
     * 
     * @param {number} index The index.
     */
    protected getFilePathByIndex(index: number): string {
        let fileName = index + '.json.gz';

        return Path.join(this._dir, fileName);
    }

    /**
     * Initializes the instance.
     */
    protected init() {
        let me = this;
        
        this._dir = Temp.mkdirSync('vsrd_');

        this._lengthFunc = function(newValue?: number): number {
            if (arguments.length > 0) {
                me._length = newValue;
            }
            
            return me._length;
        }

        this.clear();
        this.reset();
    }

    /** @inheritdoc */
    public get length(): number {
        return this._lengthFunc();
    }

    /** @inheritdoc */
    public push(item?: T): boolean {
        if (arguments.length < 1) {
            return;
        }

        try {
            let newLength = this._lengthFunc(this._lengthFunc() + 1);

            let filePath = this.getFilePathByIndex(newLength - 1);

            let json = '';
            if (item) {
                json = JSON.stringify(item);
            }

            let buffer = new Buffer(json, 'utf8');
            buffer = ZLib.gzipSync(buffer);

            if (FS.existsSync(filePath)) {
                FS.unlinkSync(filePath);
            }

            FS.writeFileSync(filePath, buffer);

            return true;
        }
        catch (e) {
            this._lengthFunc(this._lengthFunc() - 1);
            return false;
        }
    }
}
