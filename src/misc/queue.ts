export interface IQueueNode<T> {
  next?: IQueueNode<T>;
  value: T;
}

export class Queue<T> {
  protected _dequeue?: IQueueNode<T>;
  protected _enqueue?: IQueueNode<T>;
  protected _size: number;

  public constructor() {
    this._size = 0;
  }

  public get size(): number {
    return this._size;
  }

  public get empty(): boolean {
    return this._size === 0;
  }

  public get notEmpty(): boolean {
    return this._size !== 0;
  }

  public *iter(): Generator<T> {
    let node: IQueueNode<T> | undefined = this._dequeue;
    while (node) {
      yield node.value;
      node = node.next;
    }
  }

  /**
   * Dequeues a value.
   * @returns the value that has been dequeued.
   */
  public dequeue(): T | undefined {
    // If the size is zero, return nothing.
    if (this._size === 0) return undefined;

    // Pops off the node.
    const node: IQueueNode<T> = this._dequeue!;
    this._dequeue = this._dequeue!.next;

    // Decreases the size, and clears the enqueue
    //  if the size is zero.
    if (--this._size === 0) this._enqueue = undefined;

    // Returns the removed value.
    return node.value;
  }

  /**
   * Enqueues a new value.
   * @param value the value to enqueue.
   * @returns the current instances.
   */
  public enqueue(value: T): this {
    // Creates the node.
    const node: IQueueNode<T> = {
      value,
    };

    // Inserts the node.
    if (this._enqueue) this._enqueue.next = node;
    this._enqueue = node;

    // Increases the size and sets the dequeue if
    //  the size is 1.
    if (++this._size === 1) this._dequeue = node;

    // Returns the current instance.
    return this;
  }
}
