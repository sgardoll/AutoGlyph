import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Transformer, Text, Group, Line } from 'react-konva';
import { LetterBox } from '../utils/fontGenerator';

interface ImageCanvasProps {
  imageElement: HTMLImageElement;
  letters: LetterBox[];
  setLetters: React.Dispatch<React.SetStateAction<LetterBox[]>>;
  selectedLetterId: string | null;
  setSelectedLetterId: (id: string | null) => void;
  snapToGrid?: boolean;
  gridSize?: number;
}

export default function ImageCanvas({
  imageElement,
  letters,
  setLetters,
  selectedLetterId,
  setSelectedLetterId,
  snapToGrid = false,
  gridSize = 10
}: ImageCanvasProps) {
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [isDrawing, setIsDrawing] = useState(false);
  const [newBox, setNewBox] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const lastZoomedId = useRef<string | null>(null);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current && imageElement) {
        const containerWidth = containerRef.current.clientWidth;
        const newScale = containerWidth / imageElement.width;
        setScale(newScale);
        setDimensions({
          width: containerWidth,
          height: imageElement.height * newScale
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [imageElement]);

  useEffect(() => {
    if (selectedLetterId !== lastZoomedId.current) {
      lastZoomedId.current = selectedLetterId;
      if (selectedLetterId) {
        const letter = letters.find(l => l.id === selectedLetterId);
        if (letter) {
          const [ymin, xmin, ymax, xmax] = letter.box;
          const boxCenterX = ((xmin + xmax) / 2000) * imageElement.width;
          const boxCenterY = ((ymin + ymax) / 2000) * imageElement.height;

          const newZoom = 3;
          setZoomScale(newZoom);

          setPan({
            x: dimensions.width / 2 - boxCenterX * scale * newZoom,
            y: dimensions.height / 2 - boxCenterY * scale * newZoom
          });
        }
      } else {
        setZoomScale(1);
        setPan({ x: 0, y: 0 });
      }
    }
  }, [selectedLetterId, letters, imageElement, scale, dimensions]);

  const getPointerPos = (stage: any) => {
    const transform = stage.getAbsoluteTransform().copy().invert();
    return transform.point(stage.getPointerPosition());
  };

  const handleMouseDown = (e: any) => {
    // Deselect when clicking on empty area
    const clickedOnEmpty = e.target === e.target.getStage() || e.target.name() === 'backgroundImage';
    if (clickedOnEmpty) {
      setSelectedLetterId(null);

      // Start drawing new box
      const stage = e.target.getStage();
      const pos = getPointerPos(stage);

      let startX = pos.x / scale;
      let startY = pos.y / scale;

      if (snapToGrid && gridSize) {
        startX = Math.round(startX / gridSize) * gridSize;
        startY = Math.round(startY / gridSize) * gridSize;
      }

      setIsDrawing(true);
      setNewBox({
        x: startX,
        y: startY,
        width: 0,
        height: 0
      });
    }
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing || !newBox) return;

    const stage = e.target.getStage();
    const pos = getPointerPos(stage);
    let currentX = pos.x / scale;
    let currentY = pos.y / scale;

    if (snapToGrid && gridSize) {
      currentX = Math.round(currentX / gridSize) * gridSize;
      currentY = Math.round(currentY / gridSize) * gridSize;
    }

    setNewBox({
      ...newBox,
      width: currentX - newBox.x,
      height: currentY - newBox.y
    });
  };

  const handleMouseUp = (e: any) => {
    if (isDrawing && newBox) {
      setIsDrawing(false);

      const stage = e.target.getStage();
      const pos = getPointerPos(stage);
      let finalX = pos.x / scale;
      let finalY = pos.y / scale;

      if (snapToGrid && gridSize) {
        finalX = Math.round(finalX / gridSize) * gridSize;
        finalY = Math.round(finalY / gridSize) * gridSize;
      }

      const finalWidth = finalX - newBox.x;
      const finalHeight = finalY - newBox.y;

      // Only create if it has some minimum size
      if (Math.abs(finalWidth) > 10 && Math.abs(finalHeight) > 10) {
        // Normalize coordinates (handle negative width/height)
        let xmin = Math.min(newBox.x, newBox.x + finalWidth);
        let xmax = Math.max(newBox.x, newBox.x + finalWidth);
        let ymin = Math.min(newBox.y, newBox.y + finalHeight);
        let ymax = Math.max(newBox.y, newBox.y + finalHeight);

        // Convert to 1000x1000 coordinate system used by LetterBox
        const box: [number, number, number, number] = [
          (ymin / imageElement.height) * 1000,
          (xmin / imageElement.width) * 1000,
          (ymax / imageElement.height) * 1000,
          (xmax / imageElement.width) * 1000
        ];

        const newLetter: LetterBox = {
          id: Math.random().toString(36).substring(7),
          char: '?',
          box
        };

        setLetters(prev => [...prev, newLetter]);
        setSelectedLetterId(newLetter.id);
      }
      setNewBox(null);
    }
  };

  return (
    <div ref={containerRef} className="w-full h-auto cursor-crosshair block">
      {dimensions.width > 0 && (
        <Stage
          ref={stageRef}
          width={dimensions.width}
          height={dimensions.height}
          scaleX={zoomScale}
          scaleY={zoomScale}
          x={pan.x}
          y={pan.y}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
        >
          <Layer>
            <KonvaImage
              image={imageElement}
              width={dimensions.width}
              height={dimensions.height}
              name="backgroundImage"
            />

            {snapToGrid && gridSize > 0 && (
              <Group opacity={0.15} listening={false}>
                {Array.from({ length: Math.ceil(imageElement.width / gridSize) + 1 }).map((_, i) => (
                  <Line
                    key={`v-${i}`}
                    points={[i * gridSize * scale, 0, i * gridSize * scale, imageElement.height * scale]}
                    stroke="#000"
                    strokeWidth={1 / zoomScale}
                  />
                ))}
                {Array.from({ length: Math.ceil(imageElement.height / gridSize) + 1 }).map((_, i) => (
                  <Line
                    key={`h-${i}`}
                    points={[0, i * gridSize * scale, imageElement.width * scale, i * gridSize * scale]}
                    stroke="#000"
                    strokeWidth={1 / zoomScale}
                  />
                ))}
              </Group>
            )}

            {letters.map((letter) => (
              <LetterRect
                key={letter.id}
                letter={letter}
                isSelected={letter.id === selectedLetterId}
                onSelect={() => setSelectedLetterId(letter.id)}
                onChange={(newBox) => {
                  setLetters(letters.map(l => l.id === letter.id ? { ...l, box: newBox } : l));
                }}
                imageWidth={imageElement.width}
                imageHeight={imageElement.height}
                scale={scale}
                snapToGrid={snapToGrid}
                gridSize={gridSize}
              />
            ))}

            {isDrawing && newBox && (
              <Rect
                x={newBox.x * scale}
                y={newBox.y * scale}
                width={newBox.width * scale}
                height={newBox.height * scale}
                stroke="#10b981"
                strokeWidth={2}
                dash={[4, 4]}
              />
            )}
          </Layer>
        </Stage>
      )}
    </div>
  );
}

interface LetterRectProps {
  letter: LetterBox;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (newBox: [number, number, number, number]) => void;
  imageWidth: number;
  imageHeight: number;
  scale: number;
  snapToGrid: boolean;
  gridSize: number;
}

const LetterRect = ({ letter, isSelected, onSelect, onChange, imageWidth, imageHeight, scale, snapToGrid, gridSize }: LetterRectProps) => {
  const shapeRef = useRef<any>(null);
  const trRef = useRef<any>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  const [ymin, xmin, ymax, xmax] = letter.box;

  // Convert from 1000x1000 coordinate system to original image pixels
  const x = (xmin / 1000) * imageWidth;
  const y = (ymin / 1000) * imageHeight;
  const width = ((xmax - xmin) / 1000) * imageWidth;
  const height = ((ymax - ymin) / 1000) * imageHeight;

  const handleSnap = (val: number) => {
    if (!snapToGrid || !gridSize) return val;
    return Math.round(val / gridSize) * gridSize;
  };

  // Determine stroke color and width based on state
  const strokeColor = isDragging ? '#f59e0b' : isSelected ? '#ef4444' : '#3b82f6';
  const strokeWidth = isDragging ? 4 : isSelected ? 3 : 2;
  const fillColor = isDragging ? 'rgba(245, 158, 11, 0.2)' : isSelected ? 'rgba(239, 68, 68, 0.1)' : 'transparent';

  return (
    <Group>
      <Rect
        onClick={onSelect}
        onTap={onSelect}
        onMouseEnter={(e) => {
          const container = e.target.getStage()?.container();
          if (container) container.style.cursor = 'pointer';
        }}
        onMouseLeave={(e) => {
          const container = e.target.getStage()?.container();
          if (container) container.style.cursor = 'default';
        }}
        ref={shapeRef}
        x={x * scale}
        y={y * scale}
        width={width * scale}
        height={height * scale}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        fill={fillColor}
        shadowColor={isDragging ? 'black' : 'transparent'}
        shadowBlur={isDragging ? 10 : 0}
        shadowOpacity={isDragging ? 0.3 : 0}
        shadowOffset={isDragging ? { x: 5, y: 5 } : { x: 0, y: 0 }}
        draggable={isSelected}
        dragBoundFunc={(pos) => {
          if (!snapToGrid || !gridSize) return pos;
          const stage = shapeRef.current?.getStage();
          if (!stage) return pos;

          const transform = stage.getAbsoluteTransform().copy().invert();
          const localPos = transform.point(pos);

          let unscaledX = localPos.x / scale;
          let unscaledY = localPos.y / scale;

          unscaledX = Math.round(unscaledX / gridSize) * gridSize;
          unscaledY = Math.round(unscaledY / gridSize) * gridSize;

          const snappedLocalPos = {
            x: unscaledX * scale,
            y: unscaledY * scale
          };

          const absoluteTransform = stage.getAbsoluteTransform();
          return absoluteTransform.point(snappedLocalPos);
        }}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={(e) => {
          setIsDragging(false);
          const node = shapeRef.current;
          let newX = node.x() / scale;
          let newY = node.y() / scale;

          newX = handleSnap(newX);
          newY = handleSnap(newY);

          // Convert back to 1000x1000 coordinate system
          const newXMin = (newX / imageWidth) * 1000;
          const newYMin = (newY / imageHeight) * 1000;
          const newXMax = ((newX + width) / imageWidth) * 1000;
          const newYMax = ((newY + height) / imageHeight) * 1000;

          onChange([newYMin, newXMin, newYMax, newXMax]);
        }}
        onTransformEnd={(e) => {
          const node = shapeRef.current;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();

          // Reset scale
          node.scaleX(1);
          node.scaleY(1);

          let newX = node.x() / scale;
          let newY = node.y() / scale;
          let newWidth = Math.max(5, node.width() * scaleX) / scale;
          let newHeight = Math.max(5, node.height() * scaleY) / scale;

          newX = handleSnap(newX);
          newY = handleSnap(newY);
          newWidth = handleSnap(newWidth);
          newHeight = handleSnap(newHeight);

          // Convert back to 1000x1000 coordinate system
          const newXMin = (newX / imageWidth) * 1000;
          const newYMin = (newY / imageHeight) * 1000;
          const newXMax = ((newX + newWidth) / imageWidth) * 1000;
          const newYMax = ((newY + newHeight) / imageHeight) * 1000;

          onChange([newYMin, newXMin, newYMax, newXMax]);
        }}
      />

      {/* Label */}
      <Group
        x={x * scale}
        y={y * scale}
        onClick={onSelect}
        onTap={onSelect}
        onMouseEnter={(e) => {
          const container = e.target.getStage()?.container();
          if (container) container.style.cursor = 'pointer';
        }}
        onMouseLeave={(e) => {
          const container = e.target.getStage()?.container();
          if (container) container.style.cursor = 'default';
        }}
      >
        <Rect
          width={20}
          height={20}
          fill={strokeColor}
        />
        <Text
          text={letter.char}
          width={20}
          height={20}
          align="center"
          verticalAlign="middle"
          fill="white"
          fontSize={14}
          fontStyle="bold"
        />
      </Group>

      {isSelected && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            // Limit resize
            if (newBox.width < 5 || newBox.height < 5) {
              return oldBox;
            }
            if (snapToGrid && gridSize) {
              let unscaledX = newBox.x / scale;
              let unscaledY = newBox.y / scale;
              let unscaledW = newBox.width / scale;
              let unscaledH = newBox.height / scale;

              unscaledX = Math.round(unscaledX / gridSize) * gridSize;
              unscaledY = Math.round(unscaledY / gridSize) * gridSize;
              unscaledW = Math.round(unscaledW / gridSize) * gridSize;
              unscaledH = Math.round(unscaledH / gridSize) * gridSize;

              return {
                x: unscaledX * scale,
                y: unscaledY * scale,
                width: unscaledW * scale,
                height: unscaledH * scale,
                rotation: newBox.rotation
              };
            }
            return newBox;
          }}
          rotateEnabled={false}
          keepRatio={false}
          ignoreStroke={true}
        />
      )}
    </Group>
  );
};
