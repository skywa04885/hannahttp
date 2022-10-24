import path from "path";
import fs from "fs/promises";
import { HTTPSimpleRouterCallback } from "../router/simple-router";
import useStatic from "./static";
import childProcess from "child_process";
import { Logger } from "../logger";
import { HTTPServerSecure } from "../server/secure";
import { Scheduler } from "../misc/scheduler";

interface ILetsEncryptCertificateConfig {
  name: string;
  creationDate?: number;
  renewalDate?: number;
  expireDate?: number;
}

class LetsEncryptCertificateConfig {
  protected _modified: boolean;

  public constructor(
    public readonly name: string,
    public _creationDate?: Date,
    public _renewalDate?: Date,
    public _expireDate?: Date
  ) {
    this._modified = false;
  }

  public get renewalDate(): Date | undefined {
    return this._renewalDate;
  }

  public set renewalDate(date: Date | undefined) {
    this._renewalDate = date;
    this._modified = true;
  }

  public get expireDate(): Date | undefined {
    return this._expireDate;
  }

  public set expireDate(date: Date | undefined) {
    this._expireDate = date;
    this._modified = true;
  }

  public get creationDate(): Date | undefined {
    return this._creationDate;
  }

  public set creationDate(date: Date | undefined) {
    this._creationDate = date;
    this._modified = true;
  }

  public toObject(): ILetsEncryptCertificateConfig {
    return {
      name: this.name,
      creationDate: this._creationDate?.getTime(),
      renewalDate: this._renewalDate?.getTime(),
      expireDate: this._expireDate?.getTime(),
    };
  }

  public static fromObject(
    obj: ILetsEncryptCertificateConfig
  ): LetsEncryptCertificateConfig {
    return new LetsEncryptCertificateConfig(
      obj.name,
      obj.creationDate ? new Date(obj.creationDate) : undefined,
      obj.renewalDate ? new Date(obj.renewalDate) : undefined,
      obj.expireDate ? new Date(obj.expireDate) : undefined
    );
  }

  public async save(path: string): Promise<void> {
    // If not modified, do nothing.
    if (!this._modified) return;

    // Writes the file to the disk.
    await fs.writeFile(path, JSON.stringify(this.toObject()));

    // Sets modified to false.
    this._modified = false;
  }

  public static async load(
    path: string
  ): Promise<LetsEncryptCertificateConfig> {
    return this.fromObject(
      JSON.parse(
        await fs.readFile(path, {
          encoding: "utf-8",
        })
      )
    );
  }
}

export interface IUseLetsEncryptCertificate {
  name: string;
  domains: string[];
  rsaKeySize?: number;
  rsaKeyType?: "rsa" | "ecdsa";
  rsaPrivateKeys: string[];
  // ! Do not assign these yourself!
  directory?: string;
  configPath?: string;
}

export interface IUseLetsEncryptOptions {
  logger?: Logger;
  workingDirectory?: string;
  webrootDirectory?: string;
  certificates: IUseLetsEncryptCertificate[];
  email: string;
  certbotExecutable?: string;
  certbotLogDirectory?: string;
  certbotConfigDirectory?: string;
  renewInterval?: number;
}

export const useLetsEncrypt = async (
  secureServer: HTTPServerSecure,
  options: IUseLetsEncryptOptions
): Promise<[string, HTTPSimpleRouterCallback]> => {
  // Sets the default configurations.
  options.workingDirectory ??= path.join(process.cwd(), "env", "letsencrypt");
  options.webrootDirectory ??= path.join(options.workingDirectory, "webroot");
  options.certbotConfigDirectory ??= path.join(
    options.workingDirectory,
    "config"
  );
  options.certbotLogDirectory ??= path.join(options.workingDirectory, "log");
  options.certbotExecutable ??= "certbot";
  options.renewInterval ??= 1000 * 60 * 60 * 24 * 31;

  // Assigns the directories in the certificates.
  for (const certificate of options.certificates) {
    certificate.directory = path.join(
      options.workingDirectory!,
      "certificates",
      certificate.name
    );
    certificate.configPath = path.join(certificate.directory, "config.json");
  }

  // Creates the scheduler.
  const scheduler: Scheduler = new Scheduler();

  /**
   * Requests a new certificate.
   * @param certificate the certificate to request.
   * @returns a promise that resolves once requested.
   */
  const requestCertificate = async (
    certificate: IUseLetsEncryptCertificate
  ): Promise<void> => {
    // Logs.
    options.logger?.shouldInfo(() =>
      options.logger?.info(`Requesting certificate for "${certificate.name}"`)
    );

    // Creates the configuration.
    const config: LetsEncryptCertificateConfig =
      new LetsEncryptCertificateConfig(certificate.name);

    // Waits for the certbot process to execute.
    await new Promise<void>((resolve, reject): void => {
      // Executes the maintainance.
      childProcess.exec(
        [
          options.certbotExecutable,
          "certonly",
          `--config-dir="${options.certbotConfigDirectory}"`,
          `--logs-dir="${options.certbotLogDirectory}"`,
          `--work-dir="${options.workingDirectory}"`,
          `--webroot-path="${options.webrootDirectory}"`,
          "--webroot",
          "--keep-until-expiring",
          `--email=${options.email}`,
          `--agree-tos`,
          `--cert-name=${certificate.name}`,
          `--domains=${certificate.domains.join(",")}`,
          "--non-interactive",
          "--quiet",
        ].join(" "),
        (
          error: childProcess.ExecException | null,
          stdout: string,
          stderr: string
        ) => {
          // If there is an error, reject.
          if (error) reject(new Error(error.message));

          // Since there is no error, resolve and we
          //  assume that the certificate has been
          //  created.
          resolve();
        }
      );
    });

    // Restarts the secure server.
    await secureServer.restart();

    // Updates the configuration.
    config.creationDate = new Date();
    config.renewalDate = new Date();
    config.expireDate = new Date(Date.now() + options.renewInterval!);

    // Saves the configuration.
    await config.save(certificate.configPath!);

    // Schedules the maintainance task.
    scheduler.schedule(config.expireDate.getTime(), () =>
      requestCertificate(certificate)
    );

    // Logs.
    options.logger?.shouldInfo(() =>
      options.logger?.info(
        `Scheduled certificate renewal at: ${config.expireDate?.toLocaleDateString()}`
      )
    );
  };

  const renewCertificate = async (
    certificate: IUseLetsEncryptCertificate
  ): Promise<void> => {
    // Logs.
    options.logger?.shouldInfo(() =>
      options.logger?.info(`Renewing certificate "${certificate.name}"`)
    );

    // Loads the configuration.
    const config: LetsEncryptCertificateConfig =
      await LetsEncryptCertificateConfig.load(certificate.configPath!);

    // Waits for the certbot process to execute.
    await new Promise<void>((resolve, reject): void => {
      // Executes the renewal.
      childProcess.exec(
        [
          options.certbotExecutable,
          "renew",
          `--config-dir="${options.certbotConfigDirectory}"`,
          `--logs-dir="${options.certbotLogDirectory}"`,
          `--work-dir="${options.workingDirectory}"`,
          `--email=${options.email}`,
          `--agree-tos`,
          `--cert-name=${certificate.name}`,
          "--force-renew",
          "--quiet",
        ].join(" "),
        (
          error: childProcess.ExecException | null,
          stdout: string,
          stderr: string
        ) => {
          // If there is an error, reject.
          if (error) reject(new Error(error.message));

          // Since there is no error, resolve and we
          //  assume that the certificate has been
          //  renewed.
          resolve();
        }
      );
    });

    // Restarts the secure server.
    await secureServer.restart();

    // Sets the renewal and expire date.
    config.renewalDate = new Date();
    config.expireDate = new Date(Date.now() + options.renewInterval!);

    // Saves the configuration.
    await config.save(certificate.configPath!);
    // Schedules the maintainance task.
    scheduler.schedule(config.expireDate.getTime(), () =>
      requestCertificate(certificate)
    );

    // Logs.
    options.logger?.shouldInfo(() =>
      options.logger?.info(
        `Scheduled certificate renewal at: ${config.expireDate?.toLocaleDateString()}`
      )
    );
  };

  const initializeDirs = async (): Promise<void> => {
    // Gets all the directories that need to be created.
    const dirs: string[] = [
      options.workingDirectory!,
      options.webrootDirectory!,
      options.certbotConfigDirectory!,
      options.certbotLogDirectory!,
      ...options.certificates.map(
        (certificate: IUseLetsEncryptCertificate): string => {
          return path.join(
            options.workingDirectory!,
            "certificates",
            certificate.name
          );
        }
      ),
    ];

    // Creates all the directories.
    for (const dir of dirs)
      await fs.mkdir(dir, {
        recursive: true,
      });
  };

  // Initializes all the directories (does this first since other things might need it).
  options.logger?.shouldTrace(() =>
    options.logger?.trace(`Initializing all required directories.`)
  );
  await initializeDirs();
  options.logger?.shouldTrace(() =>
    options.logger?.trace(`Initialized all directores.`)
  );

  // Schedules tasks for the certificates.
  for (const certificate of options.certificates) {
    try {
      // Loads the configuration and makes sure that the
      // expire date has been specified.
      const config: LetsEncryptCertificateConfig =
        await LetsEncryptCertificateConfig.load(certificate.configPath!);
      if (!config.expireDate)
        throw new Error(`Expire date not found inside existing config!`);

      // Schedules the renewal of the certificate.
      scheduler.schedule(config.expireDate.getTime(), () =>
        renewCertificate(certificate)
      );

      // Logs.
      options.logger?.shouldInfo(() =>
        options.logger?.info(
          `Scheduled certificate renewal at: ${config.expireDate?.toLocaleDateString()}`
        )
      );
    } catch (_) {
      // The time to request the certificate.
      const time: number = Date.now() + 1000;

      // Since no configuration could be found, we assume
      //  that we need to request the certificate, so schedule
      //  a certificate request.
      scheduler.schedule(time, () => requestCertificate(certificate));

      // Logs.
      options.logger?.shouldInfo(() =>
        options.logger?.info(
          `Scheduled certificate request at: ${new Date(
            time
          ).toLocaleDateString()}`
        )
      );
    }
  }

  // Returns the callback.
  return [
    "/.well-known/acme-challenge/*",
    useStatic(
      path.join(options.webrootDirectory, ".well-known", "acme-challenge")
    ),
  ];
};
