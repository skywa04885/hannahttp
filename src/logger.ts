export enum LoggerLevel {
  Trace = 0,
  Info = 1,
  Warn = 2,
  Error = 3,
}

export class Logger {
  public constructor(
    public readonly label: string,
    public level: LoggerLevel
  ) {}

  public should(level: LoggerLevel, callback: () => void): this {
    if (level >= this.level) callback();
    return this;
  }

  public shouldTrace(callback: () => void): this {
    return this.should(LoggerLevel.Trace, callback);
  }

  public shouldInfo(callback: () => void): this {
    return this.should(LoggerLevel.Info, callback);
  }

  public shouldWarn(callback: () => void): this {
    return this.should(LoggerLevel.Warn, callback);
  }

  public shouldError(callback: () => void): this {
    return this.should(LoggerLevel.Error, callback);
  }

  public trace(...args: any[]): this {
    return this.log(LoggerLevel.Trace, ...args);
  }

  public info(...args: any[]): this {
    return this.log(LoggerLevel.Info, ...args);
  }

  public warn(...args: any[]): this {
    return this.log(LoggerLevel.Warn, ...args);
  }

  public error(...args: any[]): this {
    return this.log(LoggerLevel.Error, ...args);
  }

  public log(level: LoggerLevel, ...args: any[]): this {
    // Produces the line we'll print.
    const line = `${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()} [${
      LoggerLevel[this.level]
    }] ${this.label} : ${args
      .map((item: any): string => item.toString())
      .join(" ")}`;

    // Prints the line.
    if (level === LoggerLevel.Error) console.error(line);
    else console.log(line);

    // Returns the current instance.
    return this;
  }
}
