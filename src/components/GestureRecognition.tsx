
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Hands, Results } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { HAND_CONNECTIONS } from '@mediapipe/hands';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Hand, Zap } from 'lucide-react';

interface GestureResult {
  gesture: string;
  confidence: number;
  timestamp: number;
}

const GestureRecognition: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentGesture, setCurrentGesture] = useState<string>('none');
  const [confidence, setConfidence] = useState<number>(0);
  const [gestureHistory, setGestureHistory] = useState<GestureResult[]>([]);
  const [isActive, setIsActive] = useState(false);

  // Gesture classification based on hand landmarks
  const classifyGesture = useCallback((landmarks: any) => {
    if (!landmarks || landmarks.length === 0) return { gesture: 'none', confidence: 0 };

    try {
      const points = landmarks[0];
      
      // Extract key landmark positions
      const thumb_tip = points[4];
      const thumb_ip = points[3];
      const index_tip = points[8];
      const index_pip = points[6];
      const middle_tip = points[12];
      const middle_pip = points[10];
      const ring_tip = points[16];
      const ring_pip = points[14];
      const pinky_tip = points[20];
      const pinky_pip = points[18];
      const wrist = points[0];

      // Helper function to check if finger is extended
      const isFingerExtended = (tip: any, pip: any, wrist: any) => {
        const tipToWrist = Math.sqrt(Math.pow(tip.x - wrist.x, 2) + Math.pow(tip.y - wrist.y, 2));
        const pipToWrist = Math.sqrt(Math.pow(pip.x - wrist.x, 2) + Math.pow(pip.y - wrist.y, 2));
        return tipToWrist > pipToWrist;
      };

      const isThumbExtended = thumb_tip.x > thumb_ip.x; // Simplified thumb check
      const isIndexExtended = isFingerExtended(index_tip, index_pip, wrist);
      const isMiddleExtended = isFingerExtended(middle_tip, middle_pip, wrist);
      const isRingExtended = isFingerExtended(ring_tip, ring_pip, wrist);
      const isPinkyExtended = isFingerExtended(pinky_tip, pinky_pip, wrist);

      const extendedFingers = [
        isThumbExtended,
        isIndexExtended,
        isMiddleExtended,
        isRingExtended,
        isPinkyExtended
      ].filter(Boolean).length;

      // Gesture classification logic
      if (extendedFingers === 0) {
        return { gesture: 'fist', confidence: 0.9 };
      } else if (extendedFingers === 5) {
        return { gesture: 'open_hand', confidence: 0.95 };
      } else if (isIndexExtended && isMiddleExtended && !isRingExtended && !isPinkyExtended) {
        return { gesture: 'peace', confidence: 0.9 };
      } else if (isThumbExtended && !isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
        return { gesture: 'thumbs_up', confidence: 0.85 };
      } else if (isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
        return { gesture: 'pointing', confidence: 0.8 };
      } else if (isThumbExtended && isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
        // Check for OK gesture (thumb and index forming circle)
        const thumbIndexDistance = Math.sqrt(
          Math.pow(thumb_tip.x - index_tip.x, 2) + Math.pow(thumb_tip.y - index_tip.y, 2)
        );
        if (thumbIndexDistance < 0.05) {
          return { gesture: 'ok', confidence: 0.85 };
        }
      }

      return { gesture: 'unknown', confidence: 0.6 };
    } catch (error) {
      console.log('Gesture classification error:', error);
      return { gesture: 'none', confidence: 0 };
    }
  }, []);

  const onResults = useCallback((results: Results) => {
    if (!canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas and draw video frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      setIsActive(true);
      
      // Draw hand landmarks and connections
      for (const landmarks of results.multiHandLandmarks) {
        drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {
          color: '#00ff88',
          lineWidth: 2
        });
        drawLandmarks(ctx, landmarks, {
          color: '#ff0080',
          lineWidth: 1,
          radius: 3
        });
      }

      // Classify gesture
      const result = classifyGesture(results.multiHandLandmarks);
      setCurrentGesture(result.gesture);
      setConfidence(result.confidence);

      // Add to history
      if (result.confidence > 0.7) {
        setGestureHistory(prev => {
          const newHistory = [...prev, {
            gesture: result.gesture,
            confidence: result.confidence,
            timestamp: Date.now()
          }].slice(-10); // Keep last 10 gestures
          return newHistory;
        });
      }
    } else {
      setIsActive(false);
      setCurrentGesture('none');
      setConfidence(0);
    }
  }, [classifyGesture]);

  useEffect(() => {
    const initializeHandTracking = async () => {
      if (!videoRef.current || !canvasRef.current) return;

      try {
        const hands = new Hands({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.5
        });

        hands.onResults(onResults);

        const camera = new Camera(videoRef.current, {
          onFrame: async () => {
            if (videoRef.current) {
              await hands.send({ image: videoRef.current });
            }
          },
          width: 640,
          height: 480
        });

        await camera.start();
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to initialize hand tracking:', error);
        setIsLoading(false);
      }
    };

    initializeHandTracking();
  }, [onResults]);

  const getGestureEmoji = (gesture: string) => {
    const emojiMap: Record<string, string> = {
      'peace': '✌️',
      'thumbs_up': '👍',
      'ok': '👌',
      'pointing': '👉',
      'fist': '✊',
      'open_hand': '✋',
      'none': '❓',
      'unknown': '🤔'
    };
    return emojiMap[gesture] || '❓';
  };

  const getGestureLabel = (gesture: string) => {
    const labelMap: Record<string, string> = {
      'peace': 'Peace Sign',
      'thumbs_up': 'Thumbs Up',
      'ok': 'OK Sign',
      'pointing': 'Pointing',
      'fist': 'Fist',
      'open_hand': 'Open Hand',
      'none': 'No Hand Detected',
      'unknown': 'Unknown Gesture'
    };
    return labelMap[gesture] || 'Unknown';
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold gradient-text mb-4">
            Gesture Flow Sensei
          </h1>
          <p className="text-muted-foreground text-lg">
            Advanced Hand Gesture Recognition System
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Camera Feed */}
          <div className="lg:col-span-2">
            <Card className="p-6 neon-border">
              <div className="relative">
                <video
                  ref={videoRef}
                  className="hidden"
                  width="640"
                  height="480"
                  autoPlay
                  muted
                  playsInline
                />
                <canvas
                  ref={canvasRef}
                  width="640"
                  height="480"
                  className="w-full h-auto rounded-lg bg-black"
                />
                
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-lg">
                    <div className="text-center">
                      <Activity className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
                      <p className="text-white">Initializing camera and AI model...</p>
                    </div>
                  </div>
                )}

                {/* Status Indicator */}
                <div className="absolute top-4 right-4">
                  <Badge 
                    variant={isActive ? "default" : "secondary"}
                    className={isActive ? "pulse-neon" : ""}
                  >
                    <Zap className="w-4 h-4 mr-1" />
                    {isActive ? 'Tracking' : 'Waiting'}
                  </Badge>
                </div>
              </div>
            </Card>
          </div>

          {/* Gesture Info Panel */}
          <div className="space-y-6">
            {/* Current Gesture */}
            <Card className="p-6 text-center neon-border">
              <div className="text-6xl mb-4">
                {getGestureEmoji(currentGesture)}
              </div>
              <h3 className="text-xl font-semibold mb-2">
                {getGestureLabel(currentGesture)}
              </h3>
              <div className="flex items-center justify-center gap-2 mb-4">
                <span className="text-sm text-muted-foreground">Confidence:</span>
                <Badge variant="outline">
                  {Math.round(confidence * 100)}%
                </Badge>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div 
                  className="h-2 rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${confidence * 100}%` }}
                />
              </div>
            </Card>

            {/* Gesture History */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Hand className="w-5 h-5" />
                Recent Gestures
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {gestureHistory.slice(-5).reverse().map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-secondary/50 rounded">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getGestureEmoji(item.gesture)}</span>
                      <span className="text-sm">{getGestureLabel(item.gesture)}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {Math.round(item.confidence * 100)}%
                    </Badge>
                  </div>
                ))}
                {gestureHistory.length === 0 && (
                  <p className="text-muted-foreground text-sm text-center py-4">
                    No gestures detected yet
                  </p>
                )}
              </div>
            </Card>

            {/* Supported Gestures */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Supported Gestures</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  { emoji: '✌️', name: 'Peace' },
                  { emoji: '👍', name: 'Thumbs Up' },
                  { emoji: '👌', name: 'OK Sign' },
                  { emoji: '👉', name: 'Pointing' },
                  { emoji: '✊', name: 'Fist' },
                  { emoji: '✋', name: 'Open Hand' }
                ].map((gesture, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-secondary/30 rounded">
                    <span>{gesture.emoji}</span>
                    <span>{gesture.name}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GestureRecognition;
