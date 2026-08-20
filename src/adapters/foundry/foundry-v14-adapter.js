import { BaseFoundryAdapter } from './base-foundry-adapter.js';

export class FoundryV14Adapter extends BaseFoundryAdapter {
    get generation() {
        return 14;
    }
}
