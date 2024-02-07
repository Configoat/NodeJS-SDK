import { ExposedConfigurationsRecord, ModifyConfigBehavior, ServiceOptions } from "../types";
import { IService } from "./base";

export class MemoryService implements IService {
    private inMemoryConfig: ExposedConfigurationsRecord = {};

    public async get(): Promise<ExposedConfigurationsRecord> {
        return this.inMemoryConfig;
    }

    async update(key: string, value: any): Promise<void> {
        this.inMemoryConfig[key] = value;
    }
}