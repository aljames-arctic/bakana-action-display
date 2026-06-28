import { BaseModuleAdapter } from './base-module-adapter.js';

/**
 * Module adapter for 'midi-qol' (D&D5e automation).
 * Identifies actions that are automated by Midi-QOL and flags them for the UI.
 */
export class MidiQolModuleAdapter extends BaseModuleAdapter {
    constructor() {
        super('midi-qol');
    }

    /**
     * Process actions and check for Midi-QOL automation flags.
     * @param {Object[]} actions The current list of actions
     * @param {Actor} actor 
     * @returns {Object[]} The modified actions
     */
    modifyActions(actions, actor) {
        const modified = [];

        for (const action of actions) {
            const item = action.originalItem;
            if (!item) {
                modified.push(action);
                continue;
            }

            // 1. Check if the action has consolidated activities
            const activities = action.systemData?.activities;
            if (activities && activities.length > 0) {
                // Filter out activities that are marked as automationOnly
                const filteredActivities = activities.filter(entry => {
                    const isAutomationOnly = entry.activity.midiProperties?.automationOnly === true;
                    return !isAutomationOnly;
                });

                // If all activities are automation-only, hide the entire item!
                if (filteredActivities.length === 0) {
                    continue; // Skip this action entirely (filters it out of the HUD)
                }

                // If some activities were filtered out, update the action's activities and tabs
                if (filteredActivities.length < activities.length) {
                    action.systemData.activities = filteredActivities;

                    // Recalculate unique tabs based on the remaining activities
                    const uniqueTabs = [];
                    const seenTabKeys = new Set();

                    for (const entry of filteredActivities) {
                        const parentTab = entry.parentTab;
                        const subTab = entry.subTab;
                        const key = subTab ? `${parentTab}/${subTab}` : parentTab;
                        if (!seenTabKeys.has(key)) {
                            seenTabKeys.add(key);
                            uniqueTabs.push(subTab ? [parentTab, subTab] : [parentTab]);
                        }
                    }
                    action.tabs = uniqueTabs;
                }
            }

            // 2. Keep the existing midiAutomated flag logic for the item
            const midiFlags = item.flags?.['midi-qol'];
            action.extra = action.extra ?? {};
            if (midiFlags) {
                action.extra.midiAutomated = true;
            }

            modified.push(action);
        }

        return modified;
    }
}
