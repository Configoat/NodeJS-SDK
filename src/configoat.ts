import { defaults } from "lodash";
import { ConfigurationsRecord, InitOptions, ModifyConfigBehavior } from "./types";
import { EnvProvider } from "./providers";
import EventEmitter from "events";
import { deepEqual } from "./utils";
import { ConfigoatProvider } from "./providers/configoat";

export class Configoat {
    // Static
    
    private static instance: Configoat = new Configoat();
    static get env() {
        return Configoat.instance.env;
    }

    public static async init(options: Partial<InitOptions> = {}) {
        await Configoat.instance.init({
            setProcessEnv: true,
            ...options,
        });
    }

    public static async reload() {
        await Configoat.instance.reload();
    }

    public static async onReload(callback: (changes: { deleted: string[], created: string[], updated: string[] }) => void) {
        await Configoat.instance.onReload(callback);
    }

    public static async offReload(callback: (changes: { deleted: string[], created: string[], updated: string[] }) => void) {
        await Configoat.instance.offReload(callback);
    }

    // Instance
    
    private options: InitOptions = {
        apiUrl: "https://api.configoat.com",
        providers: [],
        environments: [],
        defaultProviders: true,
        autoReload: true,
        autoReloadInterval: 1000*60,
        setProcessEnv: false,
        modifyConfigBehavior: ModifyConfigBehavior.FIRST_ENVIRONMENT,
    };
    private eventEmitter: EventEmitter = new EventEmitter();
    private configoatProvider: ConfigoatProvider = new ConfigoatProvider();
    // Internal configs list
    private configs: ConfigurationsRecord = {};
    // Exposed configs list
    public env: ConfigurationsRecord = new Proxy({}, {
        get: (target, key) => {
            return this.configs[key as string];
        },
        set: (target, key, value) => {
            this.setConfig(key as string, value);
            return true;
        },
        deleteProperty: (target, key) => {
            this.deleteConfig(key as string);
            return true;
        }
    });

    public async init(options: Partial<InitOptions> = {}) {
        this.options = defaults(options, this.options);

        if (this.options.defaultProviders) {
            this.options.providers.unshift(this.configoatProvider);

            if (!this.hasProvider("process.env")) {
                this.options.providers.push(new EnvProvider());
            }
        }

        if (this.options.apiUrl.endsWith("/")) {
            this.options.apiUrl = this.options.apiUrl.slice(0, -1);
        }

        for (const provider of this.options.providers) {
            // Inject required data
            if (provider.name === "configoat") {
                (provider as ConfigoatProvider).environments = this.options.environments;
                (provider as ConfigoatProvider).apiUrl = this.options.apiUrl;
            }

            await provider.init();
        }

        await this.reload();

        if (this.options.autoReload) {
            this.startAutoReload(this.options.autoReloadInterval);
        }
    }

    private hasProvider(name: string) {
        return this.options.providers.some(p => p.name === name);
    }

    public async reload() {
        let newConfigs: ConfigurationsRecord = {};

        for (const provider of this.options.providers) {
            newConfigs = defaults(newConfigs, await provider.getAll());
        }

        const oldConfigs = this.configs;        
        this.configs = newConfigs;
        process.env = newConfigs;

        // Optional things to do after reload. It happens after setting the config just in case error happens.
        const deleted = Object.keys(oldConfigs).filter(key => !(key in newConfigs));
        const created = Object.keys(newConfigs).filter(key => !(key in oldConfigs));
        const updated = Object.keys(newConfigs).filter(key => key in oldConfigs && !deepEqual(newConfigs[key], oldConfigs[key]));
    
        this.eventEmitter.emit("reload", {
            deleted,
            created,
            updated,
        });
    }

    public async onReload(callback: (changes: { deleted: string[], created: string[], updated: string[] }) => void) {
        this.eventEmitter.on("reload", callback);
    }

    public async offReload(callback: (changes: { deleted: string[], created: string[], updated: string[] }) => void) {
        this.eventEmitter.off("reload", callback);
    }

    private async startAutoReload(interval: number) {
        setInterval(() => {
            this.reload();
        }, interval);   
    }

    private async setConfig(key: string, value: any) {
        this.configs[key] = value;

        if (this.options.setProcessEnv) {
            process.env[key] = value;
        }

        if (this.options.modifyConfigBehavior === ModifyConfigBehavior.FIRST_ENVIRONMENT) {
            await this.configoatProvider.updateFirst(key, value);
        }
        else if (this.options.modifyConfigBehavior === ModifyConfigBehavior.ALL_ENVIRONMENTS) {
            await this.configoatProvider.updateAll(key, value);
        }
        else if (this.options.modifyConfigBehavior === ModifyConfigBehavior.LOCAL_ONLY) {
            // Do nothing
        }
        else {
            throw new Error(`Invalid modifyConfigBehavior: ${this.options.modifyConfigBehavior}`);
        }
    }

    private async deleteConfig(key: string) {
        delete this.configs[key];

        if (this.options.setProcessEnv) {
            delete process.env[key];
        }

        if (this.options.modifyConfigBehavior === ModifyConfigBehavior.FIRST_ENVIRONMENT) {
            await this.configoatProvider.deleteFirst(key);
        }
        else if (this.options.modifyConfigBehavior === ModifyConfigBehavior.ALL_ENVIRONMENTS) {
            await this.configoatProvider.deleteAll(key);
        }
        else if (this.options.modifyConfigBehavior === ModifyConfigBehavior.LOCAL_ONLY) {
            // Do nothing
        }
        else {
            throw new Error(`Invalid modifyConfigBehavior: ${this.options.modifyConfigBehavior}`);
        }
    }
}