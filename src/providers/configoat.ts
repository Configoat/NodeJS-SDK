import axios, { AxiosInstance } from "axios";
import { ConfigurationsRecord, Environment } from "../types";
import { Provider } from "./base";
import { defaults } from "lodash";

export class ConfigoatProvider extends Provider {
    public environments: Environment[] = [];
    public apiUrl: string = "https://api.configoat.com";
    private axios: AxiosInstance = axios.create();

    constructor() {
        super("configoat");
    }

    public async getAll(): Promise<ConfigurationsRecord> {
        let configs: ConfigurationsRecord = {};

        for (const environment of this.environments) {
            const resp = await this.axios.get(`${this.apiUrl}/v1/environments/${environment.id}/configs`, {
                headers: {
                    Authorization: `Bearer ${environment.token}`
                }
            });

            const { configs: _configs } = resp.data;
    
            configs = defaults(configs, Object.fromEntries(_configs.map((config: any) => [config.key, config.value])));    
        }

        return configs;
    }

    async init(): Promise<void> {
    }
}