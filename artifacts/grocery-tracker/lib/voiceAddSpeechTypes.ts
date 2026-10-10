export type VoiceAddSpeechBridgeRef = {
  /** Start listening. `seedTranscript` keeps text already captured so resuming appends. */
  start: (seedTranscript?: string) => Promise<boolean>;
  stop: () => void;
};
