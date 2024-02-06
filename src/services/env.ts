import { ExposedConfigurationsRecord, ProviderOptions } from "../types";
import { IService } from "./base";

export class EnvService implements IService {
    private initialDotEnv: ExposedConfigurationsRecord = process.env;

    public async get(): Promise<ExposedConfigurationsRecord> {
        return this.initialDotEnv;
    }

    options(): Partial<ProviderOptions> {
        return {
            useInFallback: false,
        };
    }
}