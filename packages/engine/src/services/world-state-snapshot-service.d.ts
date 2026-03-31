export declare class WorldStateSnapshotService {
  /**
   * Capture a complete world state snapshot at the current moment.
   * Called at the end of each game tick.
   */
  static captureSnapshot(windowId: string, packId?: string): Promise<string>;
  static getLatestSnapshot(windowId: string): Promise<string | null>;
  private static getPredictionMarketState;
  private static getPerpMarketState;
  private static getWorldEvents;
  private static getInsiderAssignments;
  private static getArcState;
  private static getOrgStates;
}
//# sourceMappingURL=world-state-snapshot-service.d.ts.map
