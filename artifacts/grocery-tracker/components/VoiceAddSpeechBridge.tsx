import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";

import type { VoiceAddSpeechBridgeRef } from "@/lib/voiceAddSpeechTypes";

interface Props {
  onTranscript: (text: string, isFinal: boolean) => void;
  onListeningChange: (listening: boolean) => void;
  onError: (message: string) => void;
  onAvailability: (available: boolean) => void;
}

export const VoiceAddSpeechBridge = forwardRef<VoiceAddSpeechBridgeRef, Props>(
  function VoiceAddSpeechBridge(
    { onTranscript, onListeningChange, onError, onAvailability },
    ref,
  ) {
    const [ready, setReady] = useState(false);

    useSpeechRecognitionEvent("result", (event) => {
      const transcript = event.results?.[0]?.transcript?.trim();
      if (!transcript) return;
      onTranscript(transcript, event.isFinal);
    });

    useSpeechRecognitionEvent("error", (event) => {
      onListeningChange(false);
      if (event.error !== "aborted" && event.error !== "no-speech") {
        onError("Could not hear that. Try again or type your list.");
      }
    });

    useSpeechRecognitionEvent("end", () => {
      onListeningChange(false);
    });

    useEffect(() => {
      try {
        const available = ExpoSpeechRecognitionModule.isRecognitionAvailable();
        onAvailability(available);
        setReady(available);
      } catch {
        onAvailability(false);
        setReady(false);
      }
    }, [onAvailability]);

    useImperativeHandle(ref, () => ({
      async start() {
        if (!ready) return false;
        try {
          const perm =
            await ExpoSpeechRecognitionModule.requestPermissionsAsync();
          if (!perm.granted) {
            onError("Microphone permission is needed to capture your list.");
            return false;
          }
          ExpoSpeechRecognitionModule.start({
            lang: "en-US",
            interimResults: true,
            continuous: true,
          });
          onListeningChange(true);
          return true;
        } catch {
          onError("Voice input is not available. Type your list instead.");
          onListeningChange(false);
          return false;
        }
      },
      stop() {
        try {
          ExpoSpeechRecognitionModule.stop();
        } catch {
          /* noop */
        }
        onListeningChange(false);
      },
    }));

    return null;
  },
);
