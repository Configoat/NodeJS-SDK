import axios, { AxiosInstance } from "axios";
import { ExposedConfigurationsRecord, Environment, ModifyConfigBehavior } from "../types";
import { defaults } from "lodash";
import { IService } from "./base";

export class ConfigoatService implements IService {
    private rawConfigs: any[] = [];
    private axios: AxiosInstance = axios.create();

    constructor(private environments: Environment[], private apiUrl: string) {}

    public async get(): Promise<ExposedConfigurationsRecord> {
        let configs: ExposedConfigurationsRecord = {};
        let _rawConfigs: any[] = [];

        for (const environment of this.environments) {
            const resp = await this.axios.get(`${this.apiUrl}/v1/environments/${environment.id}/configs`, {
                headers: {
                    Authorization: `Bearer ${environment.token}`
                }
            });

            const { configs: _configs } = resp.data;

            _rawConfigs = _rawConfigs.concat(_configs);

            configs = defaults(configs, Object.fromEntries(_configs.map((config: any) => [config.key, config.value])));
        }

        this.rawConfigs = _rawConfigs;

        return configs;
    }

    private async updateInEnvironment(config: any, key: string, value: string) {
        await this.axios.patch(`${this.apiUrl}/v1/environments/${config.environment}/configs`, {
            "configs": [
                {
                    "_id": config._id,
                    "key": key,
                    "value": value,
                    "notes": config.notes
                }
            ]
        }, {
            headers: {
                Authorization: `Bearer ${this.environments.find((env: Environment) => env.id === config.environment)?.token}`
            }
        });
    }

    private async createInEnvironment(environmentId: string, key: string, value: string) {
        const resp = await this.axios.patch(`${this.apiUrl}/v1/environments/${environmentId}/configs`, {
            "configs": [
                {
                    "key": key,
                    "value": value,
                    "notes": ""
                }
            ]
        }, {
            headers: {
                Authorization: `Bearer ${this.environments.find((env: Environment) => env.id === environmentId)?.token}`
            }
        });

        this.rawConfigs.push(resp.data.configs.at(-1));
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
        const config = this.rawConfigs.find((config: any) => config.key === key);
        if (!config) {
            await this.createInEnvironment(this.environments[0].id, key, value);
            return;
        }
        
        await this.updateInEnvironment(config, key, value);
    }

    async updateAll(key: string, value: string) {
        for (const environment of this.environments) {
            const config = this.rawConfigs.find((config: any) => config.key === key && config.environment === environment.id);
            if (!config) {
                await this.createInEnvironment(environment.id, key, value);
                continue;
            }

            await this.updateInEnvironment(config, key, value);
        }
    }

    private async deleteInEnvironment(config: any) {
        await this.axios.delete(`${this.apiUrl}/v1/environments/${config.environment}/configs`, {
            headers: {
                Authorization: `Bearer ${this.environments.find((env: Environment) => env.id === config.environment)?.token}`
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