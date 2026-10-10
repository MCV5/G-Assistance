import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import type { SpeechTranscriptUpdate } from "@/lib/shoppingListLive";
import type { VoiceAddSpeechBridgeRef } from "@/lib/voiceAddSpeechTypes";

interface Props {
  onTranscriptUpdate: (update: SpeechTranscriptUpdate) => void;
  onListeningChange: (listening: boolean) => void;
  onError: (message: string) => void;
  onAvailability: (available: boolean) => void;
}

export const VoiceAddSpeechBridge = forwardRef<VoiceAddSpeechBridgeRef, Props>(
  function VoiceAddSpeechBridge(
    { onTranscriptUpdate, onListeningChange, onError, onAvailability },
    ref,
  ) {
    const [ready, setReady] = useState(false);
    const committedRef = useRef("");

    useSpeechRecognitionEvent("result", (event) => {
      const segment = event.results?.[0]?.transcript?.trim() ?? "";
      if (!segment) return;

      if (event.isFinal) {
        committedRef.current = committedRef.current
          ? `${committedRef.current} ${segment}`
          : segment;
        onTranscriptUpdate({
          committed: committedRef.current,
          interim: "",
          isFinal: true,
        });
        return;
      }

      onTranscriptUpdate({
        committed: committedRef.current,
        interim: segment,
        isFinal: false,
      });
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
      async start(seedTranscript?: string) {
        if (!ready) return false;
        committedRef.current = seedTranscript?.trim() ?? "";
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
            addsPunctuation: true,
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
