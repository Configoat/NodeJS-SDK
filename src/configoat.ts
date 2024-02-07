import { defaults } from "lodash";
import { Environment, ExposedConfigurationsRecord, InitOptions, InternalConfigurationsRecord, ModifyConfigBehavior, ProviderOptions } from "./types";
import EventEmitter from "events";
import { deepEqual } from "./utils";
import { ConfigoatService, EnvService, MemoryService, LocalJSONService } from "./services";

const defaultProviderOptions: ProviderOptions = {
    useInFallback: true,
};

const defaultEnvs: Environment[] = process.env.CONFIGOAT_ENVIRONMENTS?.split(",").map(e => {
    const data = e.trim().split(":");

    return {
        id: data[0],
        token: data[1],
    };
}) || [];

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
        services: [],
        environments: defaultEnvs,
        fallbacks: [
            new LocalJSONService(),
        ],
        configoatService: true,
        envService: true,
        autoReload: true,
        autoReloadInterval: 1000 * 60,
        setProcessEnv: false,
        modifyConfigBehavior: ModifyConfigBehavior.FIRST,
    };
    private eventEmitter: EventEmitter = new EventEmitter();
    private configoatProvider?: ConfigoatService;
    // Internal configs list
    private configs: InternalConfigurationsRecord = [];
    // Exposed configs list
    public env: ExposedConfigurationsRecord = new Proxy({}, {
        get: (target, key) => {
            return this.configurationRecord[key as string];
        },
        set: (target, key, value) => {
            this.setConfig(key as string, value);
            return true;
        },
        deleteProperty: (target, key) => {
            this.setConfig(key as string, undefined);
            return true;
        }
    });

    private get configurationRecord(): ExposedConfigurationsRecord {
        return this.configs.reduce((acc, { config }) => (defaults(acc, config)), {});
    }

    public async init(options: Partial<InitOptions> = {}) {
        this.options = defaults(options, this.options);

        const validFallbacks = this.options.fallbacks.filter(f => f.save);
        if (validFallbacks.length !== this.options.fallbacks.length) {
            const invalidFallbacks = this.options.fallbacks.filter(f => !f.save);

            console.warn(`Fallbacks ${invalidFallbacks.map(f => f.constructor.name).join(", ")} doesn't have a save method. Ignoring them.`)
        }
        this.options.fallbacks = validFallbacks;

        if (this.options.apiUrl.endsWith("/")) {
            this.options.apiUrl = this.options.apiUrl.slice(0, -1);
        }

        if (this.options.configoatService) {
            this.configoatProvider = new ConfigoatService(this.options.environments, this.options.apiUrl);
            this.options.services.unshift(this.configoatProvider);
        }

        if (this.options.envService) {
            this.options.services.push(new EnvService());
        }

        // In memory provider is always first
        this.options.services.unshift(new MemoryService());

        let useFallbacks = false;

        for (const provider of [...this.options.services, ...this.options.fallbacks]) {
            try {
                await provider.init?.();
            }
            catch (e) {
                console.error("There was an error with one of the services during init, using fallback and removing this service.", e);
                this.options.services = this.options.services.filter(s => s !== provider);
                useFallbacks = true;
            }
        }

        await this.reload(useFallbacks);

        if (this.options.autoReload) {
            this.startAutoReload(this.options.autoReloadInterval);
        }
    }

    public async reload(useFallbacks = false) {
        let newConfigs: InternalConfigurationsRecord = [];

        for (const provider of this.options.services) {
            try {
                newConfigs.push({
                    name: provider.constructor.name,
                    config: await provider.get(),
                    options: defaults(provider.options?.(), defaultProviderOptions) as ProviderOptions,
                });
            }
            catch (e) {
                console.error("There was an error with one of the providers during config fetching, using fallback", e);
                useFallbacks = true;
            }
        }

        if (useFallbacks) {            
            for (const fallback of this.options.fallbacks) {
                try {
                    newConfigs.push({
                        name: fallback.constructor.name,
                        config: await fallback.get(),
                        options: defaults(fallback.options?.(), defaultProviderOptions) as ProviderOptions,
                    });
                }
                catch (e) {
                    console.error("There was an error with one of the fallbacks", e);
                }
            }
        }

        const oldConfigurationRecord = this.configurationRecord;
        this.configs = newConfigs;
        const newConfigurationRecord = this.configurationRecord;

        if (this.options.setProcessEnv) {
            process.env = newConfigurationRecord;
        }

        this.saveToFallbacksInBackground();

        // Optional things to do after reload. It happens after setting the config just in case error happens.
        const deleted = Object.keys(oldConfigurationRecord).filter(key => !(key in newConfigurationRecord));
        const created = Object.keys(newConfigurationRecord).filter(key => !(key in oldConfigurationRecord));
        const updated = Object.keys(newConfigurationRecord).filter(key => key in oldConfigurationRecord && !deepEqual(newConfigurationRecord[key], oldConfigurationRecord[key]));

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

    public async import() {
        if (!this.configoatProvider) {
            throw new Error("Configoat provider must be initialized to perform input.");
        }

        if (this.options.modifyConfigBehavior === ModifyConfigBehavior.ALL) {
            await this.configoatProvider.updateAllMultiple(this.configurationRecord);
        }

        else if (this.options.modifyConfigBehavior === ModifyConfigBehavior.FIRST) {
            await this.configoatProvider.updateEnvironmentMultiple(this.options.environments[0], this.configurationRecord);
        }

        else {
            throw new Error(`ModifyConfigBehavior ${this.options.modifyConfigBehavior} is not supported for import`);
        }
    }

    private async startAutoReload(interval: number) {
        setInterval(() => {
            this.reload();
        }, interval);
    }

    private async changeConfigSideEffects() {
        if (this.options.setProcessEnv) {
            process.env = this.configurationRecord;
        }

        this.saveToFallbacksInBackground();
    }

    private async setConfig(key: string, value: any) {
        const configServiceData = this.configs.find(v => key in v.config);

        const setInMemory = async () => {
            this.configs[0].config[key] = value;
            await this.changeConfigSideEffects();
            await this.options.services[0].update!(key, value, this.options.modifyConfigBehavior);
        }

        // Local always behaves the same
        if (this.options.modifyConfigBehavior === ModifyConfigBehavior.MEMORY) {
            await setInMemory();
            return;
        }

        // If all services should be updated, update all of them no matter what
        if (this.options.modifyConfigBehavior === ModifyConfigBehavior.ALL) {
            await setInMemory();
            await Promise.all(this.options.services.slice(1).filter(s => s.update).map(async s => {
                try {
                    await s.update!(key, value, this.options.modifyConfigBehavior);
                }
                catch (e) {
                    console.error(`Error updating ${s.constructor.name}. The rest of the services are updated.`, e);
                }
            }));
            return;
        }

        // If first one should be updated, there's some logic
        if (this.options.modifyConfigBehavior === ModifyConfigBehavior.FIRST) {
            // If the config doesn't exist, updating the first service that supports updating
            if (!configServiceData) {
                const service = this.options.services.slice(1).find(s => s.update);

                if (!service) {
                    await setInMemory();
                    return;
                }

                this.configs.find(v => v.name === service.constructor.name)!.config[key] = value;
                await this.changeConfigSideEffects();
                try {
                    await service.update!(key, value, this.options.modifyConfigBehavior);
                } catch (e) {
                    console.error(`Error updating ${service.constructor.name}`, e);
                }
                return;
            }

            const configService = this.options.services.find(s => s.constructor.name === configServiceData.name);

            // If config exists, but the service doesn't support updating, changing the value only in memory
            if (!configService?.update) {
                console.warn("Attempted to update a config that didn't come from a service that supports updating. Changing the value only in memory.");
                await setInMemory();
                return;
            }

            this.configs.find(v => v.name === configServiceData.name)!.config[key] = value;
            await this.changeConfigSideEffects();
            try {
                await configService.update(key, value, this.options.modifyConfigBehavior);
            } catch (e) {
                console.error(`Error updating ${configService.constructor.name}`, e);
            }
            return;
        }

        throw new Error(`Invalid modifyConfigBehavior: ${this.options.modifyConfigBehavior}`);
    }

    private saveToFallbacksInBackground() {
        const record = Object.values(this.configs).filter(v => v.options.useInFallback).reduce((acc, { config }) => (defaults(acc, config)), {});
        Promise.all(this.options.fallbacks.map(fallback => fallback.save!(record).catch(console.error)));
    }
}