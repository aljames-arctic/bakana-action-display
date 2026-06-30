import { MidiQolModuleAdapter } from './midi-qol-module-adapter.js';

/**
 * Registry of module adapters. 
 * Maps module IDs to their corresponding adapter classes.
 */
export const MODULE_ADAPTERS = {
    'midi-qol': MidiQolModuleAdapter
};