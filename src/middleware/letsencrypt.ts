import path from "path";
import fs from "fs/promises";
import { HTTPSimpleRouterCallback } from "../router/simple-router";
import useStatic from "./static";
import childProcess from "child_process";

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

  public get expireDate(): Date | undefined {
    return this._expireDate;
  }

  public get creationDate(): Date | undefined {
    return this._creationDate;
  }

  public set creationDate(date: Date | undefined) {
    this._creationDate = date;
    this._modified = true;
  }

  public set expireDate(date: Date | undefined) {
    this._expireDate = date;
    this._modified = true;
  }

  public set renewalDate(date: Date | undefined) {
    this._renewalDate = date;
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
  workingDirectory?: string;
  webrootDirectory?: string;
  certificates: IUseLetsEncryptCertificate[];
  email: string;
  certbotExecutable?: string;
  certbotLogDirectory?: string;
  certbotConfigDirectory?: string;
}

export const useLetsEncrypt = async (
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

  // Assigns the directories in the certificates.
  for (const certificate of options.certificates) {
    certificate.directory = path.join(
      options.workingDirectory!,
      "certificates",
      certificate.name
    );
    certificate.configPath = path.join(certificate.directory, "config.json");
  }

  /**
   * Requests a new certificate.
   * @param certificate the certificate to request.
   * @returns a promise that resolves once requested.
   */
  const requestCertificate = (
    certificate: IUseLetsEncryptCertificate
  ): Promise<void> => {
    return new Promise((resolve, reject): void => {
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
        ].join(" "),
        (
          error: childProcess.ExecException | null,
          stdout: string,
          stderr: string
        ) => {
          console.log(stdout);
          // If there is an error, reject.
          if (error) reject(new Error(error.message));

          // Since there is no error, resolve and we
          //  assume that the certificate has been
          //  created.
          resolve();
        }
      );
    });
  };

  const renewCertificate = (
    certificate: IUseLetsEncryptCertificate
  ): Promise<void> => {
    return new Promise((resolve, reject): void => {
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
        ].join(" "),
        (
          error: childProcess.ExecException | null,
          stdout: string,
          stderr: string
        ) => {
          console.log(stdout);
          // If there is an error, reject.
          if (error) reject(new Error(error.message));

          // Since there is no error, resolve and we
          //  assume that the certificate has been
          //  renewed.
          resolve();
        }
      );
    });
  };

  /**
   * Maintains the given certificate.
   * @param certificate the certificate to maintain.
   * @returns a promise that resolves once maintained.
   */
  const maintainCertificate = async (
    certificate: IUseLetsEncryptCertificate
  ): Promise<void> => {
    // Gets the directories to work with.

    // Checks if the config file exists, if so read it.
    let config: LetsEncryptCertificateConfig;
    try {
      config = await LetsEncryptCertificateConfig.load(certificate.configPath!);
    } catch (_) {
      config = new LetsEncryptCertificateConfig(certificate.name);
    }

    if (!config.renewalDate) {
      // Request new certificate.
      await requestCertificate(certificate);

      // Sets the creation date to indicate the certificate has been created.
      config.creationDate = new Date();

      // Sets the renewal date and the expire date.
      //  the expire date is set to the next month to ensure
      //  proper renewal, even though, the certificate lasts 90 days.
      config.renewalDate = new Date();
      config.expireDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 31);
    } else if (config.expireDate!.getTime() < Date.now()) {
      // Renew existing certificate.
      await renewCertificate(certificate);

      // Sets the renewal date and the expire date.
      //  the expire date is set to the next month to ensure
      //  proper renewal, even though, the certificate lasts 90 days.
      config.renewalDate = new Date();
      config.expireDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 31);
    }

    // Saves the config.
    await config.save(certificate.configPath!);
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
  await initializeDirs();

  // Maintains all the certificates (however does this without blocking the rest of the application).
  (async (): Promise<void> => {
    for (const certificate of options.certificates)
      await maintainCertificate(certificate);
  })();

  // Returns the callback.
  return [
    "/.well-known/acme-challenge/*",
    useStatic(
      path.join(options.webrootDirectory, ".well-known", "acme-challenge")
    ),
  ];
};
