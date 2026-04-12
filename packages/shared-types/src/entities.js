/** Core entity interfaces shared across all VibeFlow packages. */
export var RunState;
(function (RunState) {
    RunState["Idle"] = "idle";
    RunState["Running"] = "running";
    RunState["Paused"] = "paused";
    RunState["Completed"] = "completed";
    RunState["Failed"] = "failed";
})(RunState || (RunState = {}));
export var SyncStatus;
(function (SyncStatus) {
    SyncStatus["Offline"] = "offline";
    SyncStatus["Connecting"] = "connecting";
    SyncStatus["Connected"] = "connected";
    SyncStatus["Syncing"] = "syncing";
    SyncStatus["Error"] = "error";
})(SyncStatus || (SyncStatus = {}));
//# sourceMappingURL=entities.js.map