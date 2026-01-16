import React from 'react';
import { MessageSquare, Facebook, Mail, Phone, Instagram } from 'lucide-react';
import { cn } from '../../../components/ui/utils';
import { getPlatformColor } from '../../../design-tokens';

interface PlatformIconProps {
  platform: 'telegram' | 'whatsapp' | 'email' | 'facebook' | 'instagram';
  className?: string;
  size?: number;
}

/**
 * Іконка платформи з кольором
 */
export function PlatformIcon({ platform, className, size = 16 }: PlatformIconProps) {
  const color = getPlatformColor(platform);
  
  const iconMap = {
    telegram: MessageSquare,
    whatsapp: Phone,
    email: Mail,
    facebook: Facebook,
    instagram: Instagram,
  };

  const Icon = iconMap[platform];

  return (
    <Icon
      className={cn(className)}
      style={{ color, width: size, height: size }}
    />
  );
}

