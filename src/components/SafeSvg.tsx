import { useEffect, useRef } from 'react';

type SafeSvgProps = {
  svg: string;
  className?: string;
};

export function SafeSvg({ svg, className }: SafeSvgProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = '';

    if (!svg || !svg.trim().startsWith('<svg')) return;

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svg, 'image/svg+xml');
      const svgElement = doc.querySelector('svg');

      if (!svgElement) return;

      const errorNode = doc.querySelector('parsererror');
      if (errorNode) return;

      const imported = document.importNode(svgElement, true);
      container.appendChild(imported);
    } catch {}
  }, [svg]);

  return <div ref={containerRef} className={className} />;
}
