import axios, { AxiosInstance } from "axios";
import { ExposedConfigurationsRecord, Environment, ModifyConfigBehavior } from "../types";
import { defaults } from "lodash";
import { IService } from "./base";

export class ConfigoatService implements IService {
    private rawConfigs: any[] = [];
    private axios: AxiosInstance = axios.create();

    constructor(private environments: Environment[], private apiUrl: string) { }

    private getToken(env: string) {
        const token = this.environments.find(e => e.id === env)?.token;

        if (!token) {
            throw new Error(`Token not found for environment ${env}`);
        }

        if (token.startsWith("U")) {
            return `User ${token}`;
        }

        return `Bearer ${token}`;
    }

    public async get(): Promise<ExposedConfigurationsRecord> {
        let configs: ExposedConfigurationsRecord = {};
        let _rawConfigs: any[] = [];

        for (const environment of this.environments) {
            const resp = await this.axios.get(`${this.apiUrl}/v1/environments/${environment.id}/configs`, {
                headers: {
                    Authorization: this.getToken(environment.id)
                }
            });

            const { configs: _configs } = resp.data;

            _rawConfigs = _rawConfigs.concat(_configs);

            configs = defaults(configs, Object.fromEntries(_configs.map((config: any) => [config.key, config.value])));
        }

        this.rawConfigs = _rawConfigs;

        return configs;
    }

    async update(key: string, value: any, modifyConfigBehavior: ModifyConfigBehavior) {
        if (modifyConfigBehavior === ModifyConfigBehavior.FIRST) {
            await (value === undefined ? this.deleteFirst(key) : this.updateFirst(key, value));
        }
        else if (modifyConfigBehavior === ModifyConfigBehavior.ALL) {
            await (value === undefined ? this.deleteAll(key) : this.updateAll(key, value));
        }
        else if (modifyConfigBehavior === ModifyConfigBehavior.MEMORY) {
            // Do nothing
        }
        else {
            throw new Error(`Invalid modifyConfigBehavior: ${modifyConfigBehavior}`);
        }
    }

    async updateFirst(key: string, value: string) {
        await this.updateEnvironmentMultiple(this.environments[0], {
            [key]: value
        });
    }

    async updateAll(key: string, value: string) {
        await this.updateAllMultiple({
            [key]: value
        });
    }

    async updateEnvironmentMultiple(environment: Environment, _configs: ExposedConfigurationsRecord) {
        const newConfig = Object.entries(_configs)
            .filter(([key, _]) => !this.rawConfigs.find(c => c.key === key))
            .map(([key, value]) => ({ key, value, notes: "" }));

        const existingConfigs = this.rawConfigs.map(config => _configs[config.key] === undefined ? config : { ...config, value: _configs[config.key] });

        await this.axios.patch(`${this.apiUrl}/v1/environments/${environment.id}/configs`, {
            configs: [
                ...newConfig,
                ...existingConfigs,
            ],
        }, {
            headers: {
                Authorization: this.getToken(environment.id)
            }
        });
    }

    async updateAllMultiple(_configs: ExposedConfigurationsRecord) {
        await Promise.all(this.environments.map(env => this.updateEnvironmentMultiple(env, _configs)));
    }

    private async deleteInEnvironment(config: any) {
        await this.axios.delete(`${this.apiUrl}/v1/environments/${config.environment}/configs`, {
            headers: {
                Authorization: this.getToken(config.environment)
            },
            data: {
                "configs": [
                    {
                        "_id": config._id
                    }
                ]
            }
        });
    }

    async deleteFirst(key: string) {
        const config = this.rawConfigs.find((config: any) => config.key === key);
        if (!config) {
            throw new Error(`Config with key ${key} not found`); // TODO: Error handling
        }

        await this.deleteInEnvironment(config);
    }

    async deleteAll(key: string) {
        for (const environment of this.environments) {
            const config = this.rawConfigs.find((config: any) => config.key === key && config.environment === environment.id);
            if (!config) {
                continue;
            }

            await this.deleteInEnvironment(config);
        }
    }
}