import React, { useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import * as fabric from 'fabric';
import { PDFDocument } from 'pdf-lib';
import { X, Save, PenTool, Type, Square, Circle, MousePointer2, Eraser, Highlighter, AlertCircle } from 'lucide-react';
import { Attachment } from '../types';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { uploadBase64 } from '../lib/storage';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfAnnotatorProps {
  attachment: Attachment;
  onClose: () => void;
  onSave: (annotatedAttachment: Attachment) => void;
  readOnly?: boolean;
}

export default function PdfAnnotator({ attachment, onClose, onSave, readOnly = false }: PdfAnnotatorProps) {
  const { addNotification } = useNotifications();
  const { user } = useAuth();
  const [numPages, setNumPages] = useState<number>(0);
  const [pdfError, setPdfError] = useState(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [tool, setTool] = useState<'select' | 'draw' | 'highlight' | 'text' | 'rect' | 'circle' | 'eraser'>('select');
  const [color, setColor] = useState<string>('#ff0000');
  const [isSaving, setIsSaving] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const [pageDimensions, setPageDimensions] = useState({ width: 0, height: 0 });
  
  // We need to store fabric canvases for each page
  const canvasesDataRef = useRef<Record<number, any>>({});

  const isPdf = attachment.type.toLowerCase().includes('pdf') || attachment.name.toLowerCase().endsWith('.pdf');

  useEffect(() => {
    if (!isPdf) {
      const img = new Image();
      img.onload = () => {
        setPageDimensions({ width: img.width, height: img.height });
        setNumPages(1);
      };
      img.src = attachment.data;
    }
  }, [isPdf, attachment.data]);

  useEffect(() => {
    if (!canvasRef.current || pageDimensions.width === 0) return;
    
    // Save previous canvas state if exists
    if (fabricCanvasRef.current) {
      canvasesDataRef.current[currentPage] = fabricCanvasRef.current.toJSON();
      fabricCanvasRef.current.dispose();
    }

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: pageDimensions.width,
      height: pageDimensions.height,
      isDrawingMode: !readOnly && (tool === 'draw' || tool === 'highlight'),
      selection: !readOnly,
    });
    
    fabricCanvasRef.current = canvas;

    // Load previous state for this page if exists
    if (canvasesDataRef.current[currentPage]) {
      canvas.loadFromJSON(canvasesDataRef.current[currentPage]).then(() => {
        if (readOnly) {
          canvas.getObjects().forEach(obj => {
            obj.selectable = false;
            obj.evented = false;
          });
        }
        canvas.renderAll();
      });
    }

    return () => {
      if (fabricCanvasRef.current) {
        canvasesDataRef.current[currentPage] = fabricCanvasRef.current.toJSON();
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
    };
  }, [currentPage, pageDimensions, readOnly]);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || readOnly) return;

    canvas.isDrawingMode = tool === 'draw' || tool === 'highlight';
    
    if (tool === 'draw') {
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      canvas.freeDrawingBrush.color = color;
      canvas.freeDrawingBrush.width = 3;
    } else if (tool === 'highlight') {
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      // Semi-transparent color for highlight
      const hex2rgba = (hex: string, alpha = 0.4) => {
        const [r, g, b] = hex.match(/\w\w/g)!.map(x => parseInt(x, 16));
        return `rgba(${r},${g},${b},${alpha})`;
      };
      canvas.freeDrawingBrush.color = hex2rgba(color, 0.4);
      canvas.freeDrawingBrush.width = 20;
    }

    // Handle object addition for shapes/text
    const handleMouseDown = (o: any) => {
      if (tool === 'select' || tool === 'draw' || tool === 'highlight') return;
      
      const pointer = canvas.getScenePoint(o.e);
      
      if (tool === 'text') {
        const text = new fabric.IText('Type here', {
          left: pointer.x,
          top: pointer.y,
          fontFamily: 'Inter',
          fill: color,
          fontSize: 20,
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        text.enterEditing();
        text.selectAll();
        setTool('select');
      } else if (tool === 'rect') {
        const rect = new fabric.Rect({
          left: pointer.x,
          top: pointer.y,
          fill: 'transparent',
          stroke: color,
          strokeWidth: 3,
          width: 50,
          height: 50,
        });
        canvas.add(rect);
        canvas.setActiveObject(rect);
        setTool('select');
      } else if (tool === 'circle') {
        const circle = new fabric.Circle({
          left: pointer.x,
          top: pointer.y,
          fill: 'transparent',
          stroke: color,
          strokeWidth: 3,
          radius: 25,
        });
        canvas.add(circle);
        canvas.setActiveObject(circle);
        setTool('select');
      }
    };

    canvas.on('mouse:down', handleMouseDown);

    return () => {
      canvas.off('mouse:down', handleMouseDown);
    };
  }, [tool, color, readOnly]);

  // Handle eraser
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || readOnly) return;
    
    if (tool === 'eraser') {
      const handleMouseDown = (e: any) => {
        if (e.target) {
          canvas.remove(e.target);
        }
      };
      canvas.on('mouse:down', handleMouseDown);
      return () => {
        canvas.off('mouse:down', handleMouseDown);
      };
    }
  }, [tool, readOnly]);

  // Handle keyboard delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (readOnly) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const canvas = fabricCanvasRef.current;
        if (canvas) {
          const activeObjects = canvas.getActiveObjects();
          if (activeObjects.length) {
            // Don't delete if editing text
            if ((activeObjects[0] as any).isEditing) return;
            activeObjects.forEach(obj => canvas.remove(obj));
            canvas.discardActiveObject();
            canvas.requestRenderAll();
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [readOnly]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save current page
      if (fabricCanvasRef.current) {
        canvasesDataRef.current[currentPage] = fabricCanvasRef.current.toJSON();
      }

      if (isPdf) {
        // Load original PDF
        let pdfBytes;
        if (attachment.data.startsWith('data:')) {
          const base64Data = attachment.data.split(',')[1];
          pdfBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        } else {
          const res = await fetch(attachment.data);
          pdfBytes = new Uint8Array(await res.arrayBuffer());
        }

        const pdfDoc = await PDFDocument.load(pdfBytes);
        const pages = pdfDoc.getPages();

        // For each page, if we have annotations, embed them
        for (let i = 1; i <= numPages; i++) {
          const pageData = canvasesDataRef.current[i];
          if (pageData && pageData.objects && pageData.objects.length > 0) {
            // Create a temporary canvas to render the fabric JSON
            const tempCanvasEl = document.createElement('canvas');
            // We need the original dimensions of the page
            const pdfPage = pages[i - 1];
            const { width, height } = pdfPage.getSize();
            
            tempCanvasEl.width = width;
            tempCanvasEl.height = height;
            
            const tempCanvas = new fabric.StaticCanvas(tempCanvasEl, {
              width, height
            });
            
            await tempCanvas.loadFromJSON(pageData);
            tempCanvas.renderAll();

            const pngDataUrl = tempCanvas.toDataURL({ format: 'png', multiplier: 1 });
            const pngImageBytes = Uint8Array.from(atob(pngDataUrl.split(',')[1]), c => c.charCodeAt(0));
            const pngImage = await pdfDoc.embedPng(pngImageBytes);
            
            pdfPage.drawImage(pngImage, {
              x: 0,
              y: 0,
              width: width,
              height: height,
            });
            
            tempCanvas.dispose();
          }
        }

        const savedPdfBytes = await pdfDoc.save();
        
        const blob = new Blob([savedPdfBytes], { type: 'application/pdf' });
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });

        const publicUrl = await uploadBase64(dataUrl, attachment.name);

        const newAttachment = {
          ...attachment,
          data: publicUrl
        };
        
        onSave(newAttachment);
      } else {
        // Image save logic
        if (fabricCanvasRef.current) {
          const tempCanvasEl = document.createElement('canvas');
          tempCanvasEl.width = pageDimensions.width;
          tempCanvasEl.height = pageDimensions.height;
          const ctx = tempCanvasEl.getContext('2d');
          if (ctx) {
            const img = new Image();
            img.onload = async () => {
              ctx.drawImage(img, 0, 0);
              const annotationsDataUrl = fabricCanvasRef.current!.toDataURL({ format: 'png', multiplier: 1 });
              const annotationsImg = new Image();
              annotationsImg.onload = async () => {
                ctx.drawImage(annotationsImg, 0, 0);
                const combinedDataUrl = tempCanvasEl.toDataURL('image/png');
                
                try {
                  const publicUrl = await uploadBase64(combinedDataUrl, attachment.name);
                  const newAttachment = {
                    ...attachment,
                    data: publicUrl
                  };
                  onSave(newAttachment);
                } catch (error) {
                  console.error('Error uploading annotated image:', error);
                  addNotification({
                    userId: user?.id || 'system',
                    title: 'Upload Error',
                    message: 'Failed to upload annotated image.',
                    type: 'error',
                  });
                  setIsSaving(false);
                }
              };
              annotationsImg.src = annotationsDataUrl;
            };
            img.crossOrigin = "anonymous";
            img.src = attachment.data;
          }
        }
      }
    } catch (error) {
      console.error('Error saving annotations:', error);
      addNotification({
        userId: user?.id || 'system',
        title: 'Save Error',
        message: 'Failed to save annotations.',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/90 backdrop-blur-sm">
      <div className="bg-stone-100 rounded-2xl shadow-xl w-full max-w-6xl h-[95vh] flex flex-col overflow-hidden border border-stone-200">
        
        {/* Toolbar */}
        <div className="flex items-center justify-between p-3 bg-white border-b border-stone-200 z-10 shadow-sm">
          {!readOnly ? (
            <div className="flex items-center space-x-1">
              <button onClick={() => setTool('select')} className={`p-2 rounded-lg ${tool === 'select' ? 'bg-orange-100 text-orange-600' : 'text-stone-600 hover:bg-stone-100'}`} title="Select">
                <MousePointer2 className="w-5 h-5" />
              </button>
              <div className="w-px h-6 bg-stone-200 mx-1"></div>
              <button onClick={() => setTool('draw')} className={`p-2 rounded-lg ${tool === 'draw' ? 'bg-orange-100 text-orange-600' : 'text-stone-600 hover:bg-stone-100'}`} title="Draw">
                <PenTool className="w-5 h-5" />
              </button>
              <button onClick={() => setTool('highlight')} className={`p-2 rounded-lg ${tool === 'highlight' ? 'bg-orange-100 text-orange-600' : 'text-stone-600 hover:bg-stone-100'}`} title="Highlight">
                <Highlighter className="w-5 h-5" />
              </button>
              <button onClick={() => setTool('text')} className={`p-2 rounded-lg ${tool === 'text' ? 'bg-orange-100 text-orange-600' : 'text-stone-600 hover:bg-stone-100'}`} title="Text">
                <Type className="w-5 h-5" />
              </button>
              <button onClick={() => setTool('rect')} className={`p-2 rounded-lg ${tool === 'rect' ? 'bg-orange-100 text-orange-600' : 'text-stone-600 hover:bg-stone-100'}`} title="Rectangle">
                <Square className="w-5 h-5" />
              </button>
              <button onClick={() => setTool('circle')} className={`p-2 rounded-lg ${tool === 'circle' ? 'bg-orange-100 text-orange-600' : 'text-stone-600 hover:bg-stone-100'}`} title="Circle">
                <Circle className="w-5 h-5" />
              </button>
              <div className="w-px h-6 bg-stone-200 mx-1"></div>
              <button onClick={() => setTool('eraser')} className={`p-2 rounded-lg ${tool === 'eraser' ? 'bg-orange-100 text-orange-600' : 'text-stone-600 hover:bg-stone-100'}`} title="Eraser (Click object to delete)">
                <Eraser className="w-5 h-5" />
              </button>
              
              <div className="w-px h-6 bg-stone-200 mx-1"></div>
              <input 
                type="color" 
                value={color} 
                onChange={(e) => setColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                title="Color"
              />
            </div>
          ) : (
            <div className="text-stone-500 font-medium px-2">Viewing Attachment</div>
          )}
          
          <div className="flex items-center space-x-3">
            {isPdf && (
              <div className="flex items-center space-x-2 bg-stone-100 rounded-lg px-2 py-1">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="p-1 text-stone-600 disabled:opacity-50 hover:bg-stone-200 rounded"
                >
                  &lt;
                </button>
                <span className="text-sm font-medium text-stone-700 min-w-[3rem] text-center">
                  {currentPage} / {numPages || '-'}
                </span>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
                  disabled={currentPage >= numPages}
                  className="p-1 text-stone-600 disabled:opacity-50 hover:bg-stone-200 rounded"
                >
                  &gt;
                </button>
              </div>
            )}
            
            {!readOnly && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-xl hover:bg-orange-700 disabled:opacity-50 transition-colors font-medium text-sm shadow-sm"
              >
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Annotations'}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-stone-500 hover:text-stone-700 hover:bg-stone-200 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 overflow-auto flex justify-center bg-stone-200 p-8 relative">
          {pdfError ? (
            <div className="flex flex-col items-center justify-center h-full w-full bg-stone-50 rounded-xl border-2 border-dashed border-stone-300 p-12">
              <div className="bg-red-50 p-4 rounded-full mb-4">
                <AlertCircle className="w-12 h-12 text-red-500" />
              </div>
              <h3 className="text-xl font-semibold text-stone-900 mb-2">Failed to Load PDF</h3>
              <p className="text-stone-500 text-center max-w-md">
                We couldn't load this PDF for annotation. The file might be corrupted or in an unsupported format.
              </p>
              <button 
                onClick={onClose}
                className="mt-6 px-6 py-2 bg-stone-900 text-white rounded-xl hover:bg-stone-800 transition-colors"
              >
                Close Annotator
              </button>
            </div>
          ) : (
            <div className="relative shadow-2xl bg-white" style={{ width: pageDimensions.width, height: pageDimensions.height }}>
            {isPdf ? (
              <Document
                file={attachment.data}
                onLoadSuccess={(doc) => {
                  onDocumentLoadSuccess(doc);
                  setPdfError(false);
                }}
                onLoadError={(error) => {
                  console.error('Error loading PDF in annotator:', error);
                  setPdfError(true);
                }}
                className="absolute inset-0 pointer-events-none"
              >
                <Page 
                  pageNumber={currentPage} 
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  onLoadSuccess={(page) => {
                    setPageDimensions({ width: page.width, height: page.height });
                  }}
                />
              </Document>
            ) : (
              <img 
                src={attachment.data} 
                alt="Attachment" 
                className="absolute inset-0 pointer-events-none" 
                style={{ width: pageDimensions.width, height: pageDimensions.height }} 
              />
            )}
            <canvas 
              ref={canvasRef} 
              className="absolute inset-0 z-10"
              style={{ width: pageDimensions.width, height: pageDimensions.height }}
            />
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
