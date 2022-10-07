/*
  HannaHTTP extremely fast and customizable HTTP server.
  Copyright (C) Luke A.C.A. Rieff 2022

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { EventEmitter, Readable } from "stream";
import fs from "fs";
import net from "net";
import tls from "tls";
import { buffer } from "stream/consumers";

////////////////////////////////////////////////////
// (LOCAL) Write Operation Queue
////////////////////////////////////////////////////

class _WriteOperationQueue {
  protected _head: _WriteOperation | null;
  protected _tail: _WriteOperation | null;
  protected _size: number;

  /**
   * Constructs a new write operation queue.
   */
  public constructor() {
    this._head = this._tail = null;
    this._size = 0;
  }

  /**
   * Gets the size.
   */
  public get size(): number {
    return this._size;
  }

  /**
   * Checks if the queue is empty.
   */
  public get empty(): boolean {
    return this.size === 0;
  }

  /**
   * Dequeues an write operation.
   * @returns the dequeued write operation.
   */
  public dequeue(): _WriteOperation | null {
    // Return null if the queue is empty.
    if (this._size === 0) return null;

    // Pop of the head of the queue.
    const op: _WriteOperation = this._head!;
    this._head = this._head!.next;
    op.next = null;

    // Decrements the sizze.
    --this._size;

    // Returns the popped-off write operation.
    return op;
  }

  /**
   * Enqueues the given write operation.
   * @param op the operation to enqueue.
   * @returns the current instance.
   */
  public enqueue(op: _WriteOperation): this {
    // If the head and tail are null, make the new op both.
    if (this._size++ === 0) {
      this._head = this._tail = op;
      return this;
    }

    // Enqueues the element at the tail of the queue.
    this._tail!.next = op;
    this._tail = op;

    // Returns the current instance.
    return this;
  }
}

export class _WriteOperation {
  /**
   * Constructs a new write operation.
   * @param next the next write operation.
   */
  public constructor(public next: _WriteOperation | null = null) {}
}

export class _ReadableWriteOperation extends _WriteOperation {
  /**
   * Constructs a new readable write operation.
   * @param readable the readable stream to use.
   * @param next the next write operation.
   */
  public constructor(
    public readonly readable: Readable,
    next: _WriteOperation | null = null
  ) {
    super(next);
  }

  /**
   * Creates a readable write operation from the given file.
   * @param filePathString the path of the file to create the readable stream of.
   * @param encoding the encoding to read the file with.
   * @returns the write operation.
   */
  public static fromFile(
    filePathString: string,
    encoding: BufferEncoding = "binary"
  ): _ReadableWriteOperation {
    return new _ReadableWriteOperation(
      fs.createReadStream(filePathString, {
        encoding,
      })
    );
  }

  /**
   * Creates a readable write operation from the given buffer.
   * @param buffer the buffer to read from.
   * @returns the write operation.
   */
  public static fromBuffer(buffer: Buffer): _ReadableWriteOperation {
    return new _ReadableWriteOperation(Readable.from(buffer));
  }
}

////////////////////////////////////////////////////
// (GLOBAL) HTTP Client Socket
////////////////////////////////////////////////////

export class HTTPClientSocket {
  protected _writeOperationsQueue: _WriteOperationQueue;
  protected _writeOperation: _WriteOperation | null;

  /**
   * Constructs a new http client socket.
   * @param socket the socket to use.
   */
  public constructor(public readonly socket: net.Socket) {
    this._writeOperationsQueue = new _WriteOperationQueue();
    this._writeOperation = null;
  }

  /**
   * Wraps the given socket in a http client socket.
   * @param socket the socket to wrap.
   * @returns the wrapped socket.
   */
  public static fromSocket(socket: net.Socket) {
    return new HTTPClientSocket(socket);
  }

  /**
   * If the socket is tls or not.
   * @returns the boolean indicating if the socket is tls or not.
   */
  public get secure(): boolean {
    return this.socket instanceof tls.TLSSocket;
  }

  /**
   * Destroys the socket.
   * @returns the current instance.
   */
  public destroy(): this {
    this.socket.destroy();
    return this;
  }

  /**
   * Runs the next write operation.
   */
  protected _nextWriteOperation(): void {
    // If there aren't any write operations left, just return.
    if (this._writeOperationsQueue.empty) {
      this._writeOperation = null;
      return;
    }

    // Dequeues the available write operation into the current write operation.
    this._writeOperation = this._writeOperationsQueue.dequeue();

    // Checks if the write operation is a readable operation, if so pipe it to the
    //  socket without ending the stream when it's done.
    if (this._writeOperation instanceof _ReadableWriteOperation) {
      this._writeOperation.readable.once("end", () => this._nextWriteOperation());
      this._writeOperation.readable.pipe(this.socket, {
        end: false,
      });

      return;
    }

    // Just run the next one, and throw warning since this one cannot be runned.
    console.warn("Write operation skipped due to incompatible type.");
    this._nextWriteOperation();
  }

  /**
   * Enqueues the writing of the given file.
   * @param filePath the path of the file to write.
   * @param bufferEncoding the encoding of the buffer.
   */
  public writeFile(
    filePath: string,
    bufferEncoding: BufferEncoding = "binary"
  ): this {
    // Constructs the operation with the given filename.
    const operation: _WriteOperation = _ReadableWriteOperation.fromFile(
      filePath,
      bufferEncoding
    );

    // Enqueues the operation.
    this._writeOperationsQueue.enqueue(operation);

    // Checks if there is only one write operation, if so we'll run it immediately.
    if (this._writeOperation === null) this._nextWriteOperation();

    // Returns the current instance.
    return this;
  }

  /**
   * Writes the given buffer.
   * @param buffer the buffer to enqueue.
   * @returns the current instance.
   */
  public writeBuffer(buffer: Buffer): this {
    // Constructs the operation.
    const operation: _ReadableWriteOperation =
      _ReadableWriteOperation.fromBuffer(buffer);

    // Enqueues the operation.
    this._writeOperationsQueue.enqueue(operation);

    // Checks if there is only one write operation, if so we'll run it immediately.
    if (this._writeOperation === null) this._nextWriteOperation();

    // Returns the current instance,
    return this;
  }
}
