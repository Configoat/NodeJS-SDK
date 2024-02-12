import { ExposedConfigurationsRecord, ServiceOptions } from "../types";
import { IService } from "./base";

export class JSONService implements IService {
    constructor(private json: any) {}

    public async get(): Promise<ExposedConfigurationsRecord> {
        return this.json;
    }
}