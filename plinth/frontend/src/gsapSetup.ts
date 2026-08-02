import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText, DrawSVGPlugin);

export const MM_CONDITIONS = {
  isDesktop: '(min-width: 768px)',
  isMobile: '(max-width: 767px)',
  reduceMotion: '(prefers-reduced-motion: reduce)',
} as const;

export { gsap, useGSAP, ScrollTrigger, SplitText, DrawSVGPlugin };
