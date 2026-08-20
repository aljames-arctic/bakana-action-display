import { BaseFoundryAdapter } from './base-foundry-adapter.js';

export class FoundryV13Adapter extends BaseFoundryAdapter {
    get generation() {
        return 13;
    }
}
