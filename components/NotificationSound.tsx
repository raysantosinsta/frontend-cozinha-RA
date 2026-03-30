import React, { useEffect, useRef } from 'react';
import io, { Socket } from 'socket.io-client';

interface NotificationSoundProps {
  url?: string;
  soundEnabled?: boolean;
  soundFile?: string;
}

const NotificationSound = ({ 
  url = 'http://localhost:3000', 
  soundEnabled = true,
  soundFile = '/sounds/notification.mp3'
}: NotificationSoundProps) => {
  const socketRef = useRef<Socket | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!soundEnabled) return;

    audioRef.current = new Audio(soundFile);

    socketRef.current = io(url);
    
    socketRef.current.on('new-order', () => {
      if (audioRef.current && soundEnabled) {
        audioRef.current.play().catch(error => console.error('Error playing sound:', error));
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [url, soundEnabled, soundFile]);

  return null;
};

export default NotificationSound;