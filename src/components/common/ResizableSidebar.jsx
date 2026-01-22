// src/components/common/ResizableSidebar.jsx
import React, { useRef, useEffect, useCallback } from 'react';

const ResizableSidebar = ({ width, setWidth, children, minWidth = 200, maxWidth = 800 }) => {
    const isResizing = useRef(false);
    const sidebarRef = useRef(null);

    const startResizing = useCallback((e) => {
        e.preventDefault();
        isResizing.current = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, []);

    const stopResizing = useCallback(() => {
        isResizing.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }, []);

    const resize = useCallback((mouseMoveEvent) => {
            if (isResizing.current && sidebarRef.current) {
                const sidebarRect = sidebarRef.current.getBoundingClientRect();
                const newWidth = mouseMoveEvent.clientX - sidebarRect.left;
                if (newWidth >= minWidth && newWidth <= maxWidth) {
                    setWidth(newWidth);
                }
            }
        }, [minWidth, maxWidth, setWidth]);

    useEffect(() => {
        window.addEventListener("mousemove", resize);
        window.addEventListener("mouseup", stopResizing);
        return () => {
            window.removeEventListener("mousemove", resize);
            window.removeEventListener("mouseup", stopResizing);
        };
    }, [resize, stopResizing]);

    return (
        <div ref={sidebarRef} className="flex flex-col border-r border-slate-200 bg-slate-50 relative shrink-0" style={{ width: width }}>
            {children}
            <div
                className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-blue-400 transition-colors z-20 flex items-center justify-center group opacity-0 hover:opacity-100"
                onMouseDown={startResizing}
            >
                <div className="w-0.5 h-full bg-blue-400"></div>
            </div>
        </div>
    );
};

export default ResizableSidebar;