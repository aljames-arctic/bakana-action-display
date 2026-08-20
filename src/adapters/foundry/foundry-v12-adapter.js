import { BaseFoundryAdapter } from './base-foundry-adapter.js';

export class FoundryV12Adapter extends BaseFoundryAdapter {
    get generation() {
        return 12;
    }
}
