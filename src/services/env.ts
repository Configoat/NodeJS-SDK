import { ExposedConfigurationsRecord, ServiceOptions } from "../types";
import { IService } from "./base";

export class EnvService implements IService {
    private initialDotEnv: ExposedConfigurationsRecord = process.env;

    public async get(): Promise<ExposedConfigurationsRecord> {
        return this.initialDotEnv;
    }

    options(): Partial<ServiceOptions> {
        return {
            useInFallback: false,
            useInImport: false,
        };
    }
}