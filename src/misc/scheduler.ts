export interface IScheduledTask {
  time: number;
  callback: () => any;
}

export class Scheduler {
  protected _timeout?: NodeJS.Timeout;
  protected _queue: IScheduledTask[];

  public constructor() {
    this._queue = []
  }

  public *iter(): Generator<IScheduledTask> {
    for (const val of this._queue) yield val;
  }

  protected _run(): void {
    // Gets the current time.
    const now: number = Date.now();

    // Loop over all the tasks, as long as they should run.
    let i: number;
    for (i = 0; i < this._queue.length; ++i) {
      // Gets the scheduled task, and checks if it should
      //  be ran now.
      const task: IScheduledTask = this._queue[i];
      if (task.time > now) break;

      // Runs the task.
      task.callback();
    }

    // Trims off all the ran tasks.
    this._queue.splice(0, i);

    // Sets the next timeout.
    this._setTimeout();
  }

  protected _setTimeout(): void {
    // Cancels the current timer if there.
    if (this._timeout) {
      this._timeout.unref();
      this._timeout = undefined;
    }

    // Gets the time to run the task, and if there
    //  is no task, just return.
    const task: IScheduledTask | undefined = this._queue[0];
    if (!task) return;

    // Calculates the milliseconds for the timeout.
    const now: number = Date.now();
    const ms: number = now > task.time ? task.time - now : 0;

    // Sets the timeout.
    this._timeout = setTimeout(() => this._run(), ms);
  }

  public schedule(time: number, callback: () => Promise<void>): void {
    // Creates the task.
    const task: IScheduledTask = {
      time,
      callback,
    };

    // Pushes the task to the queue.
    this._queue.push(task);

    // Sorts the queue.
    this._queue.sort((a: IScheduledTask, b: IScheduledTask): number => {
      return a.time > b.time ? 1 : -1;
    });

    // Updates the timeout.
    this._setTimeout();
  }
}
