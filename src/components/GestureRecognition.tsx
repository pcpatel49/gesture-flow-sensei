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

  // Enhanced gesture classification with more gestures
  const classifyGesture = useCallback((landmarks: any) => {
    if (!landmarks || landmarks.length === 0) return { gesture: 'none', confidence: 0 };

    try {
      const points = landmarks[0];
      
      // Extract all landmark positions
      const thumb_tip = points[4];
      const thumb_ip = points[3];
      const thumb_mcp = points[2];
      const index_tip = points[8];
      const index_pip = points[6];
      const index_mcp = points[5];
      const middle_tip = points[12];
      const middle_pip = points[10];
      const middle_mcp = points[9];
      const ring_tip = points[16];
      const ring_pip = points[14];
      const ring_mcp = points[13];
      const pinky_tip = points[20];
      const pinky_pip = points[18];
      const pinky_mcp = points[17];
      const wrist = points[0];

      // Enhanced finger extension detection
      const isFingerExtended = (tip: any, pip: any, mcp: any) => {
        const tipToPip = Math.sqrt(Math.pow(tip.x - pip.x, 2) + Math.pow(tip.y - pip.y, 2));
        const pipToMcp = Math.sqrt(Math.pow(pip.x - mcp.x, 2) + Math.pow(pip.y - mcp.y, 2));
        const tipToMcp = Math.sqrt(Math.pow(tip.x - mcp.x, 2) + Math.pow(tip.y - mcp.y, 2));
        return tipToMcp > (tipToPip + pipToMcp) * 0.8;
      };

      // Thumb extension (different logic due to thumb orientation)
      const isThumbExtended = () => {
        const thumbLength = Math.sqrt(Math.pow(thumb_tip.x - thumb_mcp.x, 2) + Math.pow(thumb_tip.y - thumb_mcp.y, 2));
        const baseLength = Math.sqrt(Math.pow(thumb_ip.x - thumb_mcp.x, 2) + Math.pow(thumb_ip.y - thumb_mcp.y, 2));
        return thumbLength > baseLength * 1.2;
      };

      const isThumbUp = isThumbExtended();
      const isIndexUp = isFingerExtended(index_tip, index_pip, index_mcp);
      const isMiddleUp = isFingerExtended(middle_tip, middle_pip, middle_mcp);
      const isRingUp = isFingerExtended(ring_tip, ring_pip, ring_mcp);
      const isPinkyUp = isFingerExtended(pinky_tip, pinky_pip, pinky_mcp);

      const extendedFingers = [isThumbUp, isIndexUp, isMiddleUp, isRingUp, isPinkyUp].filter(Boolean).length;

      // Distance calculations for special gestures
      const thumbIndexDistance = Math.sqrt(Math.pow(thumb_tip.x - index_tip.x, 2) + Math.pow(thumb_tip.y - index_tip.y, 2));
      const thumbMiddleDistance = Math.sqrt(Math.pow(thumb_tip.x - middle_tip.x, 2) + Math.pow(thumb_tip.y - middle_tip.y, 2));

      // Enhanced gesture classification
      
      // Fist - no fingers extended
      if (extendedFingers === 0) {
        return { gesture: 'fist', confidence: 0.95 };
      }
      
      // Open hand - all fingers extended
      if (extendedFingers === 5) {
        return { gesture: 'open_hand', confidence: 0.95 };
      }
      
      // Thumbs up - only thumb extended
      if (isThumbUp && !isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) {
        return { gesture: 'thumbs_up', confidence: 0.9 };
      }
      
      // Thumbs down - thumb down, others closed (approximated)
      if (!isThumbUp && !isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp && thumb_tip.y > thumb_mcp.y) {
        return { gesture: 'thumbs_down', confidence: 0.85 };
      }
      
      // Pointing - only index finger extended
      if (!isThumbUp && isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) {
        return { gesture: 'pointing', confidence: 0.9 };
      }
      
      // Peace sign - index and middle fingers extended
      if (!isThumbUp && isIndexUp && isMiddleUp && !isRingUp && !isPinkyUp) {
        return { gesture: 'peace', confidence: 0.9 };
      }
      
      // OK sign - thumb and index forming circle
      if (isThumbUp && isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp && thumbIndexDistance < 0.06) {
        return { gesture: 'ok', confidence: 0.9 };
      }
      
      // Rock on / Devil horns - index and pinky extended
      if (!isThumbUp && isIndexUp && !isMiddleUp && !isRingUp && isPinkyUp) {
        return { gesture: 'rock_on', confidence: 0.9 };
      }
      
      // Call me - thumb and pinky extended
      if (isThumbUp && !isIndexUp && !isMiddleUp && !isRingUp && isPinkyUp) {
        return { gesture: 'call_me', confidence: 0.85 };
      }
      
      // Gun - index and thumb extended, others closed
      if (isThumbUp && isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp && thumbIndexDistance > 0.08) {
        return { gesture: 'gun', confidence: 0.8 };
      }
      
      // Spock (Vulcan salute) - index+middle separated from ring+pinky
      if (!isThumbUp && isIndexUp && isMiddleUp && isRingUp && isPinkyUp) {
        const indexMiddleGap = Math.sqrt(Math.pow(index_tip.x - middle_tip.x, 2) + Math.pow(index_tip.y - middle_tip.y, 2));
        const middleRingGap = Math.sqrt(Math.pow(middle_tip.x - ring_tip.x, 2) + Math.pow(middle_tip.y - ring_tip.y, 2));
        const ringPinkyGap = Math.sqrt(Math.pow(ring_tip.x - pinky_tip.x, 2) + Math.pow(ring_tip.y - pinky_tip.y, 2));
        
        if (middleRingGap > indexMiddleGap && middleRingGap > ringPinkyGap) {
          return { gesture: 'spock', confidence: 0.85 };
        }
      }
      
      // L-shape - thumb and index at 90 degrees
      if (isThumbUp && isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) {
        const thumbVector = { x: thumb_tip.x - thumb_mcp.x, y: thumb_tip.y - thumb_mcp.y };
        const indexVector = { x: index_tip.x - index_mcp.x, y: index_tip.y - index_mcp.y };
        const dotProduct = thumbVector.x * indexVector.x + thumbVector.y * indexVector.y;
        const thumbMag = Math.sqrt(thumbVector.x * thumbVector.x + thumbVector.y * thumbVector.y);
        const indexMag = Math.sqrt(indexVector.x * indexVector.x + indexVector.y * indexVector.y);
        const angle = Math.acos(dotProduct / (thumbMag * indexMag)) * 180 / Math.PI;
        
        if (angle > 70 && angle < 110) {
          return { gesture: 'l_shape', confidence: 0.8 };
        }
      }
      
      // Three - thumb, index, middle extended
      if (isThumbUp && isIndexUp && isMiddleUp && !isRingUp && !isPinkyUp) {
        return { gesture: 'three', confidence: 0.85 };
      }
      
      // Four - index, middle, ring, pinky extended
      if (!isThumbUp && isIndexUp && isMiddleUp && isRingUp && isPinkyUp) {
        return { gesture: 'four', confidence: 0.85 };
      }
      
      // One - only index extended (alternative)
      if (!isThumbUp && isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) {
        return { gesture: 'one', confidence: 0.8 };
      }
      
      // Two - index and middle extended (alternative)
      if (!isThumbUp && isIndexUp && isMiddleUp && !isRingUp && !isPinkyUp) {
        return { gesture: 'two', confidence: 0.8 };
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
      'thumbs_down': '👎',
      'ok': '👌',
      'pointing': '👉',
      'fist': '✊',
      'open_hand': '✋',
      'rock_on': '🤘',
      'call_me': '🤙',
      'gun': '👉',
      'spock': '🖖',
      'l_shape': '🤟',
      'three': '3️⃣',
      'four': '4️⃣',
      'one': '1️⃣',
      'two': '2️⃣',
      'none': '❓',
      'unknown': '🤔'
    };
    return emojiMap[gesture] || '❓';
  };

  const getGestureLabel = (gesture: string) => {
    const labelMap: Record<string, string> = {
      'peace': 'Peace Sign',
      'thumbs_up': 'Thumbs Up',
      'thumbs_down': 'Thumbs Down',
      'ok': 'OK Sign',
      'pointing': 'Pointing',
      'fist': 'Fist',
      'open_hand': 'Open Hand',
      'rock_on': 'Rock On',
      'call_me': 'Call Me',
      'gun': 'Gun Gesture',
      'spock': 'Vulcan Salute',
      'l_shape': 'L-Shape',
      'three': 'Number Three',
      'four': 'Number Four',
      'one': 'Number One',
      'two': 'Number Two',
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
            Advanced Hand Gesture Recognition System - Now with 15+ Gestures!
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
              <h3 className="text-lg font-semibold mb-4">Supported Gestures (15+)</h3>
              <div className="grid grid-cols-2 gap-2 text-sm max-h-64 overflow-y-auto">
                {[
                  { emoji: '✌️', name: 'Peace' },
                  { emoji: '👍', name: 'Thumbs Up' },
                  { emoji: '👎', name: 'Thumbs Down' },
                  { emoji: '👌', name: 'OK Sign' },
                  { emoji: '👉', name: 'Pointing' },
                  { emoji: '✊', name: 'Fist' },
                  { emoji: '✋', name: 'Open Hand' },
                  { emoji: '🤘', name: 'Rock On' },
                  { emoji: '🤙', name: 'Call Me' },
                  { emoji: '🖖', name: 'Vulcan Salute' },
                  { emoji: '🤟', name: 'L-Shape' },
                  { emoji: '1️⃣', name: 'One' },
                  { emoji: '2️⃣', name: 'Two' },
                  { emoji: '3️⃣', name: 'Three' },
                  { emoji: '4️⃣', name: 'Four' }
                ].map((gesture, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-secondary/30 rounded">
                    <span>{gesture.emoji}</span>
                    <span className="text-xs">{gesture.name}</span>
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
